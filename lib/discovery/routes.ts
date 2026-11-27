import { demoSecurities } from "@/lib/data/demo-data";
import type { DiscoveryFilters } from "@/lib/discovery/search-securities";

export const defaultDiscoveryFilters: DiscoveryFilters = {
  query: "",
  exchange: "All exchanges",
  sector: "All sectors",
  country: "All countries"
};

type SearchParamValues = URLSearchParams | Record<string, string | string[] | undefined>;

function readParam(params: SearchParamValues, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

export function discoveryFiltersFromParams(params: SearchParamValues): DiscoveryFilters {
  const query = readParam(params, "q")?.trim().slice(0, 100) ?? "";
  const exchange = readParam(params, "exchange");
  const sector = readParam(params, "sector");
  const country = readParam(params, "country");

  return {
    query,
    exchange: exchange && demoSecurities.some((security) => security.exchange === exchange) ? exchange : defaultDiscoveryFilters.exchange,
    sector: sector && demoSecurities.some((security) => security.sector === sector) ? sector : defaultDiscoveryFilters.sector,
    country: country && demoSecurities.some((security) => security.country === country) ? country : defaultDiscoveryFilters.country
  };
}

export function buildDiscoverHref(filters: DiscoveryFilters = defaultDiscoveryFilters): string {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set("q", filters.query.trim().slice(0, 100));
  if (filters.exchange !== defaultDiscoveryFilters.exchange) params.set("exchange", filters.exchange);
  if (filters.sector !== defaultDiscoveryFilters.sector) params.set("sector", filters.sector);
  if (filters.country !== defaultDiscoveryFilters.country) params.set("country", filters.country);
  const query = params.toString();
  return query ? `/discover?${query}` : "/discover";
}

export function buildSecurityHref(symbol: string, filters: DiscoveryFilters = defaultDiscoveryFilters): string {
  const security = demoSecurities.find((item) => item.symbol === symbol);
  if (!security) return buildDiscoverHref(filters);

  const params = new URLSearchParams(buildDiscoverHref(filters).split("?")[1] ?? "");
  const query = params.toString();
  return `/discover/${encodeURIComponent(security.symbol)}${query ? `?${query}` : ""}`;
}

export function buildResearchHref(symbol: string): string {
  const security = demoSecurities.find((item) => item.symbol === symbol);
  return security ? `/research?symbol=${encodeURIComponent(security.symbol)}` : "/research";
}

export function discoveryReturnHref(params: SearchParamValues): string {
  return buildDiscoverHref(discoveryFiltersFromParams(params));
}
