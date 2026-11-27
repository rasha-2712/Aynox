import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResearchAuthorizationResult } from "@/lib/research/authorization.server";

vi.mock("@/lib/research/authorization.server", () => ({
  resolveResearchAuthorization: vi.fn(async () => ({ status: "unavailable" }))
}));

import { resolveResearchAuthorization } from "@/lib/research/authorization.server";
import { resolveTrustedResearchRequestContext, validateTrustedResearchRequestContext } from "@/lib/research/request-context.server";

const NVDA = "US:XNAS:NVDA";
const AAPL = "US:XNAS:AAPL";
const endpoint = "https://aynox.example/api/research";
const request = () => new Request(endpoint);

function grant(principalId: string, authorizationScopeId: string, authorizedSecurityIds: string[] = [NVDA]): ResearchAuthorizationResult {
  return {
    status: "authenticated",
    grant: { audience: "authenticated-customer", principalId, authorizationScopeId, authorizedSecurityIds }
  };
}

async function demoContext(securityId = NVDA) {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("AYNOX_DEPLOYMENT_ENV", "demo");
  vi.mocked(resolveResearchAuthorization).mockResolvedValue({ status: "unavailable" });
  return resolveTrustedResearchRequestContext(request(), { securityId });
}

async function productionContext(result: ResearchAuthorizationResult, securityId = NVDA) {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("AYNOX_DEPLOYMENT_ENV", "production");
  vi.mocked(resolveResearchAuthorization).mockResolvedValue(result);
  return resolveTrustedResearchRequestContext(request(), { securityId });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("trusted research request context", () => {
  it("creates a valid internal demo context from server configuration and the demo catalogue", async () => {
    const result = await demoContext();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context).toMatchObject({
      deploymentEnvironment: "demo",
      audience: "internal-demo",
      principalId: null,
      authorizationScopeId: null,
      authorizedSecurityId: NVDA
    });
    expect(validateTrustedResearchRequestContext(result.context).ok).toBe(true);
    expect(resolveResearchAuthorization).not.toHaveBeenCalled();
  });

  it("creates a production customer context only from trusted authorization-adapter claims", async () => {
    const result = await productionContext(grant("principal-17", "account-42"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context).toMatchObject({
      deploymentEnvironment: "production",
      audience: "authenticated-customer",
      principalId: "principal-17",
      authorizationScopeId: "account-42",
      authorizedSecurityId: NVDA
    });
    expect(validateTrustedResearchRequestContext(result.context).ok).toBe(true);
  });

  it("fails closed for unauthenticated or unavailable production authorization", async () => {
    const result = await productionContext({ status: "unauthenticated" });
    expect(result).toEqual({ ok: false, status: "unauthenticated", errors: ["unauthenticated"] });
    const unavailable = await productionContext({ status: "unavailable" });
    expect(unavailable).toEqual({ ok: false, status: "unavailable", errors: ["authorization_unavailable"] });
  });

  it("ignores client-supplied environment, audience, identity, scope, provider and permission claims", async () => {
    vi.stubEnv("AYNOX_DEPLOYMENT_ENV", "demo");
    const result = await resolveTrustedResearchRequestContext(request(), {
      securityId: NVDA,
      deploymentEnvironment: "production",
      environment: "production",
      audience: "authenticated-customer",
      principalId: "client-admin",
      authorizationScopeId: "client-account",
      providerId: "client-provider",
      entitlements: [{ permissions: { "ai-processing": { state: "allowed" } } }]
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.context).toMatchObject({ deploymentEnvironment: "demo", audience: "internal-demo", principalId: null, authorizationScopeId: null });

    const productionSpoof = await productionContext({ status: "unavailable" });
    expect(productionSpoof.ok).toBe(false);
  });

  it("rejects demo-to-production context reuse", async () => {
    const demo = await demoContext();
    const production = await productionContext(grant("principal-17", "account-42"));
    expect(demo.ok && production.ok).toBe(true);
    if (!demo.ok || !production.ok) return;
    const result = validateTrustedResearchRequestContext(demo.context, production.context);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("context_mismatch:deploymentEnvironment");
      expect(result.errors).toContain("context_mismatch:audience");
    }
  });

  it("rejects reuse across principals and account scopes", async () => {
    const first = await productionContext(grant("principal-17", "account-42"));
    const second = await productionContext(grant("principal-18", "account-42"));
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    const principalMismatch = validateTrustedResearchRequestContext(first.context, second.context);
    expect(principalMismatch.ok).toBe(false);
    if (!principalMismatch.ok) expect(principalMismatch.errors).toContain("context_mismatch:principalId");

    const otherAccount = await productionContext(grant("principal-17", "account-99"));
    expect(otherAccount.ok).toBe(true);
    if (!otherAccount.ok) return;
    const scopeMismatch = validateTrustedResearchRequestContext(first.context, otherAccount.context);
    expect(scopeMismatch.ok).toBe(false);
    if (!scopeMismatch.ok) expect(scopeMismatch.errors).toContain("context_mismatch:authorizationScopeId");
  });

  it("rejects reuse for a different canonical security", async () => {
    const nvda = await demoContext(NVDA);
    const aapl = await demoContext(AAPL);
    expect(nvda.ok && aapl.ok).toBe(true);
    if (!nvda.ok || !aapl.ok) return;
    const result = validateTrustedResearchRequestContext(nvda.context, aapl.context);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("context_mismatch:authorizedSecurityId");
  });

  it("rejects unauthorized and malformed requested security identifiers", async () => {
    const notInDemoCatalogue = await demoContext("US:XNAS:FAKE");
    expect(notInDemoCatalogue).toEqual({ ok: false, status: "forbidden", errors: ["security_not_authorized"] });
    const malformed = await resolveTrustedResearchRequestContext(request(), { securityId: "NVDA" });
    expect(malformed).toEqual({ ok: false, status: "invalid-request", errors: ["invalid_security_id"] });
    const omitted = await resolveTrustedResearchRequestContext(request(), { audience: "internal-demo" });
    expect(omitted).toEqual({ ok: false, status: "invalid-request", errors: ["invalid_security_id"] });
  });

  it("fails closed on invalid or missing deployment configuration", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AYNOX_DEPLOYMENT_ENV", "staging");
    expect(await resolveTrustedResearchRequestContext(request(), { securityId: NVDA }))
      .toEqual({ ok: false, status: "unavailable", errors: ["invalid_environment"] });
    vi.stubEnv("AYNOX_DEPLOYMENT_ENV", "");
    expect(await resolveTrustedResearchRequestContext(request(), { securityId: NVDA }))
      .toEqual({ ok: false, status: "unavailable", errors: ["invalid_environment"] });

    vi.stubEnv("NODE_ENV", "invalid-runtime");
    vi.stubEnv("AYNOX_DEPLOYMENT_ENV", "demo");
    expect(await resolveTrustedResearchRequestContext(request(), { securityId: NVDA }))
      .toEqual({ ok: false, status: "unavailable", errors: ["invalid_environment"] });
  });

  it.each(["demo", "development"] as const)(
    "rejects NODE_ENV=production with AYNOX_DEPLOYMENT_ENV=%s",
    async (deploymentEnvironment) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("AYNOX_DEPLOYMENT_ENV", deploymentEnvironment);
      const result = await resolveTrustedResearchRequestContext(request(), { securityId: NVDA });
      expect(result).toEqual({ ok: false, status: "unavailable", errors: ["invalid_environment"] });
      expect(resolveResearchAuthorization).not.toHaveBeenCalled();
    }
  );

  it("rejects malformed contexts, invalid environment/audience combinations, timestamps and request IDs", async () => {
    const valid = await demoContext();
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;
    const base = { ...valid.context };
    const cases: Array<{ value: Record<string, unknown>; error: string }> = [
      { value: { ...base, deploymentEnvironment: undefined }, error: "invalid_environment" },
      { value: { ...base, audience: undefined }, error: "invalid_environment_audience" },
      { value: { ...base, audience: "customer" }, error: "invalid_environment_audience" },
      { value: { ...base, deploymentEnvironment: "production" }, error: "invalid_environment_audience" },
      { value: { ...base, deploymentEnvironment: "production", audience: "authenticated-customer", principalId: undefined, authorizationScopeId: "account-1" }, error: "invalid_principal" },
      { value: { ...base, deploymentEnvironment: "production", audience: "authenticated-customer", principalId: "principal-1", authorizationScopeId: undefined }, error: "invalid_authorization_scope" },
      { value: { ...base, authorizedSecurityId: "NVDA" }, error: "invalid_security_id" },
      { value: { ...base, authorizedSecurityId: undefined }, error: "invalid_security_id" },
      { value: { ...base, createdAt: "not-a-time" }, error: "invalid_timestamp" },
      { value: { ...base, createdAt: undefined }, error: "invalid_timestamp" },
      { value: { ...base, requestId: "client-request-id" }, error: "invalid_request_id" },
      { value: { ...base, requestId: undefined }, error: "invalid_request_id" },
      { value: { ...base, unexpected: true }, error: "invalid_context" }
    ];
    for (const { value, error } of cases) {
      const result = validateTrustedResearchRequestContext(value);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors).toContain(error);
    }
  });

  it("rejects client-authored production claims even when the request includes spoofed headers", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AYNOX_DEPLOYMENT_ENV", "production");
    vi.mocked(resolveResearchAuthorization).mockResolvedValue({ status: "unauthenticated" });
    const spoofedRequest = new Request(endpoint, {
      headers: { "x-aynox-environment": "production", "x-aynox-audience": "authenticated-customer", "x-aynox-principal": "principal-17" }
    });
    const result = await resolveTrustedResearchRequestContext(spoofedRequest, {
      securityId: NVDA,
      environment: "production",
      deploymentEnvironment: "production",
      audience: "authenticated-customer",
      principalId: "principal-17",
      authorizationScopeId: "account-42",
      grant: { audience: "authenticated-customer", principalId: "principal-17", authorizationScopeId: "account-42", authorizedSecurityIds: [NVDA] },
      providerId: "forged-provider",
      permissions: { "ai-processing": { allowed: true } }
    });
    expect(result).toEqual({ ok: false, status: "unauthenticated", errors: ["unauthenticated"] });
  });

  it("rejects malformed production authorization-adapter claims", async () => {
    const invalidResults: unknown[] = [
      { status: "authenticated", grant: { audience: "internal-demo", principalId: "principal-17", authorizationScopeId: "account-42", authorizedSecurityIds: [NVDA] } },
      { status: "authenticated", grant: { audience: "authenticated-customer", principalId: " ", authorizationScopeId: "account-42", authorizedSecurityIds: [NVDA] } },
      { status: "authenticated", grant: { audience: "authenticated-customer", principalId: "principal-17", authorizationScopeId: " ", authorizedSecurityIds: [NVDA] } },
      { status: "authenticated", grant: { audience: "authenticated-customer", principalId: "principal-17", authorizationScopeId: "account-42", authorizedSecurityIds: ["NVDA"] } },
      { status: "authenticated" },
      null
    ];
    for (const invalidResult of invalidResults) {
      const result = await productionContext(invalidResult as ResearchAuthorizationResult);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(["unauthenticated", "unavailable"]).toContain(result.status);
    }
  });

  it("normalizes a throwing or rejecting authorization adapter without exposing its exception", async () => {
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const internalFailure = new Error("sensitive adapter detail that must not escape");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AYNOX_DEPLOYMENT_ENV", "production");
    vi.mocked(resolveResearchAuthorization).mockRejectedValue(internalFailure);
    const result = await resolveTrustedResearchRequestContext(request(), { securityId: NVDA });
    expect(result).toEqual({ ok: false, status: "unavailable", errors: ["authorization_unavailable"] });
    expect(JSON.stringify(result)).not.toContain(internalFailure.message);
    expect(diagnostic).toHaveBeenCalledWith("[research-auth] Authorization adapter failed; request denied.", { reason: "adapter_failure" });
    diagnostic.mockRestore();
  });

  it("does not allow client data to authorize a security absent from production grant", async () => {
    const result = await productionContext(grant("principal-17", "account-42", [NVDA]), AAPL);
    expect(result).toEqual({ ok: false, status: "forbidden", errors: ["security_not_authorized"] });
  });

  it("freezes contexts and rejects modified or cloned context objects", async () => {
    const issued = await demoContext();
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    expect(Object.isFrozen(issued.context)).toBe(true);
    expect(Reflect.set(issued.context, "audience", "authenticated-customer")).toBe(false);
    expect(validateTrustedResearchRequestContext(issued.context).ok).toBe(true);

    const cloned = structuredClone(issued.context);
    expect(Reflect.set(cloned, "audience", "authenticated-customer")).toBe(true);
    const result = validateTrustedResearchRequestContext(cloned);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("untrusted_context");
  });

  it("rejects an exact request-context binding with a different creation timestamp", async () => {
    const issued = await demoContext();
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    const alteredExpectedContext = structuredClone(issued.context);
    expect(Reflect.set(alteredExpectedContext, "createdAt", "2026-01-01T00:00:00.000Z")).toBe(true);
    const result = validateTrustedResearchRequestContext(issued.context, alteredExpectedContext);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("context_mismatch:createdAt");
      expect(result.errors).toContain("untrusted_context");
    }
  });
});
