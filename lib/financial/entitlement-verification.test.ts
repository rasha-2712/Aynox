import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as productionVerifier from "@/lib/financial/entitlement-verification.server";
import {
  evaluateVerifiedEntitlementPermission,
  isVerifiedTechnicalEntitlement,
  verifyTechnicalEntitlementRecord
} from "@/lib/financial/entitlement-verification.server";
import { createTestSyntheticEntitlementIssuer, type TestSyntheticEntitlementIssuer } from "@/lib/financial/testing/synthetic-entitlement-issuer";
import type { DataOperation, TechnicalEntitlementRecord, TechnicalEntitlementScope } from "@/types/financial";

const evaluatedAt = "2026-11-26T12:00:00.000Z";
const issuer = createTestSyntheticEntitlementIssuer();
const scope: TechnicalEntitlementScope = {
  providerId: "fixture-provider",
  dataset: "synthetic-financials",
  market: "XNAS",
  securityId: "US:XNAS:NVDA",
  sourceRecordId: "source-record-1",
  contractId: "synthetic-demo-contract",
  contractVersion: "1",
  environment: "synthetic",
  audience: "demo-only"
};
const consumer = { environment: "synthetic" as const, audience: "demo-only" as const };
const allowedOperations = Object.fromEntries(
  (["retrieval", "storage", "display", "derivation", "ai-processing", "retention", "redistribution"] as const)
    .map((operation) => [operation, { state: "allowed" as const }])
) as NonNullable<TechnicalEntitlementRecord["allowedOperations"]>;

function issue(overrides: Partial<Omit<TechnicalEntitlementRecord, "issuerId" | "integrity">> = {}, authority: TestSyntheticEntitlementIssuer = issuer) {
  return authority.issue({
    recordId: "record-1",
    providerId: scope.providerId,
    dataset: scope.dataset,
    market: scope.market,
    securityId: scope.securityId,
    sourceRecordId: scope.sourceRecordId,
    contractId: scope.contractId,
    contractVersion: scope.contractVersion,
    environment: "synthetic",
    audience: "demo-only",
    allowedOperations,
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    expiresAt: "2027-01-01T00:00:00.000Z",
    issuedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  });
}

function verified(record: unknown, expectedScope: TechnicalEntitlementScope = scope) {
  return issuer.verify(record, expectedScope);
}

function verifiedValue(record: TechnicalEntitlementRecord) {
  const result = verified(record);
  if (!result.ok) throw new Error(`Test fixture verification failed: ${result.error}`);
  return result.entitlement;
}

function canonicalFixtureJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalFixtureJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalFixtureJson(record[key])}`).join(",")}}`;
}

function collectApplicationSources(directory: string): string[] {
  return readdirSync(directory).flatMap((name: string) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return name === "testing" ? [] : collectApplicationSources(path);
    if (!/\.(tsx?|jsx?)$/.test(name) || name.endsWith(".test.ts") || name.endsWith(".spec.ts")) return [];
    return [readFileSync(path, "utf8") as string];
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(evaluatedAt));
});

afterEach(() => vi.useRealTimers());

describe("authenticated technical entitlement provenance", () => {
  it("does not expose a production API for caller-supplied test keys", () => {
    expect(productionVerifier).not.toHaveProperty("verifySyntheticEntitlementWithTestKey");
    expect(productionVerifier).not.toHaveProperty("registerTestEntitlementPublicKey");
    expect(productionVerifier.verifyTechnicalEntitlementRecord).toHaveLength(2);
  });

  it("keeps production trust roots fixed and empty", () => {
    const productionTrustRoots = readFileSync(join(process.cwd(), "lib/financial/entitlement-trust-roots.server.ts"), "utf8");
    expect(productionTrustRoots).toContain("return null");
    expect(productionTrustRoots).not.toMatch(/process\.env|register|set\(/);
  });

  it("does not import test issuer or test-root modules from the application graph", () => {
    const projectRoot = process.cwd();
    const applicationSources = [
      ...collectApplicationSources(join(projectRoot, "app")),
      ...collectApplicationSources(join(projectRoot, "lib"))
    ];
    expect(applicationSources.some((source) => /(?:from\s*|import\s*)["'][^"']*financial\/testing\//.test(source))).toBe(false);
    expect(applicationSources.some((source) => source.includes("verifySyntheticEntitlementWithTestKey"))).toBe(false);
    expect(readFileSync(join(projectRoot, "next.config.ts"), "utf8")).not.toContain("financial/testing");
    expect(readFileSync(join(projectRoot, "vitest.config.ts"), "utf8")).toContain("financial/testing/entitlement-trust-roots.ts");
    expect(readFileSync(join(projectRoot, "eslint.config.mjs"), "utf8")).toContain("**/financial/testing/**");
  });

  it("verifies a signed synthetic test entitlement and keeps legal approval separate", () => {
    const record = issue();
    const result = verified(record);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isVerifiedTechnicalEntitlement(result.entitlement)).toBe(true);
    expect(result.entitlement.verification).toMatchObject({ status: "verified", method: "ed25519", issuerId: issuer.issuerId });
    expect(result.entitlement.legalApproval).toEqual({ status: "pending", approvalReference: null });
    const permission = evaluateVerifiedEntitlementPermission([result.entitlement], scope, "ai-processing", consumer);
    expect(permission).toMatchObject({ technicallyAllowed: true, usableInRequestedContext: true, legalApprovalStatus: "pending" });
  });

  it("rejects a forged record even when its fields look valid", () => {
    const record = { ...issue(), issuerId: "caller-forged-issuer" };
    expect(verifyTechnicalEntitlementRecord(record, scope)).toEqual({ ok: false, error: "unknown-issuer" });
    const changedClaim = issue({ allowedOperations: { ...allowedOperations, "ai-processing": { state: "denied" } } });
    const tampered = { ...changedClaim, allowedOperations };
    expect(verified(tampered)).toEqual({ ok: false, error: "invalid-integrity" });
  });

  it("accepts canonical Ed25519 signatures and rejects malformed or tampered encodings", () => {
    const valid = issue();
    expect(verified(valid).ok).toBe(true);
    const signature = valid.integrity.signature;
    const base64UrlAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const lastIndex = base64UrlAlphabet.indexOf(signature.at(-1) ?? "");
    const noncanonicalLastCharacter = base64UrlAlphabet[lastIndex + 1];
    const invalidSignatures = [
      signature.slice(0, -1),
      `${signature}A`,
      `${signature.slice(0, -1)}!`,
      `${signature.slice(0, -1)}${noncanonicalLastCharacter}`,
      `${"A".repeat(86)}`
    ];
    for (const candidate of invalidSignatures) {
      expect(verified({ ...valid, integrity: { ...valid.integrity, signature: candidate } }).ok).toBe(false);
    }
  });

  it("rejects unknown and missing issuers and malformed record structure", () => {
    const record = issue();
    expect(verified({ ...record, issuerId: "unknown:issuer" })).toEqual({ ok: false, error: "unknown-issuer" });
    expect(verified({ ...record, issuerId: "" })).toEqual({ ok: false, error: "invalid-record" });
    expect(verified({ ...record, extraPermission: true })).toEqual({ ok: false, error: "invalid-record" });
  });

  it("does not trust an arbitrary self-generated key or an unregistered key ID", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const base = issue();
    const { integrity: _integrity, ...baseClaims } = base;
    void _integrity;
    const unsigned = { ...baseClaims, issuerId: "self-generated-issuer" };
    const signature = sign(null, Buffer.from(canonicalFixtureJson(unsigned)), privateKey).toString("base64url");
    const selfSigned = {
      ...unsigned,
      integrity: { algorithm: "Ed25519" as const, keyId: "self-generated-key", signature }
    } satisfies TechnicalEntitlementRecord;
    void publicKey;
    expect(productionVerifier.verifyTechnicalEntitlementRecord(selfSigned, scope))
      .toEqual({ ok: false, error: "unknown-issuer" });

    const knownRecord = issue();
    expect(productionVerifier.verifyTechnicalEntitlementRecord({
      ...knownRecord,
      integrity: { ...knownRecord.integrity, keyId: "unregistered-key" }
    }, scope)).toEqual({ ok: false, error: "unknown-issuer" });
  });

  it("rejects expired, future-dated and not-yet-effective records", () => {
    expect(verified(issue({ expiresAt: "2026-11-26T11:59:59.000Z" }))).toEqual({ ok: false, error: "expired" });
    expect(verified(issue({ issuedAt: "2026-11-26T12:00:01.000Z" }))).toEqual({ ok: false, error: "future-dated" });
    expect(verified(issue({ effectiveFrom: "2026-11-26T12:00:01.000Z" }))).toEqual({ ok: false, error: "not-yet-effective" });
  });

  it("rejects every provider, data and contract scope mismatch", () => {
    const mismatches: Array<keyof TechnicalEntitlementScope> = [
      "providerId", "dataset", "market", "securityId", "sourceRecordId", "contractId", "contractVersion", "environment", "audience"
    ];
    for (const key of mismatches) {
      const changedScope = { ...scope, [key]: key === "securityId" || key === "sourceRecordId" ? "US:XNAS:AAPL" : "other-scope" } as TechnicalEntitlementScope;
      expect(verified(issue(), changedScope)).toEqual({ ok: false, error: "scope-mismatch" });
    }
  });

  it("rejects invalid environment and audience combinations", () => {
    expect(() => issue({ environment: "production-licensed", audience: "named-customer" })).toThrow("synthetic demo entitlements");
    expect(() => issue({ environment: "synthetic", audience: "public" })).toThrow("synthetic demo entitlements");
  });

  it("evaluates retrieval and AI processing independently", () => {
    const record = issue({ allowedOperations: { ...allowedOperations, "ai-processing": { state: "denied" } } });
    const result = verifiedValue(record);
    expect(evaluateVerifiedEntitlementPermission([result], scope, "retrieval", consumer).technicallyAllowed).toBe(true);
    expect(evaluateVerifiedEntitlementPermission([result], scope, "ai-processing", consumer).error).toBe("operation-denied");
  });

  it("does not infer derivation permission from AI-processing permission", () => {
    const record = issue({ allowedOperations: { ...allowedOperations, derivation: { state: "denied" } } });
    const result = verifiedValue(record);
    expect(evaluateVerifiedEntitlementPermission([result], scope, "ai-processing", consumer).technicallyAllowed).toBe(true);
    expect(evaluateVerifiedEntitlementPermission([result], scope, "derivation", consumer).error).toBe("operation-denied");
  });

  it("fails closed for missing, unverified, denied and conditional operation permissions", () => {
    const missing = verifiedValue(issue({ allowedOperations: { retrieval: { state: "allowed" } } }));
    expect(evaluateVerifiedEntitlementPermission([missing], scope, "storage", consumer).error).toBe("operation-unverified");
    const unverified = verifiedValue(issue({ allowedOperations: { ...allowedOperations, display: { state: "unverified" } } }));
    expect(evaluateVerifiedEntitlementPermission([unverified], scope, "display", consumer).error).toBe("operation-unverified");
    const denied = verifiedValue(issue({ allowedOperations: { ...allowedOperations, retention: { state: "denied" } } }));
    expect(evaluateVerifiedEntitlementPermission([denied], scope, "retention", consumer).error).toBe("operation-denied");
    const conditional = verifiedValue(issue({ allowedOperations: { ...allowedOperations, redistribution: { state: "conditional", conditions: ["attribution"] } } }));
    expect(evaluateVerifiedEntitlementPermission([conditional], scope, "redistribution", consumer).error).toBe("conditions-unmet");
  });

  it("rejects ambiguous matching entitlements and unverified caller objects", () => {
    const first = verifiedValue(issue());
    const second = verifiedValue(issue({ recordId: "record-2" }));
    expect(evaluateVerifiedEntitlementPermission([first, second], scope, "retrieval", consumer).error).toBe("ambiguous-entitlements");
    const forged = structuredClone(first);
    expect(isVerifiedTechnicalEntitlement(forged)).toBe(false);
    expect(evaluateVerifiedEntitlementPermission([forged], scope, "retrieval", consumer).error).toBe("unverified-entitlement");
  });

  it("uses server time and rechecks request environment/audience", () => {
    const entitlement = verifiedValue(issue());
    expect(evaluateVerifiedEntitlementPermission([entitlement], scope, "retrieval", { environment: "production-licensed", audience: "named-customer" }).error).toBe("environment-audience-mismatch");
    vi.setSystemTime(new Date("2027-01-01T00:00:00.000Z"));
    expect(evaluateVerifiedEntitlementPermission([entitlement], scope, "retrieval", consumer).error).toBe("expired");
  });

  it("never allows the test issuer or unavailable production verifier to authorize production", () => {
    const productionClaims = {
      recordId: "production-record",
      providerId: scope.providerId,
      dataset: scope.dataset,
      market: scope.market,
      securityId: scope.securityId,
      sourceRecordId: scope.sourceRecordId,
      contractId: scope.contractId,
      contractVersion: scope.contractVersion,
      environment: "production-licensed" as const,
      audience: "named-customer" as const,
      allowedOperations,
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      expiresAt: "2027-01-01T00:00:00.000Z",
      issuedAt: "2026-01-01T00:00:00.000Z"
    };
    expect(() => issuer.issue(productionClaims)).toThrow("synthetic demo entitlements");
    const unsignedProduction = {
      ...productionClaims,
      issuerId: "unconfigured-production-issuer",
      integrity: { algorithm: "Ed25519" as const, keyId: "unconfigured-key", signature: "A".repeat(86) }
    } satisfies TechnicalEntitlementRecord;
    const productionScope = { ...scope, environment: "production-licensed" as const, audience: "named-customer" as const };
    expect(verifyTechnicalEntitlementRecord(unsignedProduction, productionScope))
      .toEqual({ ok: false, error: "production-verification-unavailable" });
    const syntheticRecord = issue();
    expect(issuer.verify(syntheticRecord, productionScope)).toEqual({ ok: false, error: "scope-mismatch" });
    const syntheticVerified = verifiedValue(syntheticRecord);
    expect(evaluateVerifiedEntitlementPermission([syntheticVerified], productionScope, "ai-processing", {
      environment: "production-licensed", audience: "named-customer"
    }).usableInRequestedContext).toBe(false);
  });

  it("does not accept client-supplied entitlements without a trusted issuer signature", () => {
    const clientRecord = {
      ...issue(),
      recordId: "client-entitlement",
      allowedOperations: Object.fromEntries((OPERATIONS_FOR_TEST).map((operation) => [operation, { state: "allowed" }]))
    };
    expect(verifyTechnicalEntitlementRecord(clientRecord, scope).ok).toBe(false);
  });
});

const OPERATIONS_FOR_TEST: readonly DataOperation[] = ["retrieval", "storage", "display", "derivation", "ai-processing", "retention", "redistribution"];
