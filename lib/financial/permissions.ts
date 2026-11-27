import type { DataConsumerContext, DataEntitlement, DataOperation, DataPermissionScope, OperationPermission } from "@/types/financial";

export interface PermissionDecision {
  allowed: boolean;
  reason: "allowed" | "missing-entitlement" | "ambiguous-entitlement" | "scope-mismatch" | "inactive-entitlement" | "operation-unverified" | "operation-denied" | "conditions-unmet" | "environment-mismatch" | "audience-mismatch" | "unknown-consumer-context" | "unauthenticated-entitlement";
  entitlementId?: string;
}

export function evaluateDataPermission(
  entitlements: DataEntitlement[],
  scope: DataPermissionScope,
  operation: DataOperation,
  at: string,
  consumer: DataConsumerContext | null | undefined,
  satisfiedConditions: string[] = []
): PermissionDecision {
  const matching = entitlements.filter((entitlement) => matchesScope(entitlement, scope));
  if (matching.length === 0) {
    return { allowed: false, reason: entitlements.length === 0 ? "missing-entitlement" : "scope-mismatch" };
  }
  if (matching.length > 1) return { allowed: false, reason: "ambiguous-entitlement" };

  const entitlement = matching[0];
  // Plain DataEntitlement objects are declarations only. Production requires a future
  // authenticated verifier integration; no caller-supplied object can grant it here.
  if (entitlement.dataEnvironment === "production-licensed") {
    return { allowed: false, reason: "unauthenticated-entitlement", entitlementId: entitlement.id };
  }
  if (!consumer || !isKnownEnvironment(consumer.environment) || !isKnownAudience(consumer.audience)) {
    return { allowed: false, reason: "unknown-consumer-context", entitlementId: entitlement.id };
  }
  if (!isKnownEnvironment(entitlement.dataEnvironment) || entitlement.dataEnvironment !== consumer.environment) {
    return { allowed: false, reason: "environment-mismatch", entitlementId: entitlement.id };
  }
  if (!entitlement.authorizedEnvironments?.includes(consumer.environment)) {
    return { allowed: false, reason: "environment-mismatch", entitlementId: entitlement.id };
  }
  if (entitlement.permittedAudience !== consumer.audience) {
    return { allowed: false, reason: "audience-mismatch", entitlementId: entitlement.id };
  }
  if ((consumer.environment === "synthetic" && consumer.audience !== "demo-only")
      || (consumer.environment === "development-restricted" && consumer.audience !== "internal")) {
    return { allowed: false, reason: "environment-mismatch", entitlementId: entitlement.id };
  }
  const timestamp = Date.parse(at);
  const start = Date.parse(entitlement.effectiveFrom);
  const end = entitlement.effectiveTo ? Date.parse(entitlement.effectiveTo) : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(timestamp) || !Number.isFinite(start) || (entitlement.effectiveTo && !Number.isFinite(end))) {
    return { allowed: false, reason: "inactive-entitlement", entitlementId: entitlement.id };
  }
  if (timestamp < start || timestamp >= end) {
    return { allowed: false, reason: "inactive-entitlement", entitlementId: entitlement.id };
  }

  const permission: OperationPermission | undefined = entitlement.permissions[operation];
  if (!permission || permission.state === "unverified") {
    return { allowed: false, reason: "operation-unverified", entitlementId: entitlement.id };
  }
  if (permission.state === "denied") {
    return { allowed: false, reason: "operation-denied", entitlementId: entitlement.id };
  }
  if (permission.state === "conditional") {
    const satisfied = new Set(satisfiedConditions);
    if (!permission.conditions?.length || permission.conditions.some((condition) => !satisfied.has(condition))) {
      return { allowed: false, reason: "conditions-unmet", entitlementId: entitlement.id };
    }
  }
  return { allowed: true, reason: "allowed", entitlementId: entitlement.id };
}

export function evaluateDataPermissions(
  entitlements: DataEntitlement[],
  scope: DataPermissionScope,
  operations: DataOperation[],
  at: string,
  consumer: DataConsumerContext | null | undefined,
  satisfiedConditions: string[] = []
): PermissionDecision[] {
  return operations.map((operation) => evaluateDataPermission(entitlements, scope, operation, at, consumer, satisfiedConditions));
}

export function createSyntheticDemoEntitlement(input: {
  providerId: string;
  dataset: string;
  market: string;
}): DataEntitlement {
  const states: DataEntitlement["permissions"] = {
    retrieval: { state: "allowed" },
    storage: { state: "allowed" },
    display: { state: "allowed" },
    derivation: { state: "allowed" },
    "ai-processing": { state: "allowed" },
    retention: { state: "allowed" },
    redistribution: { state: "denied" }
  };
  return {
    id: `demo:${input.providerId}:${input.dataset}:${input.market}`,
    providerId: input.providerId,
    dataset: input.dataset,
    market: input.market,
    contractRef: "aynox-synthetic-demo-content",
    contractVersion: "1",
    dataEnvironment: "synthetic",
    effectiveFrom: "2020-01-01T00:00:00.000Z",
    authorizedEnvironments: ["synthetic"],
    permissions: states,
    permittedAudience: "demo-only"
  };
}

function isKnownEnvironment(value: unknown): value is DataConsumerContext["environment"] {
  return value === "synthetic" || value === "development-restricted" || value === "production-licensed";
}

function isKnownAudience(value: unknown): value is DataConsumerContext["audience"] {
  return value === "internal" || value === "named-customer" || value === "public" || value === "demo-only";
}

function matchesScope(entitlement: DataEntitlement, scope: DataPermissionScope): boolean {
  return entitlement.providerId === scope.providerId
    && entitlement.dataset === scope.dataset
    && entitlement.market === scope.market
    && entitlement.contractRef === scope.contractRef
    && entitlement.contractVersion === scope.contractVersion;
}
