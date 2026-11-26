import { describe, expect, it } from "vitest";
import {
  absoluteDecimalString, addDecimalStrings, compareDecimalStrings, divideDecimalRatioAsPercentage, divideDecimalStrings,
  MAX_DECIMAL_FRACTIONAL_SCALE, MAX_DECIMAL_INPUT_LENGTH, MAX_DECIMAL_INTEGER_DIGITS, MAX_DIVISION_PRECISION,
  multiplyDecimalStrings, parseDecimalString, parseDecimalStringResult, roundDecimalString, subtractDecimalStrings
} from "@/lib/financial/decimal";
import { calculateFinancialMetric } from "@/lib/financial/calculation-engine";
import { financialFormulaCatalogue, getFinancialFormula, isFormulaDefinitionSupported } from "@/lib/financial/formula-catalogue";
import { createSyntheticDemoEntitlement } from "@/lib/financial/permissions";
import { deriveDiscreteQuarterFromYtd } from "@/lib/financial/period-normalization";
import type { FinancialObservation, ReportingPeriod } from "@/types/financial";

const CALCULATED_AT = "2026-11-26T10:00:00.000Z";
const syntheticContext = { consumer: { environment: "synthetic" as const, audience: "demo-only" as const }, calculatedAt: CALCULATED_AT };

describe("exact decimal operations", () => {
  it("adds, subtracts, multiplies, compares and takes absolute value without Number conversion", () => {
    expect(addDecimalStrings("9007199254740993.25", "0.75")).toBe("9007199254740994");
    expect(subtractDecimalStrings("255.10", "105.1")).toBe("150");
    expect(subtractDecimalStrings("-2.5", "4.25")).toBe("-6.75");
    expect(multiplyDecimalStrings("-12345678901234567890.125", "0.08")).toBe("-987654312098765431.21");
    expect(compareDecimalStrings("-0.0001", "0")).toBe(-1);
    expect(compareDecimalStrings("12.000", "12")).toBe(0);
    expect(absoluteDecimalString("-999999999999999999.01")).toBe("999999999999999999.01");
  });

  it("requires explicit division precision and rounds ties half-up away from zero", () => {
    expect(divideDecimalStrings("1", "8", 2)).toMatchObject({ status: "calculated", value: "0.13", decimalPlaces: 2, roundingMode: "half-up-away-from-zero" });
    expect(divideDecimalStrings("-1", "8", 2)).toMatchObject({ status: "calculated", value: "-0.13" });
    expect(divideDecimalStrings("1", "3", 6)).toMatchObject({ status: "calculated", value: "0.333333" });
    expect(divideDecimalStrings("1.00", "0", 3)).toEqual({ status: "zero_denominator" });
    expect(roundDecimalString("1.245", 2)).toBe("1.25");
    expect(roundDecimalString("-1.245", 2)).toBe("-1.25");
    expect(roundDecimalString("1.2", 4)).toBe("1.2");
  });

  it("rejects malformed canonical decimals instead of coercing them", () => {
    expect(parseDecimalString("1e6")).toBeNull();
    expect(() => addDecimalStrings("not-a-number", "1")).toThrow(TypeError);
    expect(() => divideDecimalStrings("1", "2", -1)).toThrow(RangeError);
  });

  it("accepts values at decimal input boundaries and rejects values beyond each limit", () => {
    const maximum = `-${"9".repeat(MAX_DECIMAL_INTEGER_DIGITS)}.${"8".repeat(MAX_DECIMAL_FRACTIONAL_SCALE)}`;
    expect(maximum.length).toBe(MAX_DECIMAL_INPUT_LENGTH);
    expect(parseDecimalStringResult(maximum).status).toBe("valid");
    expect(parseDecimalStringResult("9".repeat(MAX_DECIMAL_INTEGER_DIGITS + 1))).toEqual({ status: "invalid", reason: "integer-too-large" });
    expect(parseDecimalStringResult(`0.${"1".repeat(MAX_DECIMAL_FRACTIONAL_SCALE + 1)}`)).toEqual({ status: "invalid", reason: "scale-too-large" });
    expect(parseDecimalStringResult("1".repeat(MAX_DECIMAL_INPUT_LENGTH + 1))).toEqual({ status: "invalid", reason: "input-too-long" });
    expect(() => addDecimalStrings("9".repeat(MAX_DECIMAL_INTEGER_DIGITS + 1), "1")).toThrow(/integer-too-large/);
    expect(divideDecimalStrings("1", "3", MAX_DIVISION_PRECISION)).toMatchObject({ status: "calculated", decimalPlaces: MAX_DIVISION_PRECISION });
    expect(() => divideDecimalStrings("1", "3", MAX_DIVISION_PRECISION + 1)).toThrow(RangeError);
    expect(() => divideDecimalStrings("1", "3", 2, "round-half-to-even" as never)).toThrow(RangeError);
    expect(() => roundDecimalString("1.25", 2, "round-half-to-even" as never)).toThrow(RangeError);
  });

  it("applies exact percentage scaling with formula precision and signed ties", () => {
    expect(divideDecimalRatioAsPercentage("1", "16", 1)).toMatchObject({ status: "calculated", value: "6.3", decimalPlaces: 1, roundingMode: "half-up-away-from-zero" });
    expect(divideDecimalRatioAsPercentage("-1", "16", 1)).toMatchObject({ status: "calculated", value: "-6.3", decimalPlaces: 1 });
    expect(divideDecimalRatioAsPercentage("1", "0", 1)).toEqual({ status: "zero_denominator" });
  });
});

function financialObservation(input: {
  id: string; metricKey: string; value: string | null; category?: FinancialObservation["statementCategory"];
  basis?: ReportingPeriod["basis"]; start?: string | null; end?: string; fiscalYearId?: string | null;
  fiscalYearStart?: string | null; fiscalYearEnd?: string | null; fiscalYearBoundaryStatus?: ReportingPeriod["fiscalYearBoundaryStatus"];
  fiscalQuarter?: number | null; quarterStart?: string | null;
  quarterEnd?: string | null; calendar?: string | null; currency?: string | null; scale?: FinancialObservation["scale"];
  accountingBasis?: string | null; consolidationScope?: string | null; securityId?: string;
  unit?: FinancialObservation["unit"];
}): FinancialObservation {
  const basis = input.basis ?? "annual";
  const start = input.start === undefined ? "2025-01-01" : input.start;
  const end = input.end ?? "2025-12-31";
  const durationDays = start ? Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1 : null;
  const value = input.value === null ? null : parseDecimalString(input.value);
  if (input.value !== null && value === null) throw new TypeError("Test fixture has malformed decimal value.");
  const market = "NASDAQ";
  const entitlement = createSyntheticDemoEntitlement({ providerId: "test-fundamentals", dataset: "synthetic-financials", market });
  const fiscalYearId = input.fiscalYearId === undefined ? "FY2025" : input.fiscalYearId;
  const fiscalYearStart = input.fiscalYearStart === undefined ? start : input.fiscalYearStart;
  const fiscalYearEnd = input.fiscalYearEnd === undefined ? (basis === "annual" ? end : null) : input.fiscalYearEnd;
  const fiscalQuarter = input.fiscalQuarter === undefined ? null : input.fiscalQuarter;
  const quarterStart = input.quarterStart === undefined ? null : input.quarterStart;
  const quarterEnd = input.quarterEnd === undefined ? null : input.quarterEnd;
  const period: ReportingPeriod = {
    basis, start, end, fiscalYearId, fiscalYearStart, fiscalYearEnd,
    fiscalYearBoundaryStatus: input.fiscalYearBoundaryStatus ?? (basis === "annual" ? "source-verified" : "unverified"),
    fiscalQuarterId: fiscalQuarter === null ? null : `${fiscalYearId}-Q${fiscalQuarter}`,
    fiscalQuarterNumber: fiscalQuarter, fiscalQuarterStart: quarterStart, fiscalQuarterEnd: quarterEnd,
    fiscalCalendarId: input.calendar === undefined ? (fiscalQuarter === null ? "CALENDAR" : "ISSUER-CALENDAR") : input.calendar,
    sourcePeriodLabel: input.id, durationDays, durationWeeks: durationDays === null ? null : durationDays / 7,
    completeness: "complete"
  };
  return {
    id: input.id, securityId: input.securityId ?? "US:XNAS:TEST", statementCategory: input.category ?? "income-statement",
    metricKey: input.metricKey, metricMappingStatus: "verified", providerMetricName: input.metricKey, value, currency: input.currency === undefined ? "USD" : input.currency,
    unit: input.unit ?? "currency", scale: input.scale ?? "units", period,
    accountingBasis: input.accountingBasis === undefined ? "GAAP" : input.accountingBasis,
    consolidationScope: input.consolidationScope === undefined ? "consolidated" : input.consolidationScope,
    source: {
      providerId: "test-fundamentals", providerName: "Synthetic Calculation Test", dataset: "synthetic-financials", market,
      sourceRecordId: `source-${input.id}`, asOf: "2025-12-31T00:00:00.000Z", retrievedAt: "2026-01-02T00:00:00.000Z",
      dataEnvironment: "synthetic", entitlements: [entitlement], entitlementIds: [entitlement.id], revision: { status: "original" }
    }
  };
}

function annualRevenue(id: string, value: string, fiscalYear: string, start: string, end: string, calendar = "CALENDAR"): FinancialObservation {
  return financialObservation({ id, metricKey: "revenue", value, basis: "annual", start, end, fiscalYearId: fiscalYear, fiscalYearStart: start, fiscalYearEnd: end, fiscalYearBoundaryStatus: "source-verified", calendar });
}

function quarterRevenue(id: string, value: string): FinancialObservation {
  return financialObservation({
    id, metricKey: "revenue", value, basis: "discrete-quarter", start: "2025-10-01", end: "2025-12-31",
    fiscalYearId: "FY2026", fiscalYearStart: "2025-07-01", fiscalQuarter: 2,
    quarterStart: "2025-10-01", quarterEnd: "2025-12-31", calendar: "MS-FY"
  });
}

describe("deterministic financial calculation engine", () => {
  it("calculates comparable annual revenue growth with hand-checked inputs", () => {
    const current = annualRevenue("revenue-2025", "125", "FY2025", "2025-01-01", "2025-12-31");
    const prior = annualRevenue("revenue-2024", "100", "FY2024", "2024-01-01", "2024-12-31");
    const result = calculateFinancialMetric("revenue-growth", [current, prior], syntheticContext);
    expect(result).toMatchObject({ status: "calculated", value: "25", unit: "percentage", formulaIdentifier: "revenue-growth", formulaVersion: "v1", definitionStatus: "proposed-open" });
    expect(result.inputObservationIds).toEqual(["revenue-2025", "revenue-2024"]);
    expect(result.evidenceIds).toContain("source-revenue-2025");
  });

  it("requires complete source-verified fiscal-year boundaries for annual growth", () => {
    const current = annualRevenue("annual-current", "125", "FY2025", "2025-01-01", "2025-12-31");
    const prior = annualRevenue("annual-prior", "100", "FY2024", "2024-01-01", "2024-12-31");
    expect(calculateFinancialMetric("revenue-growth", [current, prior], syntheticContext).value).toBe("25");

    const assertUnavailable = (a: FinancialObservation, b: FinancialObservation) => {
      expect(calculateFinancialMetric("revenue-growth", [a, b], syntheticContext)).toMatchObject({ status: "incompatible_periods", value: null });
    };
    assertUnavailable(annualRevenue("six-month", "50", "FY2025", "2025-01-01", "2025-06-30"), prior);
    assertUnavailable(current, { ...prior, period: { ...prior.period, fiscalYearEnd: "2024-12-30" } });
    assertUnavailable(current, { ...prior, period: { ...prior.period, fiscalCalendarId: "OTHER-CALENDAR" } });
    assertUnavailable(current, { ...prior, period: { ...prior.period, fiscalYearBoundaryStatus: "unverified" } });
  });

  it("supports verified non-calendar and compatible 52/53-week fiscal-year pairs", () => {
    const nonCalendarCurrent = annualRevenue("nfy-current", "125", "FY2026", "2025-07-01", "2026-06-30", "JULY-FY");
    const nonCalendarPrior = annualRevenue("nfy-prior", "100", "FY2025", "2024-07-01", "2025-06-30", "JULY-FY");
    expect(calculateFinancialMetric("revenue-growth", [nonCalendarCurrent, nonCalendarPrior], syntheticContext).value).toBe("25");

    const fiftyThreeWeek = annualRevenue("fy-53w", "100", "FY2023-53W", "2022-01-30", "2023-02-04", "RETAIL-52-53");
    const fiftyTwoWeek = annualRevenue("fy-52w", "125", "FY2024-52W", "2023-02-05", "2024-02-03", "RETAIL-52-53");
    expect(calculateFinancialMetric("revenue-growth", [fiftyTwoWeek, fiftyThreeWeek], syntheticContext)).toMatchObject({ status: "calculated", value: "25" });
  });

  it("calculates gross and operating margins in exact currency periods, including negative profit", () => {
    const grossProfit = financialObservation({ id: "gross", metricKey: "gross-profit", value: "1.25" });
    const revenue = financialObservation({ id: "sales", metricKey: "revenue", value: "10" });
    expect(calculateFinancialMetric("gross-margin", [grossProfit, revenue], syntheticContext)).toMatchObject({ status: "calculated", value: "12.5", unit: "percentage", rounding: { mode: "half-up-away-from-zero", calculationDecimalPlaces: 1 } });
    const opIncome = financialObservation({ id: "oploss", metricKey: "operating-income", value: "-2" });
    expect(calculateFinancialMetric("operating-margin", [opIncome, revenue], syntheticContext)).toMatchObject({ status: "calculated", value: "-20", unit: "percentage" });
  });

  it("returns reported operating cash flow unchanged with currency, scale, period and evidence", () => {
    const ocf = financialObservation({ id: "ocf-q", metricKey: "operating-cash-flow", value: "-1200000.123456789", category: "cash-flow", basis: "discrete-quarter", start: "2025-10-01", end: "2025-12-31", fiscalYearId: "FY2026", fiscalYearStart: "2025-07-01", fiscalQuarter: 2, quarterStart: "2025-10-01", quarterEnd: "2025-12-31", calendar: "MS-FY" });
    const result = calculateFinancialMetric("operating-cash-flow", [ocf], syntheticContext);
    expect(result).toMatchObject({ status: "calculated", value: "-1200000.123456789", unit: "currency", currency: "USD", scale: "units", periodType: "discrete-quarter" });
    expect(result.evidenceIds).toContain("source-ocf-q");
  });

  it("calculates current ratio only from same-date balance-sheet observations", () => {
    const assets = financialObservation({ id: "assets", metricKey: "current-assets", value: "10", category: "balance-sheet", basis: "instant", start: null, end: "2025-12-31", fiscalYearId: null, fiscalYearStart: null, calendar: "CALENDAR" });
    const liabilities = financialObservation({ id: "liabilities", metricKey: "current-liabilities", value: "6", category: "balance-sheet", basis: "instant", start: null, end: "2025-12-31", fiscalYearId: null, fiscalYearStart: null, calendar: "CALENDAR" });
    expect(calculateFinancialMetric("current-ratio", [assets, liabilities], syntheticContext)).toMatchObject({ status: "calculated", value: "1.67", unit: "ratio", reportingPeriod: { basis: "instant", end: "2025-12-31" } });
    expect(calculateFinancialMetric("current-ratio", [assets, { ...liabilities, period: { ...liabilities.period, end: "2025-09-30" } }], syntheticContext).status).toBe("incompatible_periods");
  });

  it("preserves denominator edge statuses and never substitutes missing observations with zero", () => {
    const current = annualRevenue("current", "10", "FY2025", "2025-01-01", "2025-12-31");
    const zeroBase = annualRevenue("zero-base", "0", "FY2024", "2024-01-01", "2024-12-31");
    const negativeBase = annualRevenue("negative-base", "-10", "FY2024", "2024-01-01", "2024-12-31");
    expect(calculateFinancialMetric("revenue-growth", [current, zeroBase], syntheticContext).status).toBe("zero_denominator");
    expect(calculateFinancialMetric("revenue-growth", [current, negativeBase], syntheticContext).status).toBe("not_meaningful");
    expect(calculateFinancialMetric("revenue-growth", [current], syntheticContext).status).toBe("insufficient_history");
    const missing = annualRevenue("missing-revenue", "0", "FY2025", "2025-01-01", "2025-12-31");
    expect(calculateFinancialMetric("gross-margin", [{ ...missing, metricKey: "gross-profit" }, { ...missing, id: "no-revenue", value: null }], syntheticContext)).toMatchObject({ status: "missing_inputs", value: null });
    const zeroRevenue = annualRevenue("zero-revenue", "0", "FY2025", "2025-01-01", "2025-12-31");
    expect(calculateFinancialMetric("operating-margin", [financialObservation({ id: "income", metricKey: "operating-income", value: "1" }), zeroRevenue], syntheticContext).status).toBe("zero_denominator");
    const zeroLiabilities = { ...liabilitiesFixture(), value: parseDecimalString("0") };
    expect(calculateFinancialMetric("current-ratio", [assetsFixture(), zeroLiabilities], syntheticContext).status).toBe("zero_denominator");
  });

  it("rejects incompatible currencies, periods, scales and accounting scopes", () => {
    const op = financialObservation({ id: "op", metricKey: "operating-income", value: "10" });
    const usdRevenue = financialObservation({ id: "usd-revenue", metricKey: "revenue", value: "100" });
    expect(calculateFinancialMetric("operating-margin", [op, { ...usdRevenue, currency: "EUR" }], syntheticContext).status).toBe("incompatible_currency");
    expect(calculateFinancialMetric("operating-margin", [op, quarterRevenue("quarter-revenue", "100")], syntheticContext).status).toBe("incompatible_periods");
    expect(calculateFinancialMetric("operating-margin", [op, { ...usdRevenue, scale: "millions" }], syntheticContext).status).toBe("incompatible_units");
    expect(calculateFinancialMetric("operating-margin", [op, { ...usdRevenue, consolidationScope: "parent-only" }], syntheticContext).status).toBe("incompatible_scope");
    const otherCalendar = annualRevenue("other-calendar", "100", "FY2024", "2024-01-01", "2024-12-31");
    expect(calculateFinancialMetric("revenue-growth", [annualRevenue("this-year", "101", "FY2025", "2025-01-01", "2025-12-31"), { ...otherCalendar, period: { ...otherCalendar.period, fiscalCalendarId: "OTHER" } }], syntheticContext).status).toBe("incompatible_periods");
  });

  it("rejects different securities, units, negative current revenue, and negative current liabilities", () => {
    const current = annualRevenue("current", "10", "FY2025", "2025-01-01", "2025-12-31");
    const prior = annualRevenue("prior", "8", "FY2024", "2024-01-01", "2024-12-31");
    const differentSecurity = { ...prior, securityId: "US:XNAS:OTHER" };
    expect(calculateFinancialMetric("revenue-growth", [current, differentSecurity], syntheticContext)).toMatchObject({ status: "incompatible_scope", value: null });
    expect(calculateFinancialMetric("operating-margin", [financialObservation({ id: "income-share", metricKey: "operating-income", value: "1", unit: "shares" }), financialObservation({ id: "revenue", metricKey: "revenue", value: "10" })], syntheticContext)).toMatchObject({ status: "incompatible_units", value: null });
    expect(calculateFinancialMetric("revenue-growth", [annualRevenue("negative-current", "-1", "FY2025", "2025-01-01", "2025-12-31"), prior], syntheticContext)).toMatchObject({ status: "unsupported_definition", value: null });
    expect(calculateFinancialMetric("current-ratio", [assetsFixture(), { ...liabilitiesFixture(), value: parseDecimalString("-1") }], syntheticContext)).toMatchObject({ status: "not_meaningful", value: null });
    expect(calculateFinancialMetric("revenue-growth", [{ ...current, metricKey: "operating-income" }, prior], syntheticContext)).toMatchObject({ status: "incompatible_units", value: null });
  });

  it("rejects invalid input observations and denied derivation rights", () => {
    const valid = financialObservation({ id: "invalid-decimal", metricKey: "operating-cash-flow", value: "1", category: "cash-flow" });
    const malformed = { ...valid, value: "1e9" as unknown as FinancialObservation["value"] };
    expect(calculateFinancialMetric("operating-cash-flow", [malformed], syntheticContext)).toMatchObject({ status: "invalid_input", value: null });
    const deniedEntitlement = { ...valid.source.entitlements[0], permissions: {} };
    const denied = { ...valid, source: { ...valid.source, entitlements: [deniedEntitlement] } };
    expect(calculateFinancialMetric("operating-cash-flow", [denied], syntheticContext).status).toBe("permission_denied");
    const unmapped = { ...valid, metricMappingStatus: "unverified" as const };
    expect(calculateFinancialMetric("operating-cash-flow", [unmapped], syntheticContext).status).toBe("unsupported_definition");
    const ambiguous = { ...valid, metricMappingStatus: "ambiguous" as const };
    expect(calculateFinancialMetric("operating-cash-flow", [ambiguous], syntheticContext)).toMatchObject({ status: "unsupported_definition", value: null });
    const missingMapping = { ...valid, metricMappingStatus: undefined } as unknown as FinancialObservation;
    expect(calculateFinancialMetric("operating-cash-flow", [missingMapping], syntheticContext)).toMatchObject({ status: "invalid_input", value: null });
    const invalidEvidence = { ...valid, source: { ...valid.source, sourceRecordId: "" } };
    expect(calculateFinancialMetric("operating-cash-flow", [invalidEvidence], syntheticContext)).toMatchObject({ status: "invalid_input", value: null });
    expect(calculateFinancialMetric("operating-cash-flow", [null] as unknown as FinancialObservation[], syntheticContext)).toMatchObject({ status: "invalid_input", value: null });
  });

  it("calculates from a validated derived quarter and retains its evidence lineage", () => {
    const prior = ytdCashFlow("ocf-q1", "200", 1, "2025-09-30", "2025-07-01", "2025-09-30");
    const current = ytdCashFlow("ocf-q2", "350", 2, "2025-12-31", "2025-10-01", "2025-12-31");
    const derived = deriveDiscreteQuarterFromYtd(prior, current);
    expect(derived.status).toBe("derived");
    if (derived.status === "derived") {
      const result = calculateFinancialMetric("operating-cash-flow", [derived.observation], syntheticContext);
      expect(result).toMatchObject({ status: "calculated", value: "150", periodType: "discrete-quarter" });
      expect(result.inputObservationIds).toContain(derived.observation.id);
      expect(result.evidenceIds).toEqual(expect.arrayContaining([prior.id, current.id]));
    }
  });

  it("keeps unresolved D-34 metrics blocked and catalogue versions stable", () => {
    for (const metric of ["net-margin", "free-cash-flow", "debt-to-equity", "price-to-earnings"] as const) {
      expect(calculateFinancialMetric(metric, [], syntheticContext)).toMatchObject({ status: "unsupported_definition", value: null, formulaVersion: "v1" });
    }
    expect(financialFormulaCatalogue.map((entry) => entry.metricId)).toEqual([
      "revenue-growth", "gross-margin", "operating-margin", "net-margin", "operating-cash-flow",
      "free-cash-flow", "current-ratio", "debt-to-equity", "price-to-earnings"
    ]);
    expect(financialFormulaCatalogue.every((entry) => entry.formulaVersion === "v1")).toBe(true);
  });

  it("rejects formula metadata drift until the implementation registry and tests are updated", () => {
    const definition = getFinancialFormula("gross-margin");
    expect(isFormulaDefinitionSupported(definition)).toBe(true);
    expect(isFormulaDefinitionSupported({ ...definition, formulaVersion: "v2" })).toBe(false);
    expect(isFormulaDefinitionSupported({ ...definition, requiredMetricKeys: ["cost-of-revenue", "revenue"] })).toBe(false);
    expect(isFormulaDefinitionSupported({ ...definition, requiredUnits: ["shares", "currency"] })).toBe(false);
    expect(isFormulaDefinitionSupported({ ...definition, allowedPeriodBases: ["annual"] })).toBe(false);
    expect(isFormulaDefinitionSupported({ ...definition, rounding: { ...definition.rounding, calculationDecimalPlaces: 2 } })).toBe(false);
    expect(isFormulaDefinitionSupported({ ...definition, currencyRule: "Convert currencies implicitly" })).toBe(false);
  });
});

function assetsFixture(): FinancialObservation {
  return financialObservation({ id: "assets-fixture", metricKey: "current-assets", value: "10", category: "balance-sheet", basis: "instant", start: null, end: "2025-12-31", fiscalYearId: null, fiscalYearStart: null });
}

function liabilitiesFixture(): FinancialObservation {
  return financialObservation({ id: "liabilities-fixture", metricKey: "current-liabilities", value: "6", category: "balance-sheet", basis: "instant", start: null, end: "2025-12-31", fiscalYearId: null, fiscalYearStart: null });
}

function ytdCashFlow(id: string, value: string, quarter: number, end: string, quarterStart: string, quarterEnd: string): FinancialObservation {
  const row = financialObservation({
    id, metricKey: "operating-cash-flow", value, category: "cash-flow", basis: "year-to-date", start: "2025-07-01", end,
    fiscalYearId: "FY2026", fiscalYearStart: "2025-07-01", fiscalQuarter: quarter, quarterStart, quarterEnd, calendar: "MS-FY"
  });
  return row;
}
