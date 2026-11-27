import type { KeyObject } from "node:crypto";

const testIssuerKeys = new Map<string, Map<string, KeyObject>>();

/** Vitest-only test root registration. This module is reachable only through vitest.config.ts. */
export function registerTestEntitlementPublicKey(issuerId: string, keyId: string, publicKey: KeyObject): void {
  const keys = testIssuerKeys.get(issuerId) ?? new Map<string, KeyObject>();
  keys.set(keyId, publicKey);
  testIssuerKeys.set(issuerId, keys);
}

export function getTechnicalEntitlementPublicKey(issuerId: string, keyId: string): KeyObject | null {
  return testIssuerKeys.get(issuerId)?.get(keyId) ?? null;
}
