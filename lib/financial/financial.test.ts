import { describe, expect, it } from "vitest";
import { demoSecurities } from "@/lib/data/demo-data";
import { isDecimalString, subtractDecimalStrings } from "@/lib/financial/decimal";
import { deriveDiscreteQuarterFromYtd } from "@/lib/financial/period-normalization";
import { createSyntheticDemoEntitlement, evaluateDataPermission } from "@/lib/financial/permissions";
import { resolveProviderSecurityMapping, securityIdentityFromSecurity } from "@/lib/financial/security-mapping";
import { validateCompanyProfileRecord, validateFinancialObservation, validateFinancialStatementBundle, validateProviderResponse, validatedProviderResult } from "@/lib/financial/validation";
import { MockFundamentalsProvider } from "@/lib/providers/mock-fundamentals-provider";
import type { FinancialObservation, ProviderSecurityMapping, SecurityIdentity } from "@/types/financial";

describe("decimal-safe financial values", () => {
  it("validates decimal strings and subtracts without floating point", () => {
    expect(isDecimalString("9007199254740993.25")).toBe(true);
    expect(isDecimalString("1e3")).toBe(false);
    expect(subtractDecimalStrings("255.10", "105.1")).toBe("150");
    expect(subtractDecimalStrings("2.01", "4.10")).toBe("-2.09");
  });
});

describe("stable provider security mapping", () => {
  const provider = new MockFundamentalsProvider();
  it("maps every intended demo security by canonical ID, including TSM's different provider symbol", () => {
    for (const security of demoSecurities) {
      expect(provider.resolveSecurity(securityIdentityFromSecurity(security)).status).toBe("resolved");
    }
    expect(provider.resolveSecurity(securityIdentityFromSecurity(demoSecurities.find((s) => s.symbol === "TSM")!))).toMatchObject({
      status: "resolved", mapping: { securityId: "TW:XTAI:TSM", providerSymbol: "2330.TW" }
    });
  });

  it("does not resolve by display name or symbol alone and reports ambiguous mappings", () => {
    const identity = securityIdentityFromSecurity(demoSecurities[0]);
    const byNameOnly = { ...identity, securityId: "unknown", symbol: identity.symbol };
    expect(provider.resolveSecurity(byNameOnly).status).toBe("unsupported");
    const ambiguous: ProviderSecurityMapping[] = [
      { providerId: "p", securityId: identity.securityId, canonicalSymbol: identity.symbol, canonicalExchange: identity.exchange, providerSymbol: "A", providerExchange: identity.exchange, status: "confirmed", mappingSource: "test" },
      { providerId: "p", securityId: identity.securityId, canonicalSymbol: identity.symbol, canonicalExchange: identity.exchange, providerSymbol: "B", providerExchange: identity.exchange, status: "confirmed", mappingSource: "test" }
    ];
    expect(resolveProviderSecurityMapping(identity, "p", ambiguous).status).toBe("ambiguous");
    expect(resolveProviderSecurityMapping({ ...identity, exchange: "NYSE" }, "aynox-synthetic-fundamentals", providerMappings(provider)).status).toBe("ambiguous");
    expect(resolveProviderSecurityMapping(identity, "p", [{ ...ambiguous[0], providerSymbol: "   " }])).toMatchObject({ status: "unsupported" });
    expect(resolveProviderSecurityMapping(identity, "p", [{ ...ambiguous[0], providerExchange: "" }])).toMatchObject({ status: "unsupported" });
  });
});

function providerMappings(provider: MockFundamentalsProvider): ProviderSecurityMapping[] {
  return demoSecurities.map((security) => ({
    providerId: provider.providerId, securityId: security.id, canonicalSymbol: security.symbol,
    canonicalExchange: security.exchange, providerSymbol: security.symbol, providerExchange: security.exchange,
    status: "confirmed", mappingSource: "test"
  }));
}

function ytd(input: Omit<Partial<FinancialObservation>, "value"> & {
  id: string; value: string | null; quarter: number; end: string; quarterStart: string; quarterEnd: string;
  currency?: string; complete?: boolean; compatibleSetId?: string; revisionId?: string; entitlementId?: string;
  fiscalYearStart?: string; fiscalYearId?: string; fiscalCalendarId?: string;
}): FinancialObservation {
  const entitlementId = input.entitlementId ?? `ent-${input.id}`;
  const entitlement = {
    id: entitlementId, providerId: "p", dataset: "d", market: "XNAS", contractRef: "test-entitlement",
    contractVersion: "1", dataEnvironment: "synthetic" as const, effectiveFrom: "2020-01-01T00:00:00.000Z", authorizedEnvironments: ["synthetic" as const],
    permittedAudience: "demo-only" as const, permissions: {}
  };
  const source = {
    providerId: "p", providerName: "Provider", dataset: "d", market: "XNAS", sourceRecordId: input.id,
    asOf: input.end, retrievedAt: "2026-11-25T00:00:00.000Z", dataEnvironment: "synthetic" as const,
    entitlements: [entitlement], entitlementIds: [entitlementId], revision: input.compatibleSetId
      ? { status: "restated" as const, revisionId: input.revisionId ?? `revision-${input.id}`, compatibleSetId: input.compatibleSetId }
      : { status: "original" as const }
  };
  const fiscalYearStart = input.fiscalYearStart ?? "2026-01-01";
  const periodDays = Math.floor((Date.parse(`${input.end}T00:00:00.000Z`) - Date.parse(`${fiscalYearStart}T00:00:00.000Z`)) / 86_400_000) + 1;
  return {
    id: input.id, securityId: "US:XNAS:NVDA", statementCategory: "income-statement", metricKey: "revenue", metricMappingStatus: "verified",
    providerMetricName: "Revenue", value: input.value as FinancialObservation["value"], currency: input.currency ?? "USD",
    unit: "currency", scale: "units", accountingBasis: "GAAP", consolidationScope: "consolidated", source,
    period: {
      basis: "year-to-date", start: fiscalYearStart, end: input.end, fiscalYearId: input.fiscalYearId ?? "FY2026", fiscalYearStart,
      fiscalYearEnd: null, fiscalYearBoundaryStatus: "unverified",
      fiscalQuarterId: `${input.fiscalYearId ?? "FY2026"}-Q${input.quarter}`, fiscalQuarterNumber: input.quarter,
      fiscalQuarterStart: input.quarterStart, fiscalQuarterEnd: input.quarterEnd,
      fiscalCalendarId: input.fiscalCalendarId ?? "calendar", sourcePeriodLabel: input.id,
      durationDays: periodDays, durationWeeks: periodDays / 7,
      completeness: input.complete === false ? "incomplete" : "complete"
    }
  };
}

describe("guarded YTD-to-quarter normalization", () => {
  const first = ytd({ id: "q1", quarter: 1, value: "105.10", end: "2026-03-31", quarterStart: "2026-01-01", quarterEnd: "2026-03-31" });
  const second = ytd({ id: "q2", quarter: 2, value: "255.25", end: "2026-06-30", quarterStart: "2026-04-01", quarterEnd: "2026-06-30" });

  it("derives a discrete quarter exactly and preserves both source IDs", () => {
    const result = deriveDiscreteQuarterFromYtd(first, second);
    expect(result.status).toBe("derived");
    if (result.status === "derived") {
      expect(result.observation.value).toBe("150.15");
      expect(result.observation.period).toMatchObject({ basis: "discrete-quarter", start: "2026-04-01", end: "2026-06-30" });
      expect(result.observation.source.upstreamObservationIds).toEqual(["q1", "q2"]);
      expect(result.observation.derivation?.ruleId).toBe("ytd-to-quarter/v1");
    }
  });

  it("never substitutes missing values with zero and rejects incomplete or nonconsecutive periods", () => {
    expect(deriveDiscreteQuarterFromYtd({ ...first, value: null }, second)).toMatchObject({ status: "unavailable", code: "missing-value" });
    expect(deriveDiscreteQuarterFromYtd(first, { ...second, period: { ...second.period, completeness: "incomplete" } })).toMatchObject({ status: "unavailable", code: "incomplete-period" });
    expect(deriveDiscreteQuarterFromYtd(first, { ...second, period: { ...second.period, fiscalQuarterNumber: 3 } })).toMatchObject({ status: "unavailable", code: "nonconsecutive-quarter" });
  });

  it("rejects mismatched currency, unit, fiscal calendar, fiscal year and revisions", () => {
    expect(deriveDiscreteQuarterFromYtd(first, { ...second, currency: "EUR" })).toMatchObject({ status: "unavailable", code: "currency-mismatch" });
    expect(deriveDiscreteQuarterFromYtd(first, { ...second, unit: "percentage" })).toMatchObject({ status: "unavailable", code: "unit-mismatch" });
    expect(deriveDiscreteQuarterFromYtd(first, { ...second, period: { ...second.period, fiscalCalendarId: "retail" } })).toMatchObject({ status: "unavailable", code: "fiscal-calendar-mismatch" });
    expect(deriveDiscreteQuarterFromYtd(first, { ...second, period: { ...second.period, fiscalYearId: "FY2027" } })).toMatchObject({ status: "unavailable", code: "fiscal-year-mismatch" });
    expect(deriveDiscreteQuarterFromYtd(ytd({ id: "r1", quarter: 1, value: "1", end: "2026-03-31", quarterStart: "2026-01-01", quarterEnd: "2026-03-31", compatibleSetId: "a" }), ytd({ id: "r2", quarter: 2, value: "2", end: "2026-06-30", quarterStart: "2026-04-01", quarterEnd: "2026-06-30", compatibleSetId: "b" }))).toMatchObject({ status: "unavailable", code: "revision-mismatch" });
  });

  it("rejects incompatible period boundaries and instantaneous balances", () => {
    expect(deriveDiscreteQuarterFromYtd(first, { ...second, period: { ...second.period, fiscalQuarterStart: "2026-04-02" } })).toMatchObject({ status: "unavailable", code: "period-boundary-mismatch" });
    expect(deriveDiscreteQuarterFromYtd(first, { ...second, statementCategory: "balance-sheet", period: { ...second.period, basis: "instant", start: null } })).toMatchObject({ status: "unavailable", code: "wrong-category" });
  });

  it("derives quarters on a non-calendar fiscal year and a 53-week calendar", () => {
    const nonCalendarQ1 = ytd({ id: "ms-q1", value: "1200", quarter: 1, end: "2025-09-30", quarterStart: "2025-07-01", quarterEnd: "2025-09-30", fiscalYearStart: "2025-07-01", fiscalYearId: "FY2026", fiscalCalendarId: "MS-FY" });
    const nonCalendarQ2 = ytd({ id: "ms-q2", value: "2600", quarter: 2, end: "2025-12-31", quarterStart: "2025-10-01", quarterEnd: "2025-12-31", fiscalYearStart: "2025-07-01", fiscalYearId: "FY2026", fiscalCalendarId: "MS-FY" });
    expect(deriveDiscreteQuarterFromYtd(nonCalendarQ1, nonCalendarQ2)).toMatchObject({ status: "derived", observation: { value: "1400", period: { start: "2025-10-01", end: "2025-12-31" } } });

    const retailQ1 = ytd({ id: "retail-q1", value: "100", quarter: 1, end: "2024-09-28", quarterStart: "2024-06-30", quarterEnd: "2024-09-28", fiscalYearStart: "2024-06-30", fiscalYearId: "FY2025-53W", fiscalCalendarId: "retail-53-week" });
    const retailQ2 = ytd({ id: "retail-q2", value: "240", quarter: 2, end: "2024-12-28", quarterStart: "2024-09-29", quarterEnd: "2024-12-28", fiscalYearStart: "2024-06-30", fiscalYearId: "FY2025-53W", fiscalCalendarId: "retail-53-week" });
    const retailResult = deriveDiscreteQuarterFromYtd(retailQ1, retailQ2);
    expect(retailResult).toMatchObject({ status: "derived", observation: { value: "140", period: { fiscalCalendarId: "retail-53-week", durationDays: 91, durationWeeks: 13 } } });
    const retailQ3 = ytd({ id: "retail-q3", value: "350", quarter: 3, end: "2025-03-29", quarterStart: "2024-12-29", quarterEnd: "2025-03-29", fiscalYearStart: "2024-06-30", fiscalYearId: "FY2025-53W", fiscalCalendarId: "retail-53-week" });
    const retailQ4 = ytd({ id: "retail-q4", value: "500", quarter: 4, end: "2025-07-05", quarterStart: "2025-03-30", quarterEnd: "2025-07-05", fiscalYearStart: "2024-06-30", fiscalYearId: "FY2025-53W", fiscalCalendarId: "retail-53-week" });
    const q4Result = deriveDiscreteQuarterFromYtd(retailQ3, retailQ4);
    expect(q4Result).toMatchObject({ status: "derived", observation: { value: "150", period: { start: "2025-03-30", end: "2025-07-05", durationDays: 98, durationWeeks: 14 } } });
    expect(Math.floor((Date.parse("2025-07-05T00:00:00Z") - Date.parse("2024-06-30T00:00:00Z")) / 86_400_000) + 1).toBe(371);
  });

  it("accepts two restated inputs from the same revision set and preserves both source records", () => {
    const prior = ytd({ id: "restated-q1", value: "900719925474099300000.123456789", quarter: 1, end: "2026-03-31", quarterStart: "2026-01-01", quarterEnd: "2026-03-31", compatibleSetId: "rev-set-9", revisionId: "revision-q1", entitlementId: "entitlement-q1" });
    const current = ytd({ id: "restated-q2", value: "900719925474099300000.123456700", quarter: 2, end: "2026-06-30", quarterStart: "2026-04-01", quarterEnd: "2026-06-30", compatibleSetId: "rev-set-9", revisionId: "revision-q2", entitlementId: "entitlement-q2" });
    const result = deriveDiscreteQuarterFromYtd(prior, current);
    expect(result.status).toBe("derived");
    if (result.status === "derived") {
      expect(result.observation.value).toBe("-0.000000089");
      expect(result.observation.source.upstreamObservationIds).toEqual(["restated-q1", "restated-q2"]);
      expect(result.observation.source.upstreamSources?.map((source) => source.revision.revisionId)).toEqual(["revision-q1", "revision-q2"]);
      expect(result.observation.source.upstreamSources?.map((source) => source.entitlementIds[0])).toEqual(["entitlement-q1", "entitlement-q2"]);
      expect(result.observation.source.entitlementIds).toEqual(["entitlement-q1", "entitlement-q2"]);
      expect(result.observation.source.entitlements.map((item) => item.id)).toEqual(result.observation.source.entitlementIds);
      expect(validateFinancialObservation(result.observation)).toEqual([]);
    }
  });

  it("returns unavailable for malformed and impossible ISO calendar dates instead of throwing", () => {
    for (const badDate of ["2026-99-99", "2026-02-30", "26-02-01"]) {
      expect(() => deriveDiscreteQuarterFromYtd(first, { ...second, period: { ...second.period, end: badDate } })).not.toThrow();
      expect(deriveDiscreteQuarterFromYtd(first, { ...second, period: { ...second.period, end: badDate } })).toMatchObject({ status: "unavailable", code: "invalid-date" });
    }
  });
});

describe("observation validation and synthetic fixtures", () => {
  const provider = new MockFundamentalsProvider();
  const identity = (symbol: string): SecurityIdentity => securityIdentityFromSecurity(demoSecurities.find((item) => item.symbol === symbol)!);

  it("distinguishes missing values from reported zero", async () => {
    const apple = await provider.getFinancialStatements(identity("AAPL"));
    const rows = apple.data?.incomeStatement.observations ?? [];
    expect(rows.find((row) => row.metricKey === "revenue")?.value).toBeNull();
    expect(rows.find((row) => row.metricKey === "other-income")?.value).toBe("0");
    expect(validateFinancialObservation(rows.find((row) => row.metricKey === "revenue")!)).toEqual([]);
  });

  it("provides synthetic profiles, annual/YTD/TTM/instant observations, currencies and partial coverage", async () => {
    const nvda = await provider.getFinancialStatements(identity("NVDA"));
    expect(nvda).toMatchObject({ status: "complete", dataEnvironment: "synthetic", provider: { isDemo: true } });
    expect(nvda.data?.incomeStatement.observations.map((row) => row.period.basis)).toEqual(expect.arrayContaining(["year-to-date", "annual", "trailing-twelve-month"]));
    expect(nvda.data?.balanceSheet.observations[0].period).toMatchObject({ basis: "instant", start: null });
    const msft = await provider.getFinancialStatements(identity("MSFT"));
    expect(msft.status).toBe("partial");
    expect(msft.data?.balanceSheet.status).toBe("unavailable");
    const asml = await provider.getFinancialStatements(identity("ASML"));
    expect(asml.data?.incomeStatement.observations[0].currency).toBe("EUR");
    const oracle = await provider.getFinancialStatements(identity("ORCL"));
    const oracleAnnual = oracle.data?.incomeStatement.observations.find((row) => row.id === "ORCL-53-week-annual");
    expect(oracleAnnual?.period).toMatchObject({ start: "2024-06-30", end: "2025-07-05", durationWeeks: 53, durationDays: 371 });
    expect(oracleAnnual?.period.durationDays).toBe(Math.floor((Date.parse("2025-07-05T00:00:00Z") - Date.parse("2024-06-30T00:00:00Z")) / 86_400_000) + 1);
    expect(Date.parse("2025-12-31T00:00:00Z")).toBeLessThan(Date.parse((await provider.getFinancialStatements(identity("MSFT"))).retrievedAt));
    expect(nvda.data?.incomeStatement.observations.filter((row) => row.metricKey === "revenue" && row.period.basis === "year-to-date").map((row) => row.source.revision.compatibleSetId)).toEqual(["nvda-restatement-2", "nvda-restatement-2"]);
    const taiwan = await provider.getFinancialStatements(identity("TSM"));
    expect(taiwan.data?.incomeStatement.observations[0]).toMatchObject({ securityId: "TW:XTAI:TSM", currency: "TWD" });
    for (const security of demoSecurities) {
      const response = await provider.getFinancialStatements(securityIdentityFromSecurity(security));
      expect(response.data?.incomeStatement.observations.length).toBeGreaterThan(0);
      expect(response.data?.incomeStatement.observations.every((row) => row.securityId === security.id)).toBe(true);
    }
  });

  it("rejects malformed provider payloads at the shared adapter validation boundary", async () => {
    const response = await provider.getFinancialStatements(identity("NVDA"));
    expect(response.data).not.toBeNull();
    expect(response.data && validateFinancialStatementBundle(response.data)).toEqual([]);
    const corrupted = structuredClone(response.data) as unknown as { incomeStatement: { observations: Array<Record<string, unknown>> } };
    corrupted.incomeStatement.observations[0].value = "not-a-decimal";
    const checked = validateProviderResponse({ ...response, data: corrupted }, validateFinancialStatementBundle);
    expect(checked).toContainEqual(expect.objectContaining({ observationId: "NVDA-rev-ytd-q1", code: "INVALID_DECIMAL" }));
    expect(JSON.stringify(checked)).not.toContain("not-a-decimal");
    const rejected = validatedProviderResult({ ...response, data: corrupted }, validateFinancialStatementBundle);
    expect(rejected).toMatchObject({ status: "error", data: null, failure: { code: "PROVIDER_DATA_VALIDATION_FAILED" } });
    expect(rejected.failure?.issues).toContainEqual(expect.objectContaining({ observationId: "NVDA-rev-ytd-q1", code: "INVALID_DECIMAL" }));
    const profile = await provider.getCompanyProfile(identity("NVDA"));
    expect(profile.data && validateCompanyProfileRecord(profile.data)).toEqual([]);
  });

  it("rejects inconsistent provider, provenance and entitlement data environments", async () => {
    const response = await provider.getFinancialStatements(identity("NVDA"));
    const providerMismatch = validateProviderResponse({ ...response, dataEnvironment: "development-restricted" }, validateFinancialStatementBundle);
    expect(providerMismatch).toContainEqual(expect.objectContaining({ code: "PROVIDER_ENTITLEMENT_ENVIRONMENT_MISMATCH" }));

    const observation = response.data!.incomeStatement.observations[0];
    const provenanceMismatch = validateFinancialObservation({ ...observation, source: { ...observation.source, dataEnvironment: "development-restricted" } });
    expect(provenanceMismatch).toContainEqual(expect.objectContaining({ code: "SOURCE_ENTITLEMENT_ENVIRONMENT_MISMATCH" }));

    const profile = await provider.getCompanyProfile(identity("NVDA"));
    const profileMismatch = profile.data && validateCompanyProfileRecord({ ...profile.data, source: { ...profile.data.source, dataEnvironment: "development-restricted" } });
    expect(profileMismatch).toContainEqual(expect.objectContaining({ code: "SOURCE_ENTITLEMENT_ENVIRONMENT_MISMATCH" }));
  });

  it("rejects invalid calendar dates, reversed periods, missing provenance and inconsistent fiscal metadata", async () => {
    const response = await provider.getFinancialStatements(identity("NVDA"));
    const valid = response.data!.incomeStatement.observations[0];
    expect(validateFinancialObservation({ ...valid, value: "1e5" })).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INVALID_DECIMAL" })]));
    expect(validateFinancialObservation({ ...valid, period: { ...valid.period, end: "2026-02-30" } })).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INVALID_DATE" })]));
    expect(validateFinancialObservation({ ...valid, period: { ...valid.period, start: "2026-07-01" } })).toEqual(expect.arrayContaining([expect.objectContaining({ code: "REVERSED_PERIOD" })]));
    expect(validateFinancialObservation({ ...valid, source: { ...valid.source, sourceRecordId: "", entitlements: [], entitlementIds: [] } })).toEqual(expect.arrayContaining([expect.objectContaining({ code: "MISSING_PROVENANCE" })]));
    expect(validateFinancialObservation({ ...valid, period: { ...valid.period, fiscalQuarterStart: "2026-99-99" } })).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INVALID_DATE" })]));
    expect(validateFinancialObservation({ ...valid, period: { ...valid.period, fiscalQuarterEnd: "2026-06-30" } })).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INCONSISTENT_FISCAL_PERIOD" })]));
    expect(validateFinancialObservation({ ...valid, currency: "", unit: "currency" })).toEqual(expect.arrayContaining([expect.objectContaining({ code: "MISSING_CURRENCY" })]));
    expect(validateFinancialObservation({ ...valid, scale: "nonsense" as FinancialObservation["scale"] })).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INVALID_SCALE" })]));
  });

  it("returns explicit unavailable results for unsupported or ambiguous securities", async () => {
    const unknown = { securityId: "XX:UNKNOWN:ABC", symbol: "ABC", exchange: "Unknown Exchange", currency: "USD" };
    expect(await provider.getCompanyProfile(unknown)).toMatchObject({ status: "unavailable", coverage: { status: "unsupported" }, data: null });
    const first = providerMappings(provider)[0];
    const ambiguousProvider = new MockFundamentalsProvider([first, { ...first, providerSymbol: "another-candidate" }]);
    expect(await ambiguousProvider.getFinancialStatements(identity("NVDA"))).toMatchObject({ status: "unavailable", coverage: { status: "ambiguous" }, data: null });
  });

  it("requires explicit environment/audience context and blocks demo data from production display", () => {
    const entitlement = createSyntheticDemoEntitlement({ providerId: "p", dataset: "d", market: "XNAS" });
    const scope = { providerId: "p", dataset: "d", market: "XNAS", contractRef: entitlement.contractRef, contractVersion: entitlement.contractVersion };
    const at = "2026-11-25T00:00:00.000Z";
    const demoContext = { environment: "synthetic" as const, audience: "demo-only" as const };
    expect(evaluateDataPermission([entitlement], scope, "display", at, demoContext).allowed).toBe(true);
    expect(evaluateDataPermission([entitlement], scope, "display", at, { environment: "production-licensed", audience: "named-customer" }).reason).toBe("environment-mismatch");
    expect(evaluateDataPermission([entitlement], scope, "display", at, { environment: "development-restricted", audience: "internal" }).reason).toBe("environment-mismatch");
    expect(evaluateDataPermission([entitlement], scope, "display", at, undefined).reason).toBe("unknown-consumer-context");
    expect(evaluateDataPermission([entitlement], scope, "display", at, { environment: "synthetic", audience: "internal" }).reason).toBe("audience-mismatch");
    expect(evaluateDataPermission([entitlement], scope, "redistribution", at, demoContext).reason).toBe("operation-denied");
    expect(evaluateDataPermission([], scope, "display", at, demoContext).allowed).toBe(false);
    expect(evaluateDataPermission([entitlement], { ...scope, market: "NYSE" }, "display", at, demoContext).allowed).toBe(false);
  });

  it("supports explicit internal testing and production audience grants without implying real provider rights", () => {
    const base = createSyntheticDemoEntitlement({ providerId: "p", dataset: "d", market: "XNAS" });
    const internal = { ...base, contractRef: "test-internal-rights-fixture", dataEnvironment: "development-restricted" as const, authorizedEnvironments: ["development-restricted" as const], permittedAudience: "internal" as const };
    const internalScope = { providerId: "p", dataset: "d", market: "XNAS", contractRef: internal.contractRef, contractVersion: internal.contractVersion };
    expect(evaluateDataPermission([internal], internalScope, "display", "2026-11-25T00:00:00.000Z", { environment: "development-restricted", audience: "internal" }).allowed).toBe(true);
    expect(evaluateDataPermission([internal], internalScope, "display", "2026-11-25T00:00:00.000Z", { environment: "production-licensed", audience: "named-customer" }).allowed).toBe(false);
    const hypotheticalCustomerGrant = { ...base, contractRef: "test-customer-rights-fixture", dataEnvironment: "production-licensed" as const, authorizedEnvironments: ["production-licensed" as const], permittedAudience: "named-customer" as const };
    const customerScope = { providerId: "p", dataset: "d", market: "XNAS", contractRef: hypotheticalCustomerGrant.contractRef, contractVersion: hypotheticalCustomerGrant.contractVersion };
    expect(evaluateDataPermission([hypotheticalCustomerGrant], customerScope, "display", "2026-11-25T00:00:00.000Z", { environment: "production-licensed", audience: "named-customer" }).allowed).toBe(true);
  });

  it("denies not-yet-effective and expired grants and evaluates conditional permissions", () => {
    const entitlement = createSyntheticDemoEntitlement({ providerId: "p", dataset: "d", market: "XNAS" });
    const scope = { providerId: "p", dataset: "d", market: "XNAS", contractRef: entitlement.contractRef, contractVersion: entitlement.contractVersion };
    const context = { environment: "synthetic" as const, audience: "demo-only" as const };
    const future = { ...entitlement, effectiveFrom: "2026-11-26T00:00:00.000Z" };
    const expired = { ...entitlement, effectiveTo: "2026-11-24T00:00:00.000Z" };
    expect(evaluateDataPermission([future], scope, "display", "2026-11-25T00:00:00.000Z", context).reason).toBe("inactive-entitlement");
    expect(evaluateDataPermission([expired], scope, "display", "2026-11-25T00:00:00.000Z", context).reason).toBe("inactive-entitlement");
    const conditional = { ...entitlement, permissions: { ...entitlement.permissions, display: { state: "conditional" as const, conditions: ["market-approved", "demo-watermark"] } } };
    expect(evaluateDataPermission([conditional], scope, "display", "2026-11-25T00:00:00.000Z", context).reason).toBe("conditions-unmet");
    expect(evaluateDataPermission([conditional], scope, "display", "2026-11-25T00:00:00.000Z", context, ["market-approved", "demo-watermark"]).allowed).toBe(true);
    const unverified = { ...entitlement, permissions: {} };
    expect(evaluateDataPermission([unverified], scope, "storage", "2026-11-25T00:00:00.000Z", context).reason).toBe("operation-unverified");
  });
});
