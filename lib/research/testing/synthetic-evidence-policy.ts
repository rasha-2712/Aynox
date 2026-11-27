import type { TrustedResearchRequestContext } from "@/types/research-context";

/** Vitest-only policy: synthetic fixtures are permitted only in test-issued internal-demo contexts. */
export function isSyntheticEvidenceFixtureAllowed(context: TrustedResearchRequestContext): boolean {
  return context.deploymentEnvironment === "test" && context.audience === "internal-demo"
    && context.principalId === null && context.authorizationScopeId === null;
}
