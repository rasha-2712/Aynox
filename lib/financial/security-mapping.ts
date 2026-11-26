import type { Security } from "@/types/market";
import type { ProviderSecurityMapping, SecurityIdentity, SecurityMappingResolution } from "@/types/financial";

/** Resolve only by canonical security ID and explicit provider mapping, never by display name. */
export function resolveProviderSecurityMapping(
  identity: SecurityIdentity,
  providerId: string,
  mappings: ProviderSecurityMapping[]
): SecurityMappingResolution {
  const candidates = mappings.filter((mapping) =>
    mapping.providerId === providerId && mapping.securityId === identity.securityId
  );
  if (candidates.length === 0) {
    return { status: "unsupported", reason: `No ${providerId} mapping exists for ${identity.securityId}.` };
  }
  if (candidates.length > 1) {
    return { status: "ambiguous", candidates, reason: "More than one provider mapping matches the canonical security." };
  }

  const [mapping] = candidates;
  if (mapping.status === "ambiguous") {
    return { status: "ambiguous", candidates, reason: "The provider mapping is explicitly marked ambiguous." };
  }
  if (mapping.status === "unsupported") {
    return { status: "unsupported", reason: "The provider mapping is explicitly unsupported." };
  }
  if (!mapping.providerId.trim() || !mapping.securityId.trim() || !mapping.providerSymbol.trim()
      || !mapping.providerExchange.trim() || (!mapping.providerSymbol.trim() && !mapping.providerSecurityId?.trim())
      || !mapping.mappingSource.trim()) {
    return { status: "unsupported", reason: "The confirmed provider mapping is missing required provider identifiers or mapping provenance." };
  }
  if (normalize(mapping.canonicalSymbol) !== normalize(identity.symbol)
      || normalize(mapping.canonicalExchange) !== normalize(identity.exchange)) {
    return { status: "ambiguous", candidates, reason: "The stored canonical symbol or exchange does not match the requested security." };
  }
  return { status: "resolved", mapping };
}

export function securityIdentityFromSecurity(security: Pick<Security, "id" | "symbol" | "exchange" | "currency">): SecurityIdentity {
  return { securityId: security.id, symbol: security.symbol, exchange: security.exchange, currency: security.currency };
}

function normalize(value: string): string {
  return value.trim().toLocaleUpperCase("en-US");
}
