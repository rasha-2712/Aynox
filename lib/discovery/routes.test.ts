import { describe, expect, it } from "vitest";
import { buildDiscoverHref, buildResearchHref, buildSecurityHref, defaultDiscoveryFilters, discoveryFiltersFromParams, discoveryReturnHref } from "@/lib/discovery/routes";

describe("discovery navigation routes", () => {
  it("keeps search and valid filters in the URL when opening a security", () => {
    const filters = { ...defaultDiscoveryFilters, query: "chip maker", exchange: "NASDAQ", sector: "Semiconductors", country: "United States" };
    expect(buildSecurityHref("NVDA", filters)).toBe("/discover/NVDA?q=chip+maker&exchange=NASDAQ&sector=Semiconductors&country=United+States");
  });

  it("restores a valid discovery URL on return from a security detail", () => {
    expect(discoveryReturnHref({ q: "chip maker", exchange: "NASDAQ", sector: "Semiconductors", country: "United States" }))
      .toBe("/discover?q=chip+maker&exchange=NASDAQ&sector=Semiconductors&country=United+States");
  });

  it("opens full company research for the selected detail symbol", () => {
    expect(buildResearchHref("NVDA")).toBe("/research?symbol=NVDA");
    expect(buildResearchHref("UNKNOWN")).toBe("/research");
  });

  it("rejects unknown filter values and limits restored query text", () => {
    const filters = discoveryFiltersFromParams(new URLSearchParams("q=" + "x".repeat(150) + "&exchange=https%3A%2F%2Fevil.example&sector=unknown&country=unknown"));
    expect(filters).toEqual({ ...defaultDiscoveryFilters, query: "x".repeat(100) });
    expect(buildDiscoverHref(filters)).toBe(`/discover?q=${"x".repeat(100)}`);
  });

  it("does not build detail links for unknown symbols", () => {
    expect(buildSecurityHref("UNKNOWN", { ...defaultDiscoveryFilters, query: "ASML" })).toBe("/discover?q=ASML");
  });

  it("builds the default Discover destination for global navigation and empty states", () => {
    expect(buildDiscoverHref()).toBe("/discover");
  });
});
