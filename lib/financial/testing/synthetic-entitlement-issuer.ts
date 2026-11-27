/** Test-only ephemeral issuer. Never import this module from application runtime code. */
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { verifyTechnicalEntitlementRecord, type TechnicalEntitlementVerificationResult } from "@/lib/financial/entitlement-verification.server";
import { registerTestEntitlementPublicKey } from "@/lib/financial/testing/entitlement-trust-roots";
import type { TechnicalEntitlementRecord, TechnicalEntitlementScope } from "@/types/financial";

export interface TestSyntheticEntitlementIssuer {
  readonly issuerId: string;
  issue(claims: Omit<TechnicalEntitlementRecord, "issuerId" | "integrity">): TechnicalEntitlementRecord;
  verify(record: unknown, expectedScope: TechnicalEntitlementScope): TechnicalEntitlementVerificationResult;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

export function createTestSyntheticEntitlementIssuer(): TestSyntheticEntitlementIssuer {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const issuerId = `aynox-test-issuer:${randomUUID()}`;
  const keyId = `test-key:${randomUUID()}`;
  registerTestEntitlementPublicKey(issuerId, keyId, publicKey);
  return Object.freeze({
    issuerId,
    issue(claims: Omit<TechnicalEntitlementRecord, "issuerId" | "integrity">) {
      if (claims.environment !== "synthetic" || claims.audience !== "demo-only") {
        throw new Error("The test issuer accepts only synthetic demo entitlements.");
      }
      const unsigned = { ...claims, issuerId };
      const signature = sign(null, Buffer.from(canonicalJson(unsigned)), privateKey).toString("base64url");
      return Object.freeze({
        ...unsigned,
        integrity: { algorithm: "Ed25519" as const, keyId, signature }
      });
    },
    verify(record: unknown, expectedScope: TechnicalEntitlementScope) {
      return verifyTechnicalEntitlementRecord(record, expectedScope);
    }
  });
}
