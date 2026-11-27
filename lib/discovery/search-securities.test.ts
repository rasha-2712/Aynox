import { describe, expect, it } from "vitest";
import { demoSecurities } from "@/lib/data/demo-data";
import { searchSecurities } from "@/lib/discovery/search-securities";

const base = { query: "", exchange: "All exchanges", sector: "All sectors", country: "All countries" };

describe("searchSecurities", () => {
  it("searches by company name", () => {
    expect(searchSecurities(demoSecurities, { ...base, query: "nvidia" }).map((item) => item.symbol)).toEqual(["NVDA"]);
  });

  it("searches by ticker", () => {
    expect(searchSecurities(demoSecurities, { ...base, query: "aapl" }).map((item) => item.symbol)).toEqual(["AAPL"]);
  });

  it("searches by exchange and filters by exchange", () => {
    expect(searchSecurities(demoSecurities, { ...base, query: "nasdaq", exchange: "NASDAQ" }).map((item) => item.symbol)).toEqual(["NVDA", "MSFT", "AAPL", "AMZN", "GOOGL"]);
  });

  it("filters by sector and country", () => {
    expect(searchSecurities(demoSecurities, { ...base, sector: "Semiconductors", country: "Netherlands" }).map((item) => item.symbol)).toEqual(["ASML"]);
  });

  it("returns no results for an unmatched search so the no-results state can guide recovery", () => {
    expect(searchSecurities(demoSecurities, { ...base, query: "no such company" })).toEqual([]);
  });
});
