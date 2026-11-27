import "server-only";
import { verify, type KeyObject } from "node:crypto";
import { getTechnicalEntitlementPublicKey } from "@/lib/financial/entitlement-trust-roots.server";
import type {
  DataConsumerContext,
  DataEnvironment,
  DataOperation,
  IntendedAudience,
  OperationPermission,
  TechnicalEntitlementRecord,
  TechnicalEntitlementScope,
  VerifiedTechnicalEntitlement
} from "@/types/financial";

const OPERATIONS: readonly DataOperation[] = ["retrieval", "storage", "display", "derivation", "ai-processing", "retention", "redistribution"];
const ENVIRONMENTS: readonly DataEnvironment[] = ["synthetic", "development-restricted", "production-licensed"];
const AUDIENCES: readonly IntendedAudience[] = ["internal", "named-customer", "public", "demo-only"];
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const SECURITY_ID = /^[A-Z]{2}:[A-Z0-9]{2,8}:[A-Z0-9._-]{1,32}$/;
const verifiedEntitlements = new WeakSet<object>();
const RECORD_KEYS = ["recordId", "issuerId", "providerId", "dataset", "market", "securityId", "sourceRecordId", "contractId", "contractVersion", "environment", "audience", "allowedOperations", "effectiveFrom", "expiresAt", "issuedAt", "integrity"] as const;
const INTEGRITY_KEYS = ["algorithm", "keyId", "signature"] as const;
const OPERATION_PERMISSION_KEYS = ["state", "conditions"] as const;

export type EntitlementVerificationError =
  | "invalid-record"
  | "unknown-issuer"
  | "invalid-integrity"
  | "production-verification-unavailable"
  | "scope-mismatch"
  | "environment-audience-mismatch"
  | "future-dated"
  | "not-yet-effective"
  | "expired"
  | "ambiguous-entitlements"
  | "unverified-entitlement"
  | "missing-entitlement"
  | "operation-unverified"
  | "operation-denied"
  | "conditions-unmet"
  | "legal-approval-pending"
  | "invalid-evaluation-time";

export interface TechnicalEntitlementVerification {
  readonly ok: true;
  readonly entitlement: VerifiedTechnicalEntitlement;
}

export interface TechnicalEntitlementVerificationFailure {
  readonly ok: false;
  readonly error: EntitlementVerificationError;
}

export type TechnicalEntitlementVerificationResult = TechnicalEntitlementVerification | TechnicalEntitlementVerificationFailure;

export interface TechnicalEntitlementVerifier {
  verify(record: unknown, expectedScope: TechnicalEntitlementScope): TechnicalEntitlementVerificationResult;
}

export interface TechnicalEntitlementPermissionDecision {
  readonly technicallyAllowed: boolean;
  /** Synthetic demo use only; this field does not represent contractual/legal approval. */
  readonly usableInRequestedContext: boolean;
  readonly legalApprovalStatus: "pending";
  readonly error?: EntitlementVerificationError;
  readonly entitlementId?: string;
}

function failure(error: EntitlementVerificationError): TechnicalEntitlementVerificationFailure {
  return { ok: false, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && IDENTIFIER.test(value);
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function audienceMatchesEnvironment(environment: unknown, audience: unknown): boolean {
  return (environment === "synthetic" && audience === "demo-only")
    || (environment === "development-restricted" && audience === "internal")
    || (environment === "production-licensed" && (audience === "named-customer" || audience === "public"));
}

function validPermission(value: unknown): value is OperationPermission {
  if (!isRecord(value) || !["allowed", "denied", "conditional", "unverified"].includes(String(value.state))) return false;
  if (!hasExactKeys(value, value.conditions === undefined ? ["state"] : OPERATION_PERMISSION_KEYS)) return false;
  if (value.state === "conditional") {
    return Array.isArray(value.conditions) && value.conditions.length > 0
      && value.conditions.length <= 20
      && value.conditions.every(isIdentifier)
      && new Set(value.conditions).size === value.conditions.length;
  }
  return value.conditions === undefined;
}

function validRecordShape(value: unknown): value is TechnicalEntitlementRecord {
  if (!isRecord(value) || !hasExactKeys(value, RECORD_KEYS) || !isRecord(value.integrity)
      || !hasExactKeys(value.integrity, INTEGRITY_KEYS) || value.integrity.algorithm !== "Ed25519"
      || !isIdentifier(value.integrity.keyId) || !isCanonicalEd25519Signature(value.integrity.signature)) return false;
  if (!isIdentifier(value.recordId) || !isIdentifier(value.issuerId) || !isIdentifier(value.providerId)
      || !isIdentifier(value.dataset) || !isIdentifier(value.market) || !isIdentifier(value.contractId)
      || !isIdentifier(value.contractVersion)) return false;
  if (value.securityId !== null && (typeof value.securityId !== "string" || !SECURITY_ID.test(value.securityId))) return false;
  if (value.sourceRecordId !== null && !isIdentifier(value.sourceRecordId)) return false;
  if (!ENVIRONMENTS.includes(value.environment as DataEnvironment) || !AUDIENCES.includes(value.audience as IntendedAudience)
      || !audienceMatchesEnvironment(value.environment, value.audience)) return false;
  if (!isRecord(value.allowedOperations) || Object.keys(value.allowedOperations).some((operation) => !OPERATIONS.includes(operation as DataOperation))) return false;
  if (!Object.values(value.allowedOperations).every(validPermission)) return false;
  if (!isTimestamp(value.effectiveFrom) || !isTimestamp(value.expiresAt) || !isTimestamp(value.issuedAt)) return false;
  return Date.parse(value.expiresAt) > Date.parse(value.effectiveFrom);
}

function isCanonicalEd25519Signature(value: unknown): value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{86}$/.test(value)) return false;
  try {
    const decoded = Buffer.from(value, "base64url");
    return decoded.byteLength === 64 && decoded.toString("base64url") === value;
  } catch {
    return false;
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

function unsignedRecord(record: TechnicalEntitlementRecord): Omit<TechnicalEntitlementRecord, "integrity"> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== "integrity")) as Omit<TechnicalEntitlementRecord, "integrity">;
}

function scopeMatches(record: TechnicalEntitlementRecord, scope: TechnicalEntitlementScope): boolean {
  return record.providerId === scope.providerId
    && record.dataset === scope.dataset
    && record.market === scope.market
    && record.securityId === scope.securityId
    && record.sourceRecordId === scope.sourceRecordId
    && record.contractId === scope.contractId
    && record.contractVersion === scope.contractVersion
    && record.environment === scope.environment
    && record.audience === scope.audience;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child));
  }
  return value;
}

function verifyWithKey(
  rawRecord: unknown,
  expectedScope: TechnicalEntitlementScope,
  evaluatedAt: string,
  issuerId: string,
  keyId: string,
  publicKey: KeyObject
): TechnicalEntitlementVerificationResult {
  if (!validRecordShape(rawRecord)) return failure("invalid-record");
  if (rawRecord.issuerId !== issuerId || rawRecord.integrity.keyId !== keyId) return failure("unknown-issuer");
  if (!isTimestamp(evaluatedAt)) return failure("invalid-evaluation-time");
  if (!verify(null, Buffer.from(canonicalJson(unsignedRecord(rawRecord))), publicKey, Buffer.from(rawRecord.integrity.signature, "base64url"))) {
    return failure("invalid-integrity");
  }
  if (!scopeMatches(rawRecord, expectedScope)) return failure("scope-mismatch");
  if (!audienceMatchesEnvironment(expectedScope.environment, expectedScope.audience)) return failure("environment-audience-mismatch");
  const now = Date.parse(evaluatedAt);
  if (Date.parse(rawRecord.issuedAt) > now) return failure("future-dated");
  if (Date.parse(rawRecord.effectiveFrom) > now) return failure("not-yet-effective");
  if (Date.parse(rawRecord.expiresAt) <= now) return failure("expired");

  const clonedRecord = deepFreeze(structuredClone(rawRecord));
  const entitlement = deepFreeze({
    record: clonedRecord,
    verification: { status: "verified" as const, method: "ed25519" as const, issuerId, keyId, verifiedAt: evaluatedAt },
    legalApproval: { status: "pending" as const, approvalReference: null }
  });
  verifiedEntitlements.add(entitlement);
  return { ok: true, entitlement };
}

/** Production trust roots are intentionally empty until a real issuer is approved and configured. */
export function verifyTechnicalEntitlementRecord(
  rawRecord: unknown,
  expectedScope: TechnicalEntitlementScope
): TechnicalEntitlementVerificationResult {
  if (!validRecordShape(rawRecord)) return failure("invalid-record");
  if (rawRecord.environment === "production-licensed") return failure("production-verification-unavailable");
  const key = getTechnicalEntitlementPublicKey(rawRecord.issuerId, rawRecord.integrity.keyId);
  return key ? verifyWithKey(rawRecord, expectedScope, new Date().toISOString(), rawRecord.issuerId, rawRecord.integrity.keyId, key)
    : failure("unknown-issuer");
}

export function isVerifiedTechnicalEntitlement(value: unknown): value is VerifiedTechnicalEntitlement {
  return typeof value === "object" && value !== null && verifiedEntitlements.has(value);
}

/** Evaluates each declared operation independently; it never converts technical proof into legal approval. */
export function evaluateVerifiedEntitlementPermission(
  entitlements: readonly unknown[],
  scope: TechnicalEntitlementScope,
  operation: DataOperation,
  consumer: DataConsumerContext | null | undefined
): TechnicalEntitlementPermissionDecision {
  const matching: VerifiedTechnicalEntitlement[] = [];
  for (const candidate of entitlements) {
    if (!isVerifiedTechnicalEntitlement(candidate)) return { technicallyAllowed: false, usableInRequestedContext: false, legalApprovalStatus: "pending", error: "unverified-entitlement" };
    if (scopeMatches(candidate.record, scope)) matching.push(candidate);
  }
  if (matching.length === 0) return { technicallyAllowed: false, usableInRequestedContext: false, legalApprovalStatus: "pending", error: "missing-entitlement" };
  if (matching.length > 1) return { technicallyAllowed: false, usableInRequestedContext: false, legalApprovalStatus: "pending", error: "ambiguous-entitlements" };
  if (!consumer || consumer.environment !== scope.environment || consumer.audience !== scope.audience) {
    return { technicallyAllowed: false, usableInRequestedContext: false, legalApprovalStatus: "pending", error: "environment-audience-mismatch" };
  }
  const evaluatedAt = new Date().toISOString();
  const record = matching[0].record;
  const now = Date.parse(evaluatedAt);
  if (Date.parse(record.issuedAt) > now) return { technicallyAllowed: false, usableInRequestedContext: false, legalApprovalStatus: "pending", error: "future-dated", entitlementId: record.recordId };
  if (Date.parse(record.effectiveFrom) > now) return { technicallyAllowed: false, usableInRequestedContext: false, legalApprovalStatus: "pending", error: "not-yet-effective", entitlementId: record.recordId };
  if (Date.parse(record.expiresAt) <= now) return { technicallyAllowed: false, usableInRequestedContext: false, legalApprovalStatus: "pending", error: "expired", entitlementId: record.recordId };

  const permission = record.allowedOperations[operation];
  if (!permission || permission.state === "unverified") return { technicallyAllowed: false, usableInRequestedContext: false, legalApprovalStatus: "pending", error: "operation-unverified", entitlementId: record.recordId };
  if (permission.state === "denied") return { technicallyAllowed: false, usableInRequestedContext: false, legalApprovalStatus: "pending", error: "operation-denied", entitlementId: record.recordId };
  if (permission.state === "conditional") return { technicallyAllowed: false, usableInRequestedContext: false, legalApprovalStatus: "pending", error: "conditions-unmet", entitlementId: record.recordId };

  const syntheticDemoOnly = record.environment === "synthetic" && record.audience === "demo-only";
  return {
    technicallyAllowed: true,
    usableInRequestedContext: syntheticDemoOnly,
    legalApprovalStatus: "pending",
    ...(!syntheticDemoOnly ? { error: "legal-approval-pending" as const } : {}),
    entitlementId: record.recordId
  };
}
