import { createSyntheticDemoEntitlement } from "@/lib/financial/permissions";
import { resolveProviderSecurityMapping } from "@/lib/financial/security-mapping";
import { parseDecimalString } from "@/lib/financial/decimal";
import { validateCompanyProfileRecord, validateFinancialStatementBundle, validatedProviderResult } from "@/lib/financial/validation";
import type {
  BalanceSheetObservation, CashFlowObservation, CompanyProfileRecord, DataEntitlement,
  FinancialDataProvenance, FinancialObservation, FinancialStatementBundle,
  FinancialStatementCategory, FinancialUnit, FundamentalsProvider, IncomeStatementObservation, ProviderResult, ProviderSecurityMapping, ReportingPeriod,
  ProviderValidationIssue, SecurityIdentity, SecurityMappingResolution
} from "@/types/financial";
import { demoSecurities } from "@/lib/data/demo-data";

const PROVIDER_ID = "aynox-synthetic-fundamentals";
const RETRIEVED_AT = "2026-11-25T12:00:00.000Z";
const mappings = demoSecurities.map((security) => ({
  providerId: PROVIDER_ID,
  securityId: security.id,
  canonicalSymbol: security.symbol,
  canonicalExchange: security.exchange,
  providerSymbol: security.symbol === "TSM" ? "2330.TW" : `${security.symbol}.MOCK`,
  providerExchange: security.exchange,
  providerSecurityId: `mock:${security.id}`,
  status: "confirmed" as const,
  mappingSource: "Aynox synthetic fixture mapping"
}));

function period(input: Partial<ReportingPeriod> & Pick<ReportingPeriod, "basis" | "start" | "end" | "sourcePeriodLabel">): ReportingPeriod {
  const durationDays = input.start ? daysInclusive(input.start, input.end) : null;
  return {
    fiscalYearId: null, fiscalYearStart: null, fiscalYearEnd: null, fiscalYearBoundaryStatus: "unverified", fiscalQuarterId: null, fiscalQuarterNumber: null,
    fiscalQuarterStart: null, fiscalQuarterEnd: null, fiscalCalendarId: null,
    durationDays, durationWeeks: durationDays === null ? null : durationDays / 7,
    completeness: "complete", ...input
  };
}

function provenance(security: SecurityIdentity, record: string, revision: FinancialDataProvenance["revision"] = { status: "original" }): FinancialDataProvenance {
  return {
    providerId: PROVIDER_ID, providerName: "Aynox Synthetic Fundamentals", dataset: "synthetic-company-financials",
    market: security.exchange, sourceRecordId: record, sourceUrl: "https://example.invalid/aynox-synthetic-data",
    asOf: "2026-09-30T00:00:00.000Z", retrievedAt: RETRIEVED_AT, dataEnvironment: "synthetic",
    entitlements: [createSyntheticDemoEntitlement({ providerId: PROVIDER_ID, dataset: "synthetic-company-financials", market: security.exchange })],
    revision, entitlementIds: [`demo:${PROVIDER_ID}:synthetic-company-financials:${security.exchange}`]
  };
}

function observation(security: SecurityIdentity, input: {
  id: string; category: FinancialStatementCategory; key: string; value: string | null; currency: string | null;
  unit?: FinancialUnit; basis: ReportingPeriod["basis"]; start: string | null; end: string;
  fy?: string; fyStart?: string; quarter?: number; calendar?: string; qStart?: string; qEnd?: string;
  durationDays?: number; durationWeeks?: number; revision?: FinancialDataProvenance["revision"];
}): FinancialObservation {
  const p = period({
    basis: input.basis, start: input.start, end: input.end,
    sourcePeriodLabel: input.id, fiscalYearId: input.fy ?? null, fiscalYearStart: input.fyStart ?? null,
    fiscalYearEnd: input.basis === "annual" ? input.end : null,
    fiscalYearBoundaryStatus: input.basis === "annual" ? "source-verified" : "unverified",
    fiscalQuarterId: input.quarter ? `${input.fy}-Q${input.quarter}` : null,
    fiscalQuarterNumber: input.quarter ?? null, fiscalCalendarId: input.calendar ?? null,
    fiscalQuarterStart: input.qStart ?? null, fiscalQuarterEnd: input.qEnd ?? null
  });
  const decimalValue = input.value === null ? null : parseDecimalString(input.value);
  if (input.value !== null && decimalValue === null) throw new TypeError("Invalid synthetic fixture decimal.");
  return {
    id: input.id, securityId: security.securityId, statementCategory: input.category,
    metricKey: input.key, metricMappingStatus: "verified", providerMetricName: `Mock ${input.key}`, value: decimalValue,
    currency: input.currency, unit: input.unit ?? "currency", scale: "units", period: p,
    accountingBasis: "synthetic-accrual", consolidationScope: "consolidated",
    source: provenance(security, input.id, input.revision)
  };
}

function daysInclusive(start: string, end: string): number {
  return Math.floor((Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 86_400_000) + 1;
}

function fixtures(identity: SecurityIdentity): { bundle: FinancialStatementBundle; profile: CompanyProfileRecord; status: "complete" | "partial" } {
  const security = demoSecurities.find((item) => item.id === identity.securityId)!;
  const currency = security.currency;
  const fyStart = security.symbol === "MSFT" ? "2025-07-01" : "2026-01-01";
  const fy = security.symbol === "MSFT" ? "FY2026" : "FY2026";
  const calendar = security.symbol === "MSFT" ? "MSFT-FY-CALENDAR" : "CALENDAR-YEAR";
  const q1Start = fyStart;
  const q1End = security.symbol === "MSFT" ? "2025-09-30" : "2026-03-31";
  const q2Start = security.symbol === "MSFT" ? "2025-10-01" : "2026-04-01";
  const q2End = security.symbol === "MSFT" ? "2025-12-31" : "2026-06-30";
  const revision = security.symbol === "NVDA" ? { status: "restated" as const, revisionId: "r2", compatibleSetId: "nvda-restatement-2" } : undefined;
  const flow = (id: string, key: string, value: string | null, basis: "year-to-date" | "annual" | "trailing-twelve-month", start: string, end: string, quarter?: number, qstart?: string, qend?: string): FinancialObservation => observation(identity, {
    id, category: "income-statement", key, value, currency, basis, start, end, fy, fyStart: basis === "annual" ? start : fyStart,
    quarter, calendar, qStart: qstart, qEnd: qend, revision
  });
  const cash = (id: string, key: string, value: string | null, basis: "year-to-date" | "annual", start: string, end: string, quarter?: number, qstart?: string, qend?: string): FinancialObservation => observation(identity, {
    id, category: "cash-flow", key, value, currency, basis, start, end, fy, fyStart: basis === "annual" ? start : fyStart,
    quarter, calendar, qStart: qstart, qEnd: qend, revision
  });
  const inc: FinancialObservation[] = [
    flow(`${security.symbol}-rev-ytd-q1`, "revenue", "1000000", "year-to-date", fyStart, q1End, 1, q1Start, q1End),
    flow(`${security.symbol}-rev-ytd-q2`, "revenue", "2250000", "year-to-date", fyStart, q2End, 2, q2Start, q2End),
    flow(`${security.symbol}-opinc-annual`, "operating-income", "310000", "annual", "2025-01-01", "2025-12-31"),
    flow(`${security.symbol}-rev-ttm`, "revenue", "4200000", "trailing-twelve-month", "2025-10-01", "2026-09-30"),
    flow(`${security.symbol}-eps-missing`, "diluted-eps", null, "annual", "2025-01-01", "2025-12-31", undefined)
  ];
  const bal: FinancialObservation[] = [observation(identity, {
    id: `${security.symbol}-cash-instant`, category: "balance-sheet", key: "cash-and-equivalents", value: "85000", currency,
    basis: "instant", start: null, end: "2026-09-30", unit: "currency"
  })];
  const cf: FinancialObservation[] = [
    cash(`${security.symbol}-ocf-ytd-q1`, "operating-cash-flow", security.symbol === "MSFT" ? null : "240000", "year-to-date", fyStart, q1End, 1, q1Start, q1End),
    cash(`${security.symbol}-ocf-ytd-q2`, "operating-cash-flow", "390000", "year-to-date", fyStart, q2End, 2, q2Start, q2End),
    cash(`${security.symbol}-capex-annual`, "capital-expenditure", "-65000", "annual", "2025-01-01", "2025-12-31")
  ];

  if (security.symbol === "AAPL") {
    inc.splice(0, 2, flow("AAPL-revenue-missing", "revenue", null, "year-to-date", fyStart, q2End, 2, q2Start, q2End));
    inc.push(flow("AAPL-other-income-zero", "other-income", "0", "annual", "2025-01-01", "2025-12-31"));
  }
  if (security.symbol === "MSFT") bal.length = 0;
  if (security.symbol === "ORCL") {
    inc.push(flow("ORCL-53-week-annual", "revenue", "990000", "annual", "2024-06-30", "2025-07-05"));
    inc[inc.length - 1].period.fiscalCalendarId = "ORCL-52-53-WEEK";
  }

  const complete = security.symbol !== "MSFT";
  const section = <T extends FinancialObservation>(rows: T[], available: boolean) => ({
    status: available ? (complete ? "complete" as const : "partial" as const) : "unavailable" as const,
    observations: available ? rows : [], missingFields: available ? (complete ? [] : ["provider coverage incomplete"]) : ["not supplied by synthetic fixture"]
  });
  const profileSource = provenance(identity, `${security.symbol}-profile`);
  const profile: CompanyProfileRecord = {
    securityId: security.id, canonicalSymbol: security.symbol, exchange: security.exchange, companyName: security.name,
    facts: [
      { field: "business-description", value: security.description, providerField: "mock_business_summary", asOf: "2026-09-30T00:00:00.000Z" },
      { field: "sector", value: security.sector, providerField: "mock_sector", asOf: null },
      { field: "country", value: security.country, providerField: "mock_country", asOf: null }
    ], source: profileSource
  };
  return { bundle: {
    incomeStatement: section(inc.filter(isIncomeStatement), true),
    balanceSheet: section(bal.filter(isBalanceSheet), security.symbol !== "MSFT"),
    cashFlow: section(cf.filter(isCashFlow), true)
  }, profile, status: complete ? "complete" : "partial" };
}

function isIncomeStatement(item: FinancialObservation): item is IncomeStatementObservation {
  return item.statementCategory === "income-statement";
}

function isBalanceSheet(item: FinancialObservation): item is BalanceSheetObservation {
  return item.statementCategory === "balance-sheet" && item.period.basis === "instant" && item.period.start === null;
}

function isCashFlow(item: FinancialObservation): item is CashFlowObservation {
  return item.statementCategory === "cash-flow";
}

export class MockFundamentalsProvider implements FundamentalsProvider {
  readonly providerId = PROVIDER_ID;
  readonly providerName = "Aynox Synthetic Fundamentals";
  readonly isDemo = true;

  constructor(private readonly providerMappings: ProviderSecurityMapping[] = mappings) {}

  resolveSecurity(identity: SecurityIdentity): SecurityMappingResolution {
    return resolveProviderSecurityMapping(identity, this.providerId, this.providerMappings);
  }

  async getCompanyProfile(identity: SecurityIdentity): Promise<ProviderResult<CompanyProfileRecord>> {
    const resolution = this.resolveSecurity(identity);
    if (resolution.status !== "resolved") return unavailableResult(this, identity, resolution);
    const { profile, status } = fixtures(identity);
    return result(this, identity, status, status === "complete" ? "supported" : "partial", profile, validateCompanyProfileRecord);
  }

  async getFinancialStatements(identity: SecurityIdentity): Promise<ProviderResult<FinancialStatementBundle>> {
    const resolution = this.resolveSecurity(identity);
    if (resolution.status !== "resolved") return unavailableResult(this, identity, resolution);
    const { bundle, status } = fixtures(identity);
    return result(this, identity, status, status === "complete" ? "supported" : "partial", bundle, validateFinancialStatementBundle);
  }
}

function result<T>(
  provider: MockFundamentalsProvider,
  identity: SecurityIdentity,
  status: "complete" | "partial",
  coverageStatus: "supported" | "partial",
  data: T,
  validate: (value: unknown) => ProviderValidationIssue[]
): ProviderResult<T> {
  const entitlement = createSyntheticDemoEntitlement({ providerId: provider.providerId, dataset: "synthetic-company-financials", market: identity.exchange });
  const candidate: ProviderResult<T> = {
    status, provider: { id: provider.providerId, name: provider.providerName, isDemo: true },
    coverage: { status: coverageStatus, supportedFields: ["profile", "income-statement", "balance-sheet", "cash-flow"], missingFields: status === "partial" ? ["some fields are unavailable"] : [] },
    retrievedAt: RETRIEVED_AT, dataEnvironment: "synthetic", entitlements: [entitlement], data
  };
  return validatedProviderResult(candidate, validate);
}

function unavailableResult<T>(provider: MockFundamentalsProvider, identity: SecurityIdentity, resolution: Exclude<SecurityMappingResolution, { status: "resolved" }>): ProviderResult<T> {
  const entitlement: DataEntitlement = createSyntheticDemoEntitlement({ providerId: provider.providerId, dataset: "synthetic-company-financials", market: identity.exchange });
  return {
    status: "unavailable", provider: { id: provider.providerId, name: provider.providerName, isDemo: true },
    coverage: { status: resolution.status, supportedFields: [], missingFields: ["company profile", "financial statements"], message: resolution.reason },
    retrievedAt: RETRIEVED_AT, dataEnvironment: "synthetic", entitlements: [entitlement], data: null,
    failure: { code: resolution.status === "ambiguous" ? "AMBIGUOUS_SECURITY_MAPPING" : "UNSUPPORTED_SECURITY", message: resolution.reason }
  };
}
