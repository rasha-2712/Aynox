import type {
  DataOperation, DataEnvironment, DataEntitlement, FinancialCalculationResult,
  FinancialObservation, ReportingPeriod, SecurityIdentity, TechnicalEntitlementPreflight, TechnicalEntitlementRecord, TechnicalEntitlementScope
} from "@/types/financial";
import type { TrustedResearchRequestContext } from "@/types/research-context";
import type { CompanyNewsReport, NewsArticle, SentimentDistribution } from "@/types/news";

export type DeepReadonly<T> = T extends (...args: never[]) => unknown ? T
  : T extends readonly (infer U)[] ? readonly DeepReadonly<U>[]
    : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;

export type ResearchEvidenceKind =
  | "company-profile"
  | "financial-observation"
  | "calculated-metric"
  | "company-news-article"
  | "company-news-summary"
  | "esg-observation";

export type EvidenceFreshness = "current" | "stale" | "unknown" | "mixed";
export type EvidenceCompleteness = "complete" | "partial" | "insufficient-evidence" | "unavailable";
export type EvidenceSectionStatus = "complete" | "partial" | "unavailable" | "not-assessed";

export interface ResearchSubject {
  securityId: string;
  symbol: string;
  exchange: string;
  currency: string;
  companyName: string;
}

export interface ResearchSourceProvenance {
  providerId: string;
  providerName: string;
  dataset: string;
  market: string;
  sourceRecordId: string;
  sourceUrl?: string;
  sourceAsOf: string | null;
  retrievedAt: string;
  dataEnvironment: DataEnvironment;
  revisionStatus?: string;
  revisionId?: string;
  sourceKind: "synthetic" | "development-restricted" | "production-licensed";
}

export interface EntitlementVerificationReceipt {
  receiptId: string;
  record: TechnicalEntitlementRecord;
  scope: TechnicalEntitlementScope;
  verificationStatus: "verified";
  verificationMethod: "ed25519";
  issuerId: string;
  keyId: string;
  verifiedAt: string;
  evaluatedAt: string;
  effectiveFrom: string;
  expiresAt: string;
  legalApprovalStatus: "pending";
}

export interface EvidenceOperationDecision {
  operation: DataOperation;
  allowed: boolean;
  reason: string;
  receiptId: string | null;
  evaluatedAt: string;
}

export interface EvidencePermissionAssessment {
  assessmentId: string;
  sourceScope: TechnicalEntitlementScope;
  decisions: Record<DataOperation, EvidenceOperationDecision>;
}

export interface ResearchEvidenceBase {
  evidenceId: string;
  kind: ResearchEvidenceKind;
  subjectSecurityId: string;
  sources: ResearchSourceProvenance[];
  sourceAsOf: string | null;
  collectedAt: string;
  freshness: EvidenceFreshness;
  aiProcessingEligible: boolean;
  permissionAssessmentIds: string[];
}

export interface CompanyProfileEvidence extends ResearchEvidenceBase {
  kind: "company-profile";
  field: string;
  value: string;
  providerField: string;
}

export interface FinancialStatementEvidence extends ResearchEvidenceBase {
  kind: "financial-observation";
  observation: FinancialObservation;
  reportingPeriod: ReportingPeriod;
}

export interface CalculatedMetricEvidence extends ResearchEvidenceBase {
  kind: "calculated-metric";
  calculation: FinancialCalculationResult;
  inputEvidenceIds: string[];
  formulaIdentifier: string;
  formulaVersion: string;
}

export interface CompanyNewsArticleEvidence extends ResearchEvidenceBase {
  kind: "company-news-article";
  article: NewsArticle;
  sentiment: NewsArticle["sentiment"];
  articleDate: string;
}

export interface CompanyNewsSummaryEvidence extends ResearchEvidenceBase {
  kind: "company-news-summary";
  report: CompanyNewsReport;
  sentiment: SentimentDistribution;
}

export interface ESGObservationEvidence extends ResearchEvidenceBase {
  kind: "esg-observation";
  score: string;
  label: string;
  methodology: string;
  verificationStatus: "verified";
}

export type ResearchEvidenceItem = CompanyProfileEvidence | FinancialStatementEvidence | CalculatedMetricEvidence
  | CompanyNewsArticleEvidence | CompanyNewsSummaryEvidence | ESGObservationEvidence;

export interface EvidenceLimitation {
  code: string;
  message: string;
  subjectSecurityId: string;
  sourceId?: string;
}

export interface ResearchEvidenceSnapshot {
  snapshotId: string;
  schemaVersion: "1.0.0";
  subject: ResearchSubject;
  securityMapping: { status: "resolved" | "ambiguous" | "unsupported"; providerId: string; reason?: string };
  assembledAt: string;
  contextBinding: {
    requestId: string;
    authorizedSecurityId: string;
    digest: string;
  };
  completeness: EvidenceCompleteness;
  freshness: EvidenceFreshness | "mixed";
  sections: {
    profile: EvidenceSectionStatus;
    financialStatements: EvidenceSectionStatus;
    calculatedMetrics: EvidenceSectionStatus;
    news: EvidenceSectionStatus;
    esg: EvidenceSectionStatus;
  };
  evidence: ResearchEvidenceItem[];
  entitlementReceipts: EntitlementVerificationReceipt[];
  permissionAssessments: EvidencePermissionAssessment[];
  limitations: EvidenceLimitation[];
  sourceObservationIds: string[];
  calculationVersions: Array<{ formulaIdentifier: string; formulaVersion: string }>;
}

export interface VerifiedEsgEvidenceCandidate {
  id: string;
  securityId: string;
  isIllustrative: boolean;
  score: string;
  label: string;
  source: ResearchSourceInput;
  sourceAsOf: string;
  methodology: string;
  sourceVerificationStatus: "verified" | "unverified";
  methodologyVerificationStatus: "verified" | "unverified";
}

export interface ResearchSourceInput {
  providerId: string;
  providerName: string;
  dataset: string;
  market: string;
  sourceRecordId: string;
  sourceUrl?: string;
  sourceAsOf: string | null;
  retrievedAt: string;
  dataEnvironment: DataEnvironment;
  entitlements: DataEntitlement[];
  technicalEntitlements?: TechnicalEntitlementRecord[];
  expectedContract?: { contractId: string; contractVersion: string };
  revisionStatus?: string;
  revisionId?: string;
}

export interface ResearchEvidenceAssemblyOptions {
  requestContext: TrustedResearchRequestContext;
  assembledAt?: string;
  /** Source policy injection; omitted means freshness is explicitly unknown. */
  freshnessEvaluator?: (sourceAsOf: string | null, assembledAt: string) => "current" | "stale" | "unknown";
  newsArticles?: NewsArticle[];
  /** Raw signed declarations. Structural DataEntitlement objects are intentionally not accepted here. */
  newsEntitlementRecords?: Record<string, TechnicalEntitlementRecord[]>;
  newsCoverageStatus?: "complete" | "partial" | "unavailable";
  esgCandidates?: VerifiedEsgEvidenceCandidate[];
}

export interface ResearchEvidenceAssemblerDependencies {
  fundamentalsProvider?: import("@/types/financial").FundamentalsProvider;
  /** External loaders must return no data unless this signed authorization is verified first. */
  newsRetrievalPreflight?: (identity: SecurityIdentity) => Promise<TechnicalEntitlementPreflight | null>;
  loadNewsArticles?: (authorization: import("@/types/news").VerifiedNewsRetrievalAuthorization) => Promise<NewsArticle[]>;
  makeSnapshotId?: () => string;
}
