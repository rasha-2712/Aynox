import "server-only";
import type { TrustedResearchRequestContext } from "@/types/research-context";

/** Production has no synthetic entitlement exception. Tests substitute an explicit fixture-only policy. */
export function isSyntheticEvidenceFixtureAllowed(_context: TrustedResearchRequestContext): boolean {
  void _context;
  return false;
}
