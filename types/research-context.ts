export type ResearchDeploymentEnvironment = "development" | "test" | "demo" | "production";
export type ResearchRequestAudience = "internal-demo" | "authenticated-customer";

/** Server-derived request authority. Instances are issued and frozen by the server resolver. */
export interface TrustedResearchRequestContext {
  readonly deploymentEnvironment: ResearchDeploymentEnvironment;
  readonly audience: ResearchRequestAudience;
  readonly principalId: string | null;
  readonly authorizationScopeId: string | null;
  readonly authorizedSecurityId: string;
  readonly createdAt: string;
  readonly requestId: string;
}

/** Privacy-preserving commitment to every field of the trusted request context. */
export interface ResearchSnapshotContextBinding {
  readonly requestId: string;
  readonly authorizedSecurityId: string;
  readonly digest: string;
}
