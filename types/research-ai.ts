import type { DeepReadonly, ResearchEvidenceItem } from "@/types/research";

export const RESEARCH_REPORT_SCHEMA_VERSION = "1.0.0" as const;

export const RESEARCH_REPORT_SECTIONS = [
  "executive_summary",
  "company_overview",
  "financial_performance",
  "opportunities",
  "risks",
  "news_developments",
  "esg_discussion",
  "outlook_and_uncertainty"
] as const;

export type ResearchReportSection = typeof RESEARCH_REPORT_SECTIONS[number];
export type ResearchFactReferenceKind = "reported_observation" | "calculated_metric";

/** A model-selected pointer only. All values and descriptive labels are resolved from server evidence. */
export interface ResearchReportFactReferenceDraft {
  referenceId: string;
  section: ResearchReportSection;
  kind: ResearchFactReferenceKind;
  evidenceId: string;
  metricKey: string;
  periodEnd: string;
  currency: string | null;
  unit: string;
  scale: string | null;
  formulaIdentifier: string | null;
  formulaVersion: string | null;
  inputEvidenceIds: string[];
}

/** AI prose is always unverified interpretation; context IDs do not certify semantic support. */
export interface ResearchReportInterpretationDraft {
  interpretationId: string;
  section: ResearchReportSection;
  text: string;
  contextEvidenceIds: string[];
}

export type ResearchReportSectionReferences = Record<ResearchReportSection, {
  factReferenceIds: string[];
  interpretationIds: string[];
}>;

export interface StructuredResearchReportDraft {
  schemaVersion: typeof RESEARCH_REPORT_SCHEMA_VERSION;
  snapshotId: string;
  snapshotDigest: string;
  securityId: string;
  sections: ResearchReportSectionReferences;
  factReferences: ResearchReportFactReferenceDraft[];
  interpretations: ResearchReportInterpretationDraft[];
}

/** Values in this object are copied from authoritative server evidence, never authored by the model. */
export interface ResolvedResearchFact {
  referenceId: string;
  section: ResearchReportSection;
  kind: ResearchFactReferenceKind;
  evidenceId: string;
  label: string;
  value: string;
  metricKey: string;
  periodEnd: string;
  currency: string | null;
  unit: string;
  scale: string | null;
  formulaIdentifier: string | null;
  formulaVersion: string | null;
  inputEvidenceIds: string[];
}

export interface UnverifiedResearchInterpretation {
  interpretationId: string;
  section: ResearchReportSection;
  text: string;
  contextEvidenceIds: string[];
  classification: "unverified_ai_interpretation";
}

export interface ValidatedResearchReportDraft {
  schemaVersion: typeof RESEARCH_REPORT_SCHEMA_VERSION;
  snapshotId: string;
  snapshotDigest: string;
  securityId: string;
  sections: ResearchReportSectionReferences;
  verifiedFacts: ResolvedResearchFact[];
  interpretations: UnverifiedResearchInterpretation[];
  structuralValidation: "passed";
  publicationEligibility: "not_eligible_step_3_2";
}

export interface ResearchGenerationOptions {
  signal: AbortSignal;
}

/** Minimal prompt data. Request authority, permission receipts, signed records and operation decisions are deliberately absent. */
export interface ResearchGenerationEvidence {
  readonly evidenceId: string;
  readonly kind: ResearchEvidenceItem["kind"];
  readonly subjectSecurityId: string;
  readonly sources: readonly { readonly providerId: string; readonly dataset: string; readonly market: string; readonly sourceRecordId: string; readonly sourceAsOf: string | null }[];
  readonly facts: Readonly<Record<string, unknown>>;
}

export interface ResearchGenerationInput {
  readonly snapshotId: string;
  readonly snapshotDigest: string;
  readonly securityId: string;
  readonly subject: { readonly symbol: string; readonly exchange: string; readonly currency: string; readonly companyName: string };
  readonly evidence: readonly ResearchGenerationEvidence[];
}

export interface ResearchGenerationProvider {
  readonly providerId: string;
  readonly modelId: string;
  /** Must honor AbortSignal and returns untrusted structured output. */
  generateStructuredReport(
    input: DeepReadonly<ResearchGenerationInput>,
    options: ResearchGenerationOptions
  ): Promise<unknown>;
}

export interface AIOutputValidationIssue {
  path: string;
  code: string;
  message: string;
}

export type AIOutputValidationResult =
  | { ok: true; value: ValidatedResearchReportDraft }
  | { ok: false; errors: AIOutputValidationIssue[] };

export type AIProviderErrorCode =
  | "missing_configuration"
  | "invalid_configuration"
  | "authentication_failed"
  | "rate_limited"
  | "request_timeout"
  | "request_cancelled"
  | "provider_unavailable"
  | "invalid_provider_response"
  | "output_validation_failure"
  | "unsupported_operation";
