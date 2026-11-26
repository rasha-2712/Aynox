import type { Security } from "@/types/market";

export interface DiscoveryFilters {
  query: string;
  exchange: string;
  sector: string;
  country: string;
}

export function searchSecurities(securities: Security[], filters: DiscoveryFilters): Security[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return securities.filter((security) => {
    const matchesQuery = !query || [security.name, security.symbol, security.exchange]
      .some((value) => value.toLocaleLowerCase().includes(query));
    return matchesQuery
      && (filters.exchange === "All exchanges" || security.exchange === filters.exchange)
      && (filters.sector === "All sectors" || security.sector === filters.sector)
      && (filters.country === "All countries" || security.country === filters.country);
  });
}

export function hasActiveFilters(filters: DiscoveryFilters): boolean {
  return Boolean(filters.query.trim())
    || filters.exchange !== "All exchanges"
    || filters.sector !== "All sectors"
    || filters.country !== "All countries";
}
