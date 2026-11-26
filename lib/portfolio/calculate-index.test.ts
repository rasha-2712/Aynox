import { describe, expect, it } from "vitest";
import { calculateEqualWeightedIndex } from "@/lib/portfolio/calculate-index";
import type { ConstituentPriceSeries, MembershipInterval } from "@/types/market";

const members = (ids: string[], from = "2025-12-31T00:00:00.000Z"): MembershipInterval[] => ids.map((securityId) => ({ securityId, effectiveFrom: from, effectiveTo: null }));
const series = (securityId: string, points: ConstituentPriceSeries["points"]): ConstituentPriceSeries => ({ securityId, symbol: securityId, currency: "USD", points });

describe("calculateEqualWeightedIndex", () => {
  it("compounds the mean of equally weighted local-currency returns from a base of 100", () => {
    const prices = [
      series("AAA", [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: 110 }, { date: "2026-01-03", price: 121 }]),
      series("BBB", [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: 90 }, { date: "2026-01-03", price: 99 }])
    ];
    const result = calculateEqualWeightedIndex(prices, members(["AAA", "BBB"]));
    expect(result.map((point) => point.value)).toEqual([100, 100, 110]);
    expect(result[1]).toMatchObject({ eligible: 2, total: 2 });
  });

  it("excludes a missing constituent price and equally reweights valid returns", () => {
    const prices = [
      series("AAA", [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: 110 }, { date: "2026-01-03", price: 121 }]),
      series("BBB", [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: null }, { date: "2026-01-03", price: 120 }])
    ];
    const result = calculateEqualWeightedIndex(prices, members(["AAA", "BBB"]));
    expect(result[1]).toMatchObject({ value: 110, eligible: 1, total: 2 });
    expect(result[2]).toMatchObject({ value: 121, eligible: 1, total: 2 });
  });

  it("returns a gap rather than substituting zero when no valid prices are eligible", () => {
    const prices = [series("AAA", [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: null }, { date: "2026-01-03", price: 120 }])];
    const result = calculateEqualWeightedIndex(prices, members(["AAA"]));
    expect(result[1]).toMatchObject({ date: "2026-01-02", value: null, eligible: 0, total: 1 });
    expect(result[2]).toMatchObject({ value: null, eligible: 0, total: 1 });
  });

  it("does not let a newly added stock contribute to earlier index intervals", () => {
    const prices = [
      series("AAA", [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: 110 }, { date: "2026-01-03", price: 121 }]),
      series("BBB", [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: 200 }, { date: "2026-01-03", price: 400 }])
    ];
    const result = calculateEqualWeightedIndex(prices, [
      ...members(["AAA"]),
      { securityId: "BBB", effectiveFrom: "2026-01-02T12:00:00.000Z", effectiveTo: null }
    ]);
    expect(result[1]).toMatchObject({ value: 110, eligible: 1, total: 1 });
    expect(result[2]).toMatchObject({ value: 170.5, eligible: 2, total: 2 });
  });

  it("preserves returns before a security's effective removal interval", () => {
    const prices = [
      series("AAA", [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: 110 }, { date: "2026-01-03", price: 121 }]),
      series("BBB", [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: 120 }, { date: "2026-01-03", price: 150 }])
    ];
    const result = calculateEqualWeightedIndex(prices, [
      ...members(["AAA"]),
      { securityId: "BBB", effectiveFrom: "2025-12-31T00:00:00.000Z", effectiveTo: "2026-01-03T12:00:00.000Z" }
    ]);
    expect(result[1]).toMatchObject({ value: 115, eligible: 2, total: 2 });
    expect(result[2]).toMatchObject({ value: 126.5, eligible: 1, total: 2 });
  });

  it("uses each constituent's own observation calendar without carrying stale prices", () => {
    const prices = [
      series("AAA", [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: 110 }, { date: "2026-01-04", price: 121 }]),
      series("BBB", [{ date: "2026-01-01", price: 100 }, { date: "2026-01-03", price: 120 }, { date: "2026-01-04", price: 132 }])
    ];
    const result = calculateEqualWeightedIndex(prices, members(["AAA", "BBB"]));
    expect(result.find((point) => point.date === "2026-01-02")).toMatchObject({ eligible: 1, total: 1 });
    expect(result.find((point) => point.date === "2026-01-03")).toMatchObject({ eligible: 1, total: 1 });
    expect(result.find((point) => point.date === "2026-01-04")).toMatchObject({ eligible: 2, total: 2 });
  });

  it("does not generate values when the portfolio has no members or eligible prices", () => {
    const prices = [series("AAA", [{ date: "2026-01-01", price: 100 }, { date: "2026-01-02", price: 110 }])];
    expect(calculateEqualWeightedIndex(prices, [])).toEqual([]);
    expect(calculateEqualWeightedIndex(prices, [{ securityId: "BBB", effectiveFrom: "2025-12-31T00:00:00.000Z", effectiveTo: null }]).every((point) => point.value === null)).toBe(true);
  });
});
