import "server-only";
import type { ResearchRequestAudience } from "@/types/research-context";

/** Claims returned by the future authenticated server adapter, never by a client payload. */
export interface ResearchAuthorizationGrant {
  readonly audience: ResearchRequestAudience;
  readonly principalId: string;
  readonly authorizationScopeId: string;
  readonly authorizedSecurityIds: readonly string[];
}

export type ResearchAuthorizationResult =
  | { readonly status: "authenticated"; readonly grant: ResearchAuthorizationGrant }
  | { readonly status: "unauthenticated" | "unavailable" };

/** Authentication is not integrated yet. Production authorization therefore fails closed. */
export async function resolveResearchAuthorization(request: Request): Promise<ResearchAuthorizationResult> {
  void request;
  return { status: "unavailable" };
}
