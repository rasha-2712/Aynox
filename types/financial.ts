export type DataEnvironment = "synthetic" | "development-restricted" | "production-licensed";
export type IntendedAudience = "internal" | "named-customer" | "public" | "demo-only";

export interface DataConsumerContext {
  environment: DataEnvironment;
  audience: IntendedAudience;
}

export type DataOperation =
  | "retrieval"
  | "storage"
  | "display"
  | "derivation"
  | "ai-processing"
  | "retention"
  | "redistribution";

export type PermissionState = "allowed" | "denied" | "conditional" | "unverified";

export interface OperationPermission {
  state: PermissionState;
  conditions?: string[];
}

/** Permission is explicit for one provider, dataset, market and contract version. */
export interface DataEntitlement {
  id: string;
  providerId: string;
  dataset: string;
  market: string;
  contractRef: string;
  contractVersion: string;
  dataEnvironment: DataEnvironment;
  effectiveFrom: string;
  effectiveTo?: string;
  permissions: Partial<Record<DataOperation, OperationPermission>>;
  /** Environments in which this specific contract scope may be used. */
  authorizedEnvironments: DataEnvironment[];
  permittedAudience: IntendedAudience;
  attribution?: string;
  retentionLimit?: string;
}

/** Provider-neutral, signed technical permission declaration. It is not evidence of legal approval. */
export interface TechnicalEntitlementRecord {
  recordId: string;
  issuerId: string;
  providerId: string;
  dataset: string;
  market: string;
  securityId: string | null;
  sourceRecordId: string | null;
  contractId: string;
  contractVersion: string;
  environment: DataEnvironment;
  audience: IntendedAudience;
  allowedOperations: Partial<Record<DataOperation, OperationPermission>>;
  effectiveFrom: string;
  expiresAt: string;
  issuedAt: string;
  integrity: {
    algorithm: "Ed25519";
    keyId: string;
    signature: string;
  };
}

export interface TechnicalEntitlementScope {
  providerId: string;
  dataset: string;
  market: string;
  securityId: string | null;
  sourceRecordId: string | null;
  contractId: string;
  contractVersion: string;
  environment: DataEnvironment;
  audience: IntendedAudience;
}

/** Signed entitlement resolved independently of protected provider response data. */
export interface TechnicalEntitlementPreflight {
  readonly dataset: string;
  readonly contractId: string;
  readonly contractVersion: string;
  readonly retrievalScope: "dataset";
  readonly record: TechnicalEntitlementRecord;
}

export interface VerifiedTechnicalEntitlement {
  readonly record: Readonly<TechnicalEntitlementRecord>;
  readonly verification: {
    readonly status: "verified";
    readonly method: "ed25519";
    readonly issuerId: string;
    readonly keyId: string;
    readonly verifiedAt: string;
  };
  /** Independent legal/contractual approval is not configured by this technical verifier. */
  readonly legalApproval: {
    readonly status: "pending";
    readonly approvalReference: null;
  };
}

export interface DataPermissionScope {
  providerId: string;
  dataset: string;
  market: string;
  contractRef: string;
  contractVersion: string;
}

export type RevisionStatus = "original" | "restated" | "unknown";

export interface SourceRevision {
  status: RevisionStatus;
  revisionId?: string;
  revisionOf?: string;
  /** Shared provider revision set used to ensure cumulative observations are comparable. */
  compatibleSetId?: string;
}

export interface FinancialDataProvenance {
  providerId: string;
  providerName: string;
  dataset: string;
  market: string;
  sourceRecordId: string;
  sourceUrl?: string;
  asOf: string | null;
  retrievedAt: string;
  dataEnvironment: DataEnvironment;
  entitlements: DataEntitlement[];
  /** Signed records for the research evidence path. Legacy declarations above are never research authorization. */
  technicalEntitlements?: TechnicalEntitlementRecord[];
  revision: SourceRevision;
  entitlementIds: string[];
  /** For Aynox-derived values, preserves the exact source observation lineage. */
  upstreamObservationIds?: string[];
  /** Complete, immutable source lineage for derived observations. */
  upstreamSources?: UpstreamFinancialSource[];
}

export interface UpstreamFinancialSource {
  observationId: string;
  providerId: string;
  providerName: string;
  dataset: string;
  market: string;
  sourceRecordId: string;
  sourceUrl?: string;
  asOf: string | null;
  retrievedAt: string;
  dataEnvironment: DataEnvironment;
  revision: SourceRevision;
  entitlements: DataEntitlement[];
  technicalEntitlements?: TechnicalEntitlementRecord[];
  entitlementIds: string[];
}

export interface SecurityIdentity {
  securityId: string;
  symbol: string;
  exchange: string;
  currency: string;
}

export type SecurityMappingStatus = "confirmed" | "ambiguous" | "unsupported";

/** A provider symbol may differ from the canonical symbol; the stable securityId is authoritative. */
export interface ProviderSecurityMapping {
  providerId: string;
  securityId: string;
  canonicalSymbol: string;
  canonicalExchange: string;
  providerSymbol: string;
  providerExchange: string;
  providerSecurityId?: string;
  status: SecurityMappingStatus;
  mappingSource: string;
}

export type SecurityMappingResolution =
  | { status: "resolved"; mapping: ProviderSecurityMapping }
  | { status: "ambiguous"; candidates: ProviderSecurityMapping[]; reason: string }
  | { status: "unsupported"; reason: string };

export type ReportingPeriodBasis =
  | "discrete-quarter"
  | "year-to-date"
  | "annual"
  | "trailing-twelve-month"
  | "instant";

export type PeriodCompleteness = "complete" | "incomplete" | "unknown";
export type FiscalYearBoundaryStatus = "source-verified" | "unverified";

export interface ReportingPeriod {
  basis: ReportingPeriodBasis;
  /** Flow start; null for an instantaneous balance-sheet observation. */
  start: string | null;
  end: string;
  fiscalYearId: string | null;
  fiscalYearStart: string | null;
  fiscalYearEnd: string | null;
  fiscalYearBoundaryStatus: FiscalYearBoundaryStatus;
  fiscalQuarterId: string | null;
  fiscalQuarterNumber: number | null;
  fiscalQuarterStart: string | null;
  fiscalQuarterEnd: string | null;
  fiscalCalendarId: string | null;
  sourcePeriodLabel: string;
  durationDays: number | null;
  durationWeeks: number | null;
  completeness: PeriodCompleteness;
}

export type FinancialStatementCategory = "income-statement" | "balance-sheet" | "cash-flow";
export type FinancialMetricMappingStatus = "verified" | "unverified" | "ambiguous";
export type FinancialUnit =
  | "currency"
  | "shares"
  | "currency-per-share"
  | "percentage"
  | "ratio"
  | "count"
  | "unknown";
export type FinancialScale = "units" | "thousands" | "millions" | "billions" | "unknown";
export type DecimalString = string & { readonly __decimalStringBrand: unique symbol };

/** Null means missing/not reported; the numeric string "0" is a reported zero. */
export interface FinancialObservation {
  id: string;
  securityId: string;
  statementCategory: FinancialStatementCategory;
  metricKey: string;
  /** Provider/source field's mapping to metricKey; calculations require verified mappings. */
  metricMappingStatus: FinancialMetricMappingStatus;
  providerMetricName: string;
  value: DecimalString | null;
  currency: string | null;
  unit: FinancialUnit;
  scale: FinancialScale;
  period: ReportingPeriod;
  accountingBasis: string | null;
  consolidationScope: string | null;
  source: FinancialDataProvenance;
  derivation?: {
    ruleId: string;
    observationIds: string[];
  };
}

export type FinancialMetricId =
  | "revenue-growth"
  | "gross-margin"
  | "operating-margin"
  | "net-margin"
  | "operating-cash-flow"
  | "free-cash-flow"
  | "current-ratio"
  | "debt-to-equity"
  | "price-to-earnings";

export type FinancialCalculationStatus =
  | "calculated"
  | "missing_inputs"
  | "insufficient_history"
  | "incompatible_periods"
  | "incompatible_currency"
  | "incompatible_units"
  | "incompatible_scope"
  | "zero_denominator"
  | "not_meaningful"
  | "invalid_input"
  | "permission_denied"
  | "unsupported_definition";

export interface FinancialCalculationResult {
  id: string;
  metricId: FinancialMetricId;
  displayName: string;
  definitionStatus: "proposed-open";
  securityId: string | null;
  value: DecimalString | null;
  unit: FinancialUnit;
  currency: string | null;
  scale: FinancialScale | null;
  reportingPeriod: ReportingPeriod | null;
  periodType: ReportingPeriodBasis | null;
  formulaIdentifier: string;
  formulaVersion: string;
  inputObservationIds: string[];
  evidenceIds: string[];
  calculationTimestamp: string;
  rounding: {
    mode: "half-up-away-from-zero" | "none";
    calculationDecimalPlaces: number | null;
    displayDecimalPlaces: number;
  };
  status: FinancialCalculationStatus;
  explanation?: string;
}

export interface IncomeStatementObservation extends FinancialObservation {
  statementCategory: "income-statement";
}

export interface BalanceSheetObservation extends FinancialObservation {
  statementCategory: "balance-sheet";
  period: ReportingPeriod & { basis: "instant"; start: null };
}

export interface CashFlowObservation extends FinancialObservation {
  statementCategory: "cash-flow";
}

export interface CompanyProfileFact {
  field: "business-description" | "sector" | "industry" | "country" | "website" | "headquarters";
  value: string | null;
  providerField: string;
  asOf: string | null;
}

export interface CompanyProfileRecord {
  securityId: string;
  canonicalSymbol: string;
  exchange: string;
  companyName: string;
  facts: CompanyProfileFact[];
  source: FinancialDataProvenance;
}

export type ProviderResultStatus = "complete" | "partial" | "unavailable" | "error";
export type ProviderCoverageStatus = "supported" | "partial" | "unsupported" | "ambiguous";
export type StatementSectionStatus = "complete" | "partial" | "unavailable" | "error";

export interface ProviderCoverage {
  status: ProviderCoverageStatus;
  supportedFields: string[];
  missingFields: string[];
  message?: string;
}

export interface ProviderFailure {
  code: string;
  message: string;
  issues?: ProviderValidationIssue[];
}

export interface ProviderValidationIssue {
  observationId: string | null;
  path: string;
  code: string;
  /** Generic field-level explanation; never includes raw provider values. */
  message: string;
}

export interface ProviderResult<T> {
  status: ProviderResultStatus;
  provider: { id: string; name: string; isDemo: boolean };
  coverage: ProviderCoverage;
  retrievedAt: string;
  dataEnvironment: DataEnvironment;
  entitlements: DataEntitlement[];
  data: T | null;
  failure?: ProviderFailure;
}

export interface StatementSection<T extends FinancialObservation> {
  status: StatementSectionStatus;
  observations: T[];
  missingFields: string[];
  message?: string;
}

export interface FinancialStatementBundle {
  incomeStatement: StatementSection<IncomeStatementObservation>;
  balanceSheet: StatementSection<BalanceSheetObservation>;
  cashFlow: StatementSection<CashFlowObservation>;
}

export interface FundamentalsProvider {
  readonly providerId: string;
  readonly providerName: string;
  readonly isDemo: boolean;
  /** Server-owned contract identity for research entitlement scope; absent means research evidence is denied. */
  getResearchEntitlementContract?(): { readonly dataset: string; readonly contractId: string; readonly contractVersion: string; readonly retrievalScope: "dataset" | "source-record" } | null;
  /** Must resolve signed dataset-level retrieval authorization without fetching protected response data. */
  getResearchRetrievalPreflight?(identity: SecurityIdentity): Promise<TechnicalEntitlementPreflight | null>;
  resolveSecurity(identity: SecurityIdentity): SecurityMappingResolution;
  getCompanyProfile(identity: SecurityIdentity): Promise<ProviderResult<CompanyProfileRecord>>;
  getFinancialStatements(identity: SecurityIdentity): Promise<ProviderResult<FinancialStatementBundle>>;
}
