import "server-only";
import { randomUUID } from "node:crypto";
import { demoSecurities } from "@/lib/data/demo-data";
import { resolveResearchAuthorization } from "@/lib/research/authorization.server";
import type {
  ResearchDeploymentEnvironment,
  TrustedResearchRequestContext
} from "@/types/research-context";

const ENVIRONMENTS: readonly ResearchDeploymentEnvironment[] = ["development", "test", "demo", "production"];
const SECURITY_ID = /^[A-Z]{2}:[A-Z0-9]{2,8}:[A-Z0-9._-]{1,32}$/;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const trustedContexts = new WeakSet<object>();
const CONTEXT_KEYS = ["deploymentEnvironment", "audience", "principalId", "authorizationScopeId", "authorizedSecurityId", "createdAt", "requestId"] as const;

export type ResearchRequestContextError =
  | "environment_unavailable"
  | "invalid_environment"
  | "unauthenticated"
  | "authorization_unavailable"
  | "invalid_security_id"
  | "security_not_authorized"
  | "invalid_context"
  | "untrusted_context"
  | "invalid_environment_audience"
  | "invalid_authorization_claims"
  | "invalid_principal"
  | "invalid_authorization_scope"
  | "invalid_request_id"
  | "invalid_timestamp"
  | "context_mismatch:deploymentEnvironment"
  | "context_mismatch:audience"
  | "context_mismatch:principalId"
  | "context_mismatch:authorizationScopeId"
  | "context_mismatch:authorizedSecurityId"
  | "context_mismatch:createdAt"
  | "context_mismatch:requestId";

export type ResearchRequestContextResolution =
  | { readonly ok: true; readonly context: TrustedResearchRequestContext }
  | { readonly ok: false; readonly status: "unauthenticated" | "unavailable" | "invalid-request" | "forbidden"; readonly errors: readonly ResearchRequestContextError[] };

export type ResearchRequestContextValidation =
  | { readonly ok: true; readonly context: TrustedResearchRequestContext }
  | { readonly ok: false; readonly errors: readonly ResearchRequestContextError[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER.test(value) && value.trim() === value;
}

function isEnvironment(value: unknown): value is ResearchDeploymentEnvironment {
  return typeof value === "string" && ENVIRONMENTS.includes(value as ResearchDeploymentEnvironment);
}

function deploymentEnvironment(): { value?: ResearchDeploymentEnvironment; error?: ResearchRequestContextError } {
  const nodeEnvironment = process.env.NODE_ENV;
  if (nodeEnvironment !== "development" && nodeEnvironment !== "test" && nodeEnvironment !== "production") {
    return { error: nodeEnvironment === undefined ? "environment_unavailable" : "invalid_environment" };
  }

  const configured = process.env.AYNOX_DEPLOYMENT_ENV;
  if (configured !== undefined) {
    if (!isEnvironment(configured)) return { error: "invalid_environment" };
    if (nodeEnvironment === "production" && configured !== "production") return { error: "invalid_environment" };
    if (nodeEnvironment === "development" && configured !== "development" && configured !== "demo") return { error: "invalid_environment" };
    if (nodeEnvironment === "test" && configured !== "test" && configured !== "demo") return { error: "invalid_environment" };
    return { value: configured };
  }

  return { value: nodeEnvironment };
}

function requestedSecurityId(input: unknown): string | null {
  if (!isRecord(input) || typeof input.securityId !== "string" || !SECURITY_ID.test(input.securityId)) return null;
  return input.securityId;
}

function issueContext(input: Omit<TrustedResearchRequestContext, "createdAt" | "requestId">): TrustedResearchRequestContext {
  const context = Object.freeze({ ...input, createdAt: new Date().toISOString(), requestId: randomUUID() });
  trustedContexts.add(context);
  return context;
}

function isValidTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function contextShapeErrors(value: unknown): ResearchRequestContextError[] {
  const errors: ResearchRequestContextError[] = [];
  if (!isRecord(value)) return ["invalid_context"];
  const keys = Object.keys(value);
  if (keys.length !== CONTEXT_KEYS.length || keys.some((key) => !CONTEXT_KEYS.includes(key as typeof CONTEXT_KEYS[number]))) errors.push("invalid_context");
  if (!isEnvironment(value.deploymentEnvironment)) errors.push("invalid_environment");
  const isDemo = value.audience === "internal-demo";
  const isCustomer = value.audience === "authenticated-customer";
  if (!isDemo && !isCustomer) errors.push("invalid_environment_audience");
  if (isDemo) {
    if (!(value.deploymentEnvironment === "development" || value.deploymentEnvironment === "test" || value.deploymentEnvironment === "demo")
        || value.principalId !== null || value.authorizationScopeId !== null) errors.push("invalid_environment_audience");
  } else if (isCustomer) {
    if (value.deploymentEnvironment !== "production") errors.push("invalid_environment_audience");
    if (!isIdentifier(value.principalId)) errors.push("invalid_principal");
    if (!isIdentifier(value.authorizationScopeId)) errors.push("invalid_authorization_scope");
  }
  if (typeof value.authorizedSecurityId !== "string" || !SECURITY_ID.test(value.authorizedSecurityId)) errors.push("invalid_security_id");
  if (typeof value.createdAt !== "string" || !isValidTimestamp(value.createdAt)) errors.push("invalid_timestamp");
  if (typeof value.requestId !== "string" || !UUID.test(value.requestId)) errors.push("invalid_request_id");
  return errors;
}

/**
 * Resolves authority from server-owned deployment configuration and the server auth adapter.
 * `input` is untrusted request data; only its canonical securityId field is read.
 */
export async function resolveTrustedResearchRequestContext(
  request: Request,
  input: unknown
): Promise<ResearchRequestContextResolution> {
  const deployment = deploymentEnvironment();
  if (!deployment.value) return { ok: false, status: "unavailable", errors: [deployment.error ?? "environment_unavailable"] };

  const securityId = requestedSecurityId(input);
  if (!securityId) return { ok: false, status: "invalid-request", errors: ["invalid_security_id"] };

  if (deployment.value !== "production") {
    if (!demoSecurities.some((security) => security.id === securityId)) {
      return { ok: false, status: "forbidden", errors: ["security_not_authorized"] };
    }
    const context = issueContext({
      deploymentEnvironment: deployment.value,
      audience: "internal-demo",
      principalId: null,
      authorizationScopeId: null,
      authorizedSecurityId: securityId
    });
    return { ok: true, context };
  }

  try {
    const authorization: unknown = await resolveResearchAuthorization(request);
    if (!isRecord(authorization)) return { ok: false, status: "unavailable", errors: ["authorization_unavailable"] };
    if (authorization.status === "unavailable") return { ok: false, status: "unavailable", errors: ["authorization_unavailable"] };
    if (authorization.status === "unauthenticated") return { ok: false, status: "unauthenticated", errors: ["unauthenticated"] };
    if (authorization.status !== "authenticated" || !isRecord(authorization.grant)) {
      return { ok: false, status: "unavailable", errors: ["authorization_unavailable"] };
    }

    const grant = authorization.grant;
    if (grant.audience !== "authenticated-customer" || !isIdentifier(grant.principalId) || !isIdentifier(grant.authorizationScopeId)) {
      return { ok: false, status: "unauthenticated", errors: ["invalid_authorization_claims"] };
    }
    if (!Array.isArray(grant.authorizedSecurityIds) || !grant.authorizedSecurityIds.every((id) => typeof id === "string" && SECURITY_ID.test(id))) {
      return { ok: false, status: "unauthenticated", errors: ["invalid_authorization_claims"] };
    }
    if (!grant.authorizedSecurityIds.includes(securityId)) {
      return { ok: false, status: "forbidden", errors: ["security_not_authorized"] };
    }

    return {
      ok: true,
      context: issueContext({
        deploymentEnvironment: deployment.value,
        audience: "authenticated-customer",
        principalId: grant.principalId,
        authorizationScopeId: grant.authorizationScopeId,
        authorizedSecurityId: securityId
      })
    };
  } catch {
    // Keep credentials, provider payloads and exception messages out of logs and caller-visible errors.
    console.error("[research-auth] Authorization adapter failed; request denied.", { reason: "adapter_failure" });
    return { ok: false, status: "unavailable", errors: ["authorization_unavailable"] };
  }
}

/** Confirms issuance, runtime shape, and optional exact request-context binding. */
export function validateTrustedResearchRequestContext(
  value: unknown,
  expectedContext?: unknown
): ResearchRequestContextValidation {
  const errors = contextShapeErrors(value);
  if (!isRecord(value) || !trustedContexts.has(value)) errors.push("untrusted_context");
  if (expectedContext !== undefined) {
    if (!isRecord(expectedContext)) errors.push("untrusted_context");
    else {
      if (!trustedContexts.has(expectedContext)) errors.push("untrusted_context");
      if (isRecord(value)) {
        for (const key of ["deploymentEnvironment", "audience", "principalId", "authorizationScopeId", "authorizedSecurityId", "createdAt", "requestId"] as const) {
          if (value[key] !== expectedContext[key]) errors.push(`context_mismatch:${key}`);
        }
      }
    }
  }
  return errors.length
    ? { ok: false, errors: [...new Set(errors)] }
    : { ok: true, context: value as unknown as TrustedResearchRequestContext };
}
