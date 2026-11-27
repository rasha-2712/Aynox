import "server-only";
import type { KeyObject } from "node:crypto";

/** Production trust roots are intentionally empty pending an approved issuer integration. */
export function getTechnicalEntitlementPublicKey(_issuerId: string, _keyId: string): KeyObject | null {
  void _issuerId;
  void _keyId;
  return null;
}
