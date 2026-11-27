import "server-only";
import { createHash } from "node:crypto";
import {
  evaluateVerifiedEntitlementPermission,
  verifyTechnicalEntitlementRecord
} from "@/lib/financial/entitlement-verification.server";
import { isSyntheticEvidenceFixtureAllowed } from "@/lib/research/synthetic-evidence-policy.server";
import { validateTrustedResearchRequestContext } from "@/lib/research/request-context.server";
import type {
  DataConsumerContext,
  DataOperation,
  TechnicalEntitlementRecord,
  TechnicalEntitlementPreflight,
  TechnicalEntitlementScope,
  VerifiedTechnicalEntitlement
} from "@/types/financial";
import type {
  EntitlementVerificationReceipt,
  EvidenceOperationDecision,
  EvidencePermissionAssessment
} from "@/types/research";
import type { TrustedResearchRequestContext } from "@/types/research-context";
import type { VerifiedNewsRetrievalAuthorization } from "@/types/news";

export const RESEARCH_DATA_OPERATIONS: readonly DataOperation[] = [
  "retrieval", "storage", "display", "derivation", "ai-processing", "retention", "redistribution"
];

const verifiedNewsRetrievalAuthorizations = new WeakSet<object>();

export interface ResearchEntitlementSource {
  readonly providerId: string;
  readonly dataset: string;
  readonly market: string;
  readonly securityId: string;
  readonly sourceRecordId: string;
  readonly dataEnvironment: "synthetic" | "development-restricted" | "production-licensed";
  readonly expectedContract: { readonly contractId: string; readonly contractVersion: string } | null;
  readonly records: readonly TechnicalEntitlementRecord[];
}

export interface ResearchEntitlementEvaluation {
  readonly scope: TechnicalEntitlementScope;
  readonly receipt: EntitlementVerificationReceipt | null;
  readonly assessment: EvidencePermissionAssessment;
  readonly verifiedEntitlement: VerifiedTechnicalEntitlement | null;
  readonly eligibleForAI: boolean;
}

/** Authorizes a provider/dataset/security fetch before the response (and its source IDs) exists. */
export function verifyResearchRetrievalPreflight(
  preflight: TechnicalEntitlementPreflight | null | undefined,
  providerId: string,
  dataset: string,
  market: string,
  securityId: string,
  contract: { contractId: string; contractVersion: string; retrievalScope: "dataset" | "source-record" } | null,
  context: TrustedResearchRequestContext
): boolean {
  if (!preflight || !contract || contract.retrievalScope !== "dataset" || preflight.retrievalScope !== "dataset"
      || preflight.contractId !== contract.contractId || preflight.contractVersion !== contract.contractVersion
      || typeof preflight.dataset !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/.test(preflight.dataset)
      || !validateTrustedResearchRequestContext(context).ok
      || context.authorizedSecurityId !== securityId || !consumerForContext(context)) return false;
  const scope: TechnicalEntitlementScope = {
    providerId, dataset: preflight.dataset, market, securityId, sourceRecordId: null,
    contractId: preflight.contractId, contractVersion: preflight.contractVersion,
    environment: "synthetic", audience: "demo-only"
  };
  if (dataset !== preflight.dataset) return false;
  const result = verifyTechnicalEntitlementRecord(preflight.record, scope);
  if (!result.ok) return false;
  const decision = evaluateVerifiedEntitlementPermission([result.entitlement], scope, "retrieval", consumerForContext(context));
  return decision.technicallyAllowed && decision.usableInRequestedContext;
}

/** Mints an opaque, one-request provider token only after signed retrieval preflight validation. */
export function verifyNewsRetrievalAuthorization(
  preflight: TechnicalEntitlementPreflight | null | undefined,
  providerId: string,
  dataset: string,
  market: string,
  securityId: string,
  contract: { contractId: string; contractVersion: string; retrievalScope: "dataset" | "source-record" } | null,
  context: TrustedResearchRequestContext
): VerifiedNewsRetrievalAuthorization | null {
  if (!verifyResearchRetrievalPreflight(preflight, providerId, dataset, market, securityId, contract, context)) return null;
  const authorization = Object.freeze({
    providerId, dataset, market, securityId,
    contractId: contract!.contractId, contractVersion: contract!.contractVersion,
    retrievalScope: "dataset" as const, requestId: context.requestId
  });
  verifiedNewsRetrievalAuthorizations.add(authorization);
  return authorization;
}

/** Checks runtime issuance and exact scope; structural or deserialized lookalikes fail. */
export function isVerifiedNewsRetrievalAuthorization(
  value: unknown,
  expected: Pick<VerifiedNewsRetrievalAuthorization, "providerId" | "dataset" | "market" | "securityId" | "contractId" | "contractVersion" | "retrievalScope">
): value is VerifiedNewsRetrievalAuthorization {
  if (typeof value !== "object" || value === null || !verifiedNewsRetrievalAuthorizations.has(value)) return false;
  const authorization = value as VerifiedNewsRetrievalAuthorization;
  return authorization.providerId === expected.providerId
    && authorization.dataset === expected.dataset
    && authorization.market === expected.market
    && authorization.securityId === expected.securityId
    && authorization.contractId === expected.contractId
    && authorization.contractVersion === expected.contractVersion
    && authorization.retrievalScope === expected.retrievalScope;
}

/** Checks one operation against every source assessment attached to an evidence item. */
export function evidenceOperationAllowed(
  item: { readonly sources: readonly { providerId: string; dataset: string; market: string; sourceRecordId: string; dataEnvironment: string }[]; readonly subjectSecurityId: string; readonly permissionAssessmentIds: readonly string[] },
  assessments: readonly EvidencePermissionAssessment[],
  receipts: readonly EntitlementVerificationReceipt[],
  operation: DataOperation
): boolean {
  if (!item.sources.length || item.permissionAssessmentIds.length !== item.sources.length) return false;
  const receiptIds = new Set(receipts.map((receipt) => receipt.receiptId));
  return item.sources.every((source) => {
    const matches = item.permissionAssessmentIds.map((id) => assessments.find((entry) => entry.assessmentId === id))
      .filter((entry) => entry && entry.sourceScope.providerId === source.providerId
        && entry.sourceScope.dataset === source.dataset && entry.sourceScope.market === source.market
        && entry.sourceScope.sourceRecordId === source.sourceRecordId && entry.sourceScope.securityId === item.subjectSecurityId
        && entry.sourceScope.environment === source.dataEnvironment);
    if (matches.length !== 1) return false;
    const decision = matches[0]!.decisions[operation];
    return decision?.operation === operation && decision.allowed === true
      && typeof decision.receiptId === "string" && receiptIds.has(decision.receiptId);
  });
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

export function createResearchContextBinding(context: TrustedResearchRequestContext): {
  requestId: string;
  authorizedSecurityId: string;
  digest: string;
} {
  const result = validateTrustedResearchRequestContext(context);
  if (!result.ok) throw new TypeError("A genuine trusted research request context is required.");
  const digest = createHash("sha256").update(canonicalJson(context)).digest("hex");
  return Object.freeze({ requestId: context.requestId, authorizedSecurityId: context.authorizedSecurityId, digest });
}

export function matchesResearchContextBinding(
  binding: { requestId: string; authorizedSecurityId: string; digest: string },
  context: TrustedResearchRequestContext
): boolean {
  try {
    const expected = createResearchContextBinding(context);
    return binding.requestId === expected.requestId
      && binding.authorizedSecurityId === expected.authorizedSecurityId
      && binding.digest === expected.digest;
  } catch {
    return false;
  }
}

function deniedDecisions(reason: string, evaluatedAt: string): Record<DataOperation, EvidenceOperationDecision> {
  return Object.fromEntries(RESEARCH_DATA_OPERATIONS.map((operation) => [operation, {
    operation, allowed: false, reason, receiptId: null, evaluatedAt
  }])) as Record<DataOperation, EvidenceOperationDecision>;
}

function consumerForContext(context: TrustedResearchRequestContext): DataConsumerContext | null {
  if (context.deploymentEnvironment === "test" && context.audience === "internal-demo"
      && isSyntheticEvidenceFixtureAllowed(context)) {
    return { environment: "synthetic", audience: "demo-only" };
  }
  return null;
}

/** Verifies one exact source scope and independently evaluates every operation. */
export function evaluateResearchSourceEntitlement(
  source: ResearchEntitlementSource,
  context: TrustedResearchRequestContext,
  evaluatedAt = new Date().toISOString()
): ResearchEntitlementEvaluation {
  if (!validateTrustedResearchRequestContext(context).ok
      || context.authorizedSecurityId !== source.securityId) {
    const scope: TechnicalEntitlementScope = {
      providerId: source.providerId, dataset: source.dataset, market: source.market,
      securityId: source.securityId, sourceRecordId: source.sourceRecordId,
      contractId: source.expectedContract?.contractId ?? "unresolved-contract",
      contractVersion: source.expectedContract?.contractVersion ?? "unresolved-version",
      environment: "synthetic", audience: "demo-only"
    };
    return deniedEvaluation(scope, "untrusted-or-mismatched-request-context", evaluatedAt);
  }

  const scope: TechnicalEntitlementScope = {
    providerId: source.providerId,
    dataset: source.dataset,
    market: source.market,
    securityId: source.securityId,
    sourceRecordId: source.sourceRecordId,
    contractId: source.expectedContract?.contractId ?? "unresolved-contract",
    contractVersion: source.expectedContract?.contractVersion ?? "unresolved-version",
    environment: "synthetic",
    audience: "demo-only"
  };
  const consumer = consumerForContext(context);
  if (!consumer || source.dataEnvironment !== "synthetic") {
    return deniedEvaluation(scope, "synthetic-test-policy-not-applicable", evaluatedAt);
  }
  if (!source.expectedContract) return deniedEvaluation(scope, "trusted-contract-scope-unavailable", evaluatedAt);
  if (source.records.length !== 1) {
    return deniedEvaluation(scope, source.records.length === 0 ? "missing-entitlement" : "ambiguous-entitlements", evaluatedAt);
  }

  const rawRecord = source.records[0];
  const verification = verifyTechnicalEntitlementRecord(rawRecord, scope);
  if (!verification.ok) return deniedEvaluation(scope, verification.error, evaluatedAt);
  const permission = evaluateVerifiedEntitlementPermission([verification.entitlement], scope, "retrieval", consumer);
  if (!permission.technicallyAllowed || !permission.usableInRequestedContext) {
    return deniedEvaluation(scope, permission.error ?? "permission-denied", evaluatedAt);
  }

  const receiptId = verification.entitlement.record.recordId;
  const receipt: EntitlementVerificationReceipt = Object.freeze({
    receiptId,
    record: verification.entitlement.record,
    scope,
    verificationStatus: "verified",
    verificationMethod: "ed25519",
    issuerId: verification.entitlement.verification.issuerId,
    keyId: verification.entitlement.verification.keyId,
    verifiedAt: verification.entitlement.verification.verifiedAt,
    evaluatedAt,
    effectiveFrom: verification.entitlement.record.effectiveFrom,
    expiresAt: verification.entitlement.record.expiresAt,
    legalApprovalStatus: "pending"
  });
  const decisions = Object.fromEntries(RESEARCH_DATA_OPERATIONS.map((operation) => {
    const result = evaluateVerifiedEntitlementPermission([verification.entitlement], scope, operation, consumer);
    return [operation, {
      operation,
      allowed: result.technicallyAllowed && result.usableInRequestedContext,
      reason: result.error ?? (result.technicallyAllowed ? "allowed;legal-approval-pending-synthetic-test-only" : "permission-denied"),
      receiptId,
      evaluatedAt
    }];
  })) as Record<DataOperation, EvidenceOperationDecision>;
  const assessmentId = `permission:${receiptId}:${source.sourceRecordId}`;
  const assessment: EvidencePermissionAssessment = Object.freeze({ assessmentId, sourceScope: scope, decisions: Object.freeze(decisions) });
  return {
    scope, receipt, assessment, verifiedEntitlement: verification.entitlement,
    eligibleForAI: decisions.retrieval.allowed && decisions["ai-processing"].allowed
  };
}

function deniedEvaluation(scope: TechnicalEntitlementScope, reason: string, evaluatedAt: string): ResearchEntitlementEvaluation {
  return {
    scope, receipt: null, verifiedEntitlement: null,
    assessment: Object.freeze({
      assessmentId: `denied:${scope.providerId}:${scope.sourceRecordId}:${reason}`,
      sourceScope: scope,
      decisions: Object.freeze(deniedDecisions(reason, evaluatedAt))
    }),
    eligibleForAI: false
  };
}

/** Revalidates signed receipts and operations at validation/render time; pending is accepted only by the test fixture policy. */
export function revalidateResearchSnapshotPermissions(
  receipts: readonly EntitlementVerificationReceipt[],
  assessments: readonly EvidencePermissionAssessment[],
  context: TrustedResearchRequestContext,
  securityId: string
): boolean {
  if (!validateTrustedResearchRequestContext(context).ok || context.authorizedSecurityId !== securityId
      || !isSyntheticEvidenceFixtureAllowed(context) || context.deploymentEnvironment !== "test"
      || context.audience !== "internal-demo") return false;
  const receiptById = new Map<string, EntitlementVerificationReceipt>();
  const verifiedById = new Map<string, VerifiedTechnicalEntitlement>();
  for (const receipt of receipts) {
    if (receiptById.has(receipt.receiptId) || receipt.legalApprovalStatus !== "pending") return false;
    const result = verifyTechnicalEntitlementRecord(receipt.record, receipt.scope);
    if (!result.ok || result.entitlement.record.recordId !== receipt.receiptId
        || result.entitlement.verification.issuerId !== receipt.issuerId
        || result.entitlement.verification.keyId !== receipt.keyId
        || receipt.record.issuerId !== receipt.issuerId || receipt.record.integrity.keyId !== receipt.keyId
        || receipt.effectiveFrom !== receipt.record.effectiveFrom || receipt.expiresAt !== receipt.record.expiresAt
        || !isCanonicalTimestamp(receipt.evaluatedAt) || !isCanonicalTimestamp(receipt.verifiedAt)
        || receipt.scope.environment !== "synthetic" || receipt.scope.audience !== "demo-only") return false;
    receiptById.set(receipt.receiptId, receipt);
    verifiedById.set(receipt.receiptId, result.entitlement);
  }
  const assessmentIds = new Set<string>();
  for (const assessment of assessments) {
    if (assessmentIds.has(assessment.assessmentId)) return false;
    assessmentIds.add(assessment.assessmentId);
    const receiptIds = new Set(Object.values(assessment.decisions).map((decision) => decision.receiptId).filter((id): id is string => id !== null));
    if (receiptIds.size !== 1) return false;
    const receipt = receiptById.get([...receiptIds][0]);
    if (!receipt || canonicalJson(receipt.scope) !== canonicalJson(assessment.sourceScope)) return false;
    if (Object.keys(assessment.decisions).length !== RESEARCH_DATA_OPERATIONS.length) return false;
    for (const operation of RESEARCH_DATA_OPERATIONS) {
      const verified = verifiedById.get(receipt.receiptId);
      if (!verified) return false;
      const actual = evaluateVerifiedEntitlementPermission([verified], receipt.scope, operation, { environment: "synthetic", audience: "demo-only" });
      const decision = assessment.decisions[operation];
      if (!decision || decision.operation !== operation || decision.allowed !== (actual.technicallyAllowed && actual.usableInRequestedContext)
          || decision.receiptId !== receipt.receiptId) return false;
    }
  }
  return true;
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}
