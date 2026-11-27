import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ResearchEvidenceItem, ResearchEvidenceSnapshot } from "@/types/research";
import { RESEARCH_REPORT_SCHEMA_VERSION, RESEARCH_REPORT_SECTIONS, type ResearchReportSectionReferences, type StructuredResearchReportDraft } from "@/types/research-ai";
import { computeResearchEvidenceSnapshotDigest, validateStructuredResearchReport as validateStructuredResearchReportCore } from "@/lib/research/ai/validation";
import { renderVerifiedResearchFacts } from "@/lib/research/ai/render";
import { assembleResearchEvidence, isTrustedResearchEvidenceSnapshot } from "@/lib/research/evidence";
import { MockFundamentalsProvider } from "@/lib/providers/mock-fundamentals-provider";
import { parseDecimalString } from "@/lib/financial/decimal";
import { demoSecurities } from "@/lib/data/demo-data";
import { testResearchContext, withSignedSyntheticFundamentals } from "@/lib/research/testing/research-fixtures";
import type { TrustedResearchRequestContext } from "@/types/research-context";
import { createResearchGenerationInput } from "@/lib/research/ai/input.server";
import { getNewsArticles } from "@/lib/news/service";
import { signedSyntheticNewsRecord } from "@/lib/research/testing/research-fixtures";

const securityId = demoSecurities.find((security) => security.symbol === "NVDA")!.id;
let snapshot!: ResearchEvidenceSnapshot;
let evidenceId = "";
let requestContext!: TrustedResearchRequestContext;

function validateStructuredResearchReport(output: unknown, target: ResearchEvidenceSnapshot = snapshot) {
  return validateStructuredResearchReportCore(output, target, requestContext);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child));
  }
  return value;
}

function financialEvidence() {
  const item = snapshot.evidence.find((candidate) => candidate.evidenceId === evidenceId);
  if (!item || item.kind !== "financial-observation") throw new Error("Trusted financial test evidence was not assembled.");
  return item;
}

beforeAll(async () => {
  requestContext = await testResearchContext(securityId);
  const assembled = await assembleResearchEvidence(securityId, {
    requestContext,
    assembledAt: "2026-11-26T12:00:00.000Z",
    freshnessEvaluator: () => "current",
    newsArticles: [],
    newsCoverageStatus: "unavailable"
  }, { fundamentalsProvider: withSignedSyntheticFundamentals(new MockFundamentalsProvider()), loadNewsArticles: async () => [] });
  snapshot = assembled as unknown as ResearchEvidenceSnapshot;
  const revenue = assembled.evidence.find((item) => item.kind === "financial-observation" && item.observation.metricKey === "revenue" && item.observation.value !== null);
  if (!revenue || revenue.kind !== "financial-observation") throw new Error("Mock provider did not supply revenue evidence.");
  evidenceId = revenue.evidenceId;
});

function emptySections(): ResearchReportSectionReferences {
  return Object.fromEntries(RESEARCH_REPORT_SECTIONS.map((section) => [section, { factReferenceIds: [], interpretationIds: [] }])) as unknown as ResearchReportSectionReferences;
}

function validDraft(): StructuredResearchReportDraft {
  const observation = financialEvidence().observation;
  return {
    schemaVersion: RESEARCH_REPORT_SCHEMA_VERSION,
    snapshotId: snapshot.snapshotId,
    snapshotDigest: computeResearchEvidenceSnapshotDigest(snapshot),
    securityId,
    sections: { ...emptySections(), financial_performance: { factReferenceIds: ["fact_1"], interpretationIds: ["interpretation_1"] } },
    factReferences: [{ referenceId: "fact_1", section: "financial_performance", kind: "reported_observation", evidenceId,
      metricKey: observation.metricKey, periodEnd: observation.period.end, currency: observation.currency, unit: observation.unit, scale: observation.scale,
      formulaIdentifier: null, formulaVersion: null, inputEvidenceIds: [] }],
    interpretations: [{ interpretationId: "interpretation_1", section: "financial_performance", text: "This may reflect a change in business activity.", contextEvidenceIds: [evidenceId] }]
  };
}

function codes(result: ReturnType<typeof validateStructuredResearchReport>): string[] {
  return result.ok ? [] : result.errors.map((issue) => issue.code);
}

describe("structured research report validation", () => {
  it("blocks an AI-eligible cited fact when its signed source denies display", async () => {
    const deniedSnapshot = await assembleResearchEvidence(securityId, {
      requestContext, assembledAt: "2026-11-26T12:00:00.000Z", newsArticles: [], newsCoverageStatus: "unavailable"
    }, { fundamentalsProvider: withSignedSyntheticFundamentals(new MockFundamentalsProvider(), "display"), loadNewsArticles: async () => [] });
    const deniedTrustedSnapshot = deniedSnapshot as unknown as ResearchEvidenceSnapshot;
    const item = deniedSnapshot.evidence.find((candidate) => candidate.kind === "financial-observation" && candidate.observation.metricKey === "revenue");
    if (!item || item.kind !== "financial-observation") throw new Error("Display-denied fixture was not assembled.");
    const assessment = deniedSnapshot.permissionAssessments.find((entry) => entry.assessmentId === item.permissionAssessmentIds[0]);
    expect(assessment?.decisions["ai-processing"].allowed).toBe(true);
    expect(assessment?.decisions.display.allowed).toBe(false);
    const observation = item.observation;
    const draft: StructuredResearchReportDraft = {
      schemaVersion: RESEARCH_REPORT_SCHEMA_VERSION, snapshotId: deniedSnapshot.snapshotId,
      snapshotDigest: computeResearchEvidenceSnapshotDigest(deniedTrustedSnapshot), securityId,
      sections: { ...emptySections(), financial_performance: { factReferenceIds: ["fact_display"], interpretationIds: [] } },
      factReferences: [{ referenceId: "fact_display", section: "financial_performance", kind: "reported_observation", evidenceId: item.evidenceId,
        metricKey: observation.metricKey, periodEnd: observation.period.end, currency: observation.currency, unit: observation.unit, scale: observation.scale,
        formulaIdentifier: null, formulaVersion: null, inputEvidenceIds: [] }],
      interpretations: []
    };
    const validation = validateStructuredResearchReportCore(draft, deniedTrustedSnapshot, requestContext);
    expect(validation.ok).toBe(true);
    if (validation.ok) expect(() => renderVerifiedResearchFacts(validation.value, deniedTrustedSnapshot, requestContext)).toThrow("display permission");
  });

  it("blocks a calculated fact when one source in its multi-source lineage denies display", async () => {
    const baseProvider = new MockFundamentalsProvider();
    const provider = {
      providerId: baseProvider.providerId, providerName: baseProvider.providerName, isDemo: baseProvider.isDemo,
      resolveSecurity: (identity: Parameters<typeof baseProvider.resolveSecurity>[0]) => baseProvider.resolveSecurity(identity),
      async getCompanyProfile(identity: Parameters<typeof baseProvider.getCompanyProfile>[0]) { return baseProvider.getCompanyProfile(identity); },
      async getFinancialStatements(identity: Parameters<typeof baseProvider.getFinancialStatements>[0]) {
        const result = await baseProvider.getFinancialStatements(identity);
        if (!result.data) return result;
        const bundle = structuredClone(result.data);
        const revenue = bundle.incomeStatement.observations.find((item) => item.metricKey === "revenue" && item.period.basis === "trailing-twelve-month");
        if (revenue) bundle.incomeStatement.observations.push({ ...revenue, id: `synthetic-gross-profit-${identity.securityId}`, metricKey: "gross-profit", value: parseDecimalString("2100000")!,
          source: { ...revenue.source, sourceRecordId: `synthetic-gross-profit-${identity.securityId}` } });
        return { ...result, data: bundle };
      }
    };
    const deniedSnapshot = await assembleResearchEvidence(securityId, {
      requestContext, assembledAt: "2026-11-26T12:00:00.000Z", newsArticles: [], newsCoverageStatus: "unavailable"
    }, { fundamentalsProvider: withSignedSyntheticFundamentals(provider, (id) => id.startsWith("synthetic-gross-profit-") ? "display" : undefined), loadNewsArticles: async () => [] });
    const trusted = deniedSnapshot as unknown as ResearchEvidenceSnapshot;
    const metric = trusted.evidence.find((item) => item.kind === "calculated-metric" && item.inputEvidenceIds.length > 1 && item.inputEvidenceIds.some((inputId) => inputId.includes("gross-profit")));
    if (!metric || metric.kind !== "calculated-metric") throw new Error("Multi-source calculation fixture was unavailable.");
    const deniedInput = trusted.evidence.find((item) => item.kind === "financial-observation" && item.observation.id.includes("gross-profit"));
    expect(deniedInput?.kind).toBe("financial-observation");
    const inputAssessment = trusted.permissionAssessments.find((entry) => entry.assessmentId === deniedInput?.permissionAssessmentIds[0]);
    expect(inputAssessment?.decisions.display.allowed).toBe(false);
    const calculation = metric.calculation;
    const draft: StructuredResearchReportDraft = {
      schemaVersion: RESEARCH_REPORT_SCHEMA_VERSION, snapshotId: trusted.snapshotId,
      snapshotDigest: computeResearchEvidenceSnapshotDigest(trusted), securityId,
      sections: { ...emptySections(), financial_performance: { factReferenceIds: ["metric_display"], interpretationIds: [] } },
      factReferences: [{ referenceId: "metric_display", section: "financial_performance", kind: "calculated_metric", evidenceId: metric.evidenceId,
        metricKey: calculation.metricId, periodEnd: calculation.reportingPeriod?.end ?? "unknown", currency: calculation.currency, unit: calculation.unit, scale: calculation.scale,
        formulaIdentifier: calculation.formulaIdentifier, formulaVersion: calculation.formulaVersion, inputEvidenceIds: [...metric.inputEvidenceIds] }],
      interpretations: []
    };
    const validation = validateStructuredResearchReportCore(draft, trusted, requestContext);
    expect(validation.ok).toBe(true);
    if (validation.ok) expect(() => renderVerifiedResearchFacts(validation.value, trusted, requestContext)).toThrow("display permission");
  });

  it("rejects a model citation to evidence excluded for AI processing", async () => {
    const deniedSnapshot = await assembleResearchEvidence(securityId, {
      requestContext, assembledAt: "2026-11-26T12:00:00.000Z", newsArticles: [], newsCoverageStatus: "unavailable"
    }, { fundamentalsProvider: withSignedSyntheticFundamentals(new MockFundamentalsProvider(), "ai-processing"), loadNewsArticles: async () => [] });
    const trusted = deniedSnapshot as unknown as ResearchEvidenceSnapshot;
    const draft = validDraft();
    draft.snapshotId = trusted.snapshotId;
    draft.snapshotDigest = computeResearchEvidenceSnapshotDigest(trusted);
    expect(trusted.evidence.some((item) => item.evidenceId === evidenceId)).toBe(false);
    expect(validateStructuredResearchReportCore(draft, trusted, requestContext).ok).toBe(false);
  });

  it("rechecks entitlement expiry at render time after validation", () => {
    const result = validateStructuredResearchReport(validDraft(), snapshot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2036-01-01T00:00:00.000Z"));
    try { expect(() => renderVerifiedResearchFacts(result.value, snapshot, requestContext)).toThrow("not bound to this evidence snapshot"); }
    finally { vi.useRealTimers(); }
  });
  it("resolves facts from immutable evidence and labels prose unverified", () => {
    const result = validateStructuredResearchReport(validDraft(), snapshot);
    const observation = financialEvidence().observation;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.verifiedFacts[0]).toMatchObject({ value: observation.value, currency: observation.currency, periodEnd: observation.period.end, metricKey: observation.metricKey });
      expect(result.value.interpretations[0].classification).toBe("unverified_ai_interpretation");
      expect(result.value.publicationEligibility).toBe("not_eligible_step_3_2");
    }
  });

  it("renders financial values and context from the authoritative snapshot", () => {
    const result = validateStructuredResearchReport(validDraft(), snapshot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.isFrozen(result.value)).toBe(true);
    const rendered = renderVerifiedResearchFacts(result.value, snapshot, requestContext);
    const observation = financialEvidence().observation;
    const amount = [observation.value, observation.scale, observation.currency, observation.unit === "currency" ? null : observation.unit].filter(Boolean).join(" ");
    expect(rendered[0]).toMatchObject({
      value: observation.value, currency: observation.currency, unit: observation.unit, scale: observation.scale, periodEnd: observation.period.end,
      displayText: `${observation.metricKey}: ${amount} (${observation.period.basis} ending ${observation.period.end})`
    });
    expect(Object.isFrozen(rendered)).toBe(true);
    expect(() => renderVerifiedResearchFacts(structuredClone(result.value), snapshot, requestContext)).toThrow("not bound to this evidence snapshot");
    expect(() => renderVerifiedResearchFacts(result.value, deepFreeze({ ...structuredClone(snapshot), snapshotId: "snapshot:other" }), requestContext))
      .toThrow("not bound to this evidence snapshot");
  });

  it("accepts provider JSON strings and rejects malformed JSON", () => {
    expect(validateStructuredResearchReport(JSON.stringify(validDraft()), snapshot).ok).toBe(true);
    expect(codes(validateStructuredResearchReport("{malformed", snapshot))).toContain("MALFORMED_JSON");
  });

  it("rejects invented evidence IDs", () => {
    const draft = validDraft();
    draft.factReferences[0].evidenceId = "invented:evidence";
    expect(codes(validateStructuredResearchReport(draft, snapshot))).toContain("INELIGIBLE_EVIDENCE_REFERENCE");
  });

  it("rejects model-authored numeric values on fact references", () => {
    const draft = validDraft() as StructuredResearchReportDraft & { factReferences: Array<Record<string, unknown>> };
    draft.factReferences[0].value = "999999";
    const result = validateStructuredResearchReport(draft, snapshot);
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("UNEXPECTED_FIELD");
  });

  it("rejects cross-period, metric, unit and currency mismatches", () => {
    const mismatches: Array<(draft: StructuredResearchReportDraft) => void> = [
      (draft) => { draft.factReferences[0].periodEnd = "2025-09-30"; },
      (draft) => { draft.factReferences[0].metricKey = "net-income"; },
      (draft) => { draft.factReferences[0].unit = "shares"; },
      (draft) => { draft.factReferences[0].currency = "EUR"; }
    ];
    for (const mutate of mismatches) {
      const draft = validDraft();
      mutate(draft);
      expect(codes(validateStructuredResearchReport(draft, snapshot))).toContain("FACT_METADATA_MISMATCH");
    }
  });

  it("does not upgrade contradictory or irrelevant prose into verified facts", () => {
    const draft = validDraft();
    draft.interpretations[0].text = "Revenue collapsed by 200%, proving the company is insolvent.";
    draft.factReferences = [];
    draft.sections.financial_performance.factReferenceIds = [];
    const result = validateStructuredResearchReport(draft, snapshot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.verifiedFacts).toHaveLength(0);
      expect(result.value.interpretations[0].classification).toBe("unverified_ai_interpretation");
    }
  });

  it("rejects extra fields, source URLs, and model-owned statuses", () => {
    const withUrl = { ...validDraft(), sourceUrl: "https://untrusted.example" };
    expect(codes(validateStructuredResearchReport(withUrl, snapshot))).toContain("SERVER_OWNED_OR_UNSUPPORTED_FIELD");
    const withStatus = { ...validDraft(), freshnessStatus: "current" };
    expect(codes(validateStructuredResearchReport(withStatus, snapshot))).toContain("SERVER_OWNED_OR_UNSUPPORTED_FIELD");
    const withNestedField = validDraft() as StructuredResearchReportDraft & { interpretations: Array<Record<string, unknown>> };
    withNestedField.interpretations[0].vendorPayload = "unexpected data";
    expect(codes(validateStructuredResearchReport(withNestedField, snapshot))).toContain("UNEXPECTED_FIELD");
  });

  it("rejects missing required structure", () => {
    const missing = validDraft() as unknown as Record<string, unknown>;
    delete missing.snapshotId;
    expect(codes(validateStructuredResearchReport(missing, snapshot))).toContain("MISSING_FIELD");
  });

  it("rejects duplicate and misfiled report references", () => {
    const duplicate = validDraft();
    duplicate.sections.company_overview = { factReferenceIds: ["fact_1"], interpretationIds: [] };
    expect(codes(validateStructuredResearchReport(duplicate, snapshot))).toContain("DUPLICATE_ITEM_REFERENCE");

    const misfiled = validDraft();
    misfiled.sections.financial_performance = { factReferenceIds: [], interpretationIds: [] };
    expect(codes(validateStructuredResearchReport(misfiled, snapshot))).toContain("UNREFERENCED_FACT");
  });

  it("rejects oversized outputs, excessive claim text and invalid snapshots", () => {
    expect(codes(validateStructuredResearchReport("x".repeat(48_001), snapshot))).toContain("OUTPUT_TOO_LONG");

    const otherSubject = structuredClone(snapshot);
    otherSubject.securityMapping.status = "unsupported";
    expect(codes(validateStructuredResearchReport(validDraft(), deepFreeze(otherSubject)))).toContain("INVALID_EVIDENCE_SNAPSHOT");
  });

  it("rejects invalid interpretation context references", () => {
    const invalidContext = validDraft(); invalidContext.interpretations[0].contextEvidenceIds = ["invented:evidence"];
    expect(codes(validateStructuredResearchReport(invalidContext, snapshot))).toContain("INVALID_CONTEXT_EVIDENCE");
  });

  it("rejects cross-company nested identity and mutable snapshots", () => {
    const wrongTopLevelIdentity = structuredClone(snapshot);
    const observationIndex = wrongTopLevelIdentity.evidence.findIndex((item) => item.evidenceId === evidenceId);
    wrongTopLevelIdentity.evidence[observationIndex].subjectSecurityId = "US:XNAS:MSFT";
    expect(codes(validateStructuredResearchReport(validDraft(), deepFreeze(wrongTopLevelIdentity)))).toContain("INELIGIBLE_EVIDENCE");

    const otherCompany = structuredClone(snapshot);
    const otherCompanyObservation = otherCompany.evidence.find((item) => item.evidenceId === evidenceId);
    if (otherCompanyObservation?.kind === "financial-observation") otherCompanyObservation.observation.securityId = "US:XNAS:MSFT";
    expect(codes(validateStructuredResearchReport(validDraft(), deepFreeze(otherCompany)))).toContain("NESTED_EVIDENCE_IDENTITY_MISMATCH");

    const wrongNewsIdentity = structuredClone(snapshot);
    wrongNewsIdentity.evidence.push({
      evidenceId: "news:wrong-security", kind: "company-news-article", subjectSecurityId: securityId, sources: [],
      sourceAsOf: "2026-11-25T00:00:00.000Z", collectedAt: "2026-11-26T12:00:00.000Z", freshness: "current", aiProcessingEligible: true,
      article: { id: "wrong-security", securityId: "US:XNAS:MSFT", symbol: "MSFT" }
    } as unknown as ResearchEvidenceItem);
    expect(codes(validateStructuredResearchReport(validDraft(), deepFreeze(wrongNewsIdentity)))).toContain("NESTED_EVIDENCE_IDENTITY_MISMATCH");
    expect(codes(validateStructuredResearchReport(validDraft(), structuredClone(snapshot)))).toContain("INVALID_EVIDENCE_SNAPSHOT");
  });

  it("rejects forged or altered permission receipts", () => {
    const forged = structuredClone(snapshot);
    const item = forged.evidence.find((candidate) => candidate.evidenceId === evidenceId);
    if (!item) throw new Error("Expected assembled financial evidence.");
    item.aiProcessingEligible = true;
    const permissionId = item.permissionAssessmentIds[0];
    const assessment = forged.permissionAssessments.find((candidate) => candidate.assessmentId === permissionId)!;
    assessment.decisions["ai-processing"].allowed = false;
    const frozen = deepFreeze(forged);
    const draft = validDraft();
    draft.snapshotDigest = computeResearchEvidenceSnapshotDigest(frozen);
    const result = validateStructuredResearchReport(draft, frozen);
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("UNTRUSTED_EVIDENCE_SNAPSHOT");
    expect(codes(result)).toContain("UNTRUSTED_EVIDENCE_SNAPSHOT");
  });

  it("fails closed on missing, inconsistent or invalid source provenance", () => {
    const cases: Array<{ mutate: (snapshot: ResearchEvidenceSnapshot) => void; code: string }> = [
      { mutate: (copy) => { const item = copy.evidence.find((candidate) => candidate.evidenceId === evidenceId)!; item.sources = []; }, code: "UNTRUSTED_EVIDENCE_SNAPSHOT" },
      { mutate: (copy) => { const item = copy.evidence.find((candidate) => candidate.evidenceId === evidenceId)!; item.sources[0].providerId = "other-provider"; }, code: "UNTRUSTED_EVIDENCE_SNAPSHOT" },
      { mutate: (copy) => { const item = copy.evidence.find((candidate) => candidate.evidenceId === evidenceId)!; item.sources[0].dataEnvironment = "production-licensed"; }, code: "UNTRUSTED_EVIDENCE_SNAPSHOT" }
    ];
    for (const { mutate, code } of cases) {
      const copy = structuredClone(snapshot);
      mutate(copy);
      const frozen = deepFreeze(copy);
      const draft = validDraft();
      draft.snapshotDigest = computeResearchEvidenceSnapshotDigest(frozen);
      expect(codes(validateStructuredResearchReport(draft, frozen))).toContain(code);
    }
  });

  it("preserves assembler-approved synthetic demo permissions in the test audience", () => {
    expect(isTrustedResearchEvidenceSnapshot(snapshot)).toBe(true);
    const source = financialEvidence().sources[0];
    expect(source).toMatchObject({ sourceKind: "synthetic", dataEnvironment: "synthetic" });
    const assessment = snapshot.permissionAssessments.find((entry) => entry.assessmentId === financialEvidence().permissionAssessmentIds[0]);
    expect(assessment?.sourceScope.audience).toBe("demo-only");
    expect(assessment?.decisions.retrieval.allowed).toBe(true);
    expect(assessment?.decisions["ai-processing"].allowed).toBe(true);
    expect(validateStructuredResearchReport(validDraft(), snapshot).ok).toBe(true);
  });

  it("projects only permission-cleared facts and rejects reuse under another security context", async () => {
    const projected = createResearchGenerationInput(snapshot, requestContext);
    const serialized = JSON.stringify(projected);
    expect(serialized).not.toContain("entitlementReceipts");
    expect(serialized).not.toContain("permissionAssessments");
    expect(serialized).not.toContain("requestId");
    expect(serialized).not.toContain('"integrity"');
    expect(projected.evidence.length).toBeGreaterThan(0);
    const otherContext = await testResearchContext(demoSecurities.find((security) => security.symbol === "MSFT")!.id);
    expect(() => createResearchGenerationInput(snapshot, otherContext)).toThrow("Trusted permission-cleared research evidence");
  });

  it("rejects oversized individual and aggregate generation evidence without truncation", async () => {
    const base = (await getNewsArticles()).find((article) => article.securityId === securityId)!;
    const largeItems = Array.from({ length: 6 }, (_, index) => ({ ...structuredClone(base), id: `large-news-${index}`, body: "x".repeat(35_000), contentKind: "demo" as const }));
    const records = Object.fromEntries(largeItems.map((article) => [article.id, [signedSyntheticNewsRecord(article, demoSecurities.find((item) => item.id === securityId)!.exchange)]]));
    const aggregateSnapshot = await assembleResearchEvidence(securityId, { requestContext, newsArticles: largeItems, newsEntitlementRecords: records }, {
      fundamentalsProvider: withSignedSyntheticFundamentals(new MockFundamentalsProvider()), loadNewsArticles: async () => []
    });
    expect(() => createResearchGenerationInput(aggregateSnapshot as unknown as ResearchEvidenceSnapshot, requestContext)).toThrow("aggregate generation limits");

    const oversized = { ...structuredClone(base), id: "oversized-news", body: "x".repeat(40_001), contentKind: "demo" as const };
    const oversizedSnapshot = await assembleResearchEvidence(securityId, {
      requestContext, newsArticles: [oversized], newsEntitlementRecords: { [oversized.id]: [signedSyntheticNewsRecord(oversized, demoSecurities.find((item) => item.id === securityId)!.exchange)] }
    }, { fundamentalsProvider: withSignedSyntheticFundamentals(new MockFundamentalsProvider()), loadNewsArticles: async () => [] });
    expect(() => createResearchGenerationInput(oversizedSnapshot as unknown as ResearchEvidenceSnapshot, requestContext)).toThrow("field exceeds generation limits");
  });

  it("rejects generation evidence whose nested collections exceed the node budget", async () => {
    const article = { ...structuredClone((await getNewsArticles()).find((item) => item.securityId === securityId)!), id: "nested-news", contentKind: "demo" as const };
    article.sentiment.matchedPositiveTerms = Array.from({ length: 1_200 }, () => "term");
    const newsEntitlementRecords = { [article.id]: [signedSyntheticNewsRecord(article, demoSecurities.find((item) => item.id === securityId)!.exchange)] };
    const nestedSnapshot = await assembleResearchEvidence(securityId, { requestContext, newsArticles: [article], newsEntitlementRecords }, {
      fundamentalsProvider: withSignedSyntheticFundamentals(new MockFundamentalsProvider()), loadNewsArticles: async () => []
    });
    expect(() => createResearchGenerationInput(nestedSnapshot as unknown as ResearchEvidenceSnapshot, requestContext)).toThrow("structure limits");
  });

  it("renders a deterministic calculation from its exact same-security input lineage", () => {
    const calculationItem = snapshot.evidence.find((item) => item.kind === "calculated-metric");
    if (!calculationItem || calculationItem.kind !== "calculated-metric") throw new Error("Mock provider did not produce a deterministic test metric.");
    const calculation = calculationItem.calculation;
    const draft = validDraft();
    draft.factReferences.push({ referenceId: "fact_2", section: "financial_performance", kind: "calculated_metric", evidenceId: calculationItem.evidenceId,
      metricKey: calculation.metricId, periodEnd: calculation.reportingPeriod?.end ?? "unknown", currency: calculation.currency, unit: calculation.unit, scale: calculation.scale,
      formulaIdentifier: calculation.formulaIdentifier, formulaVersion: calculation.formulaVersion, inputEvidenceIds: [...calculationItem.inputEvidenceIds] });
    draft.sections.financial_performance.factReferenceIds.push("fact_2");
    const result = validateStructuredResearchReport(draft, snapshot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.verifiedFacts.find((fact) => fact.referenceId === "fact_2")).toMatchObject({
        value: calculation.value, formulaIdentifier: calculation.formulaIdentifier, inputEvidenceIds: calculationItem.inputEvidenceIds
      });
      const rendered = renderVerifiedResearchFacts(result.value, snapshot, requestContext).find((fact) => fact.referenceId === "fact_2");
      const amount = [calculation.value, calculation.scale, calculation.currency, calculation.unit === "currency" ? null : calculation.unit].filter(Boolean).join(" ");
      const periodBasis = calculation.reportingPeriod?.basis ?? "unknown";
      const periodEnd = calculation.reportingPeriod?.end ?? "unknown";
      expect(rendered?.displayText).toBe(`${calculation.displayName}: ${amount} (${periodBasis} ending ${periodEnd})`);
    }

    const badLineage = structuredClone(snapshot);
    const badCalculation = badLineage.evidence.find((item) => item.evidenceId === calculationItem.evidenceId);
    if (!badCalculation || badCalculation.kind !== "calculated-metric") throw new Error("Cloned calculation fixture was missing.");
    badCalculation.inputEvidenceIds = ["observation:other-company"];
    const invalidSnapshot = deepFreeze(badLineage);
    const badDraft = { ...draft, snapshotDigest: computeResearchEvidenceSnapshotDigest(invalidSnapshot) };
    expect(codes(validateStructuredResearchReport(badDraft, invalidSnapshot))).toContain("INVALID_CALCULATION_LINEAGE");
  });

  it("rejects a snapshot content digest mismatch", () => {
    const draft = validDraft(); draft.snapshotDigest = "0".repeat(64);
    expect(codes(validateStructuredResearchReport(draft, snapshot))).toContain("SNAPSHOT_DIGEST_MISMATCH");

    const changed = structuredClone(snapshot);
    const changedFinancialEvidence = changed.evidence.find((item) => item.evidenceId === evidenceId);
    if (!changedFinancialEvidence || changedFinancialEvidence.kind !== "financial-observation") throw new Error("Cloned financial fixture was missing.");
    changedFinancialEvidence.observation.value = "126.50" as typeof changedFinancialEvidence.observation.value;
    expect(codes(validateStructuredResearchReport(validDraft(), deepFreeze(changed)))).toContain("SNAPSHOT_DIGEST_MISMATCH");
  });

  it("bounds deeply nested, high-node, and excessive-error payloads", () => {
    const nested = `${"[".repeat(2000)}null${"]".repeat(2000)}`;
    expect(codes(validateStructuredResearchReport(nested, snapshot))).toContain("OUTPUT_TOO_DEEP");
    const highNodes = validDraft();
    highNodes.sections.financial_performance.factReferenceIds = Array.from({ length: 10_001 }, () => "x");
    const serializedHighNodes = JSON.stringify(highNodes);
    expect(serializedHighNodes.length).toBeLessThan(48_000);
    expect(codes(validateStructuredResearchReport(serializedHighNodes, snapshot))).toContain("TOO_MANY_OUTPUT_NODES");
    const manyKeys = Object.fromEntries(Array.from({ length: 200 }, (_, index) => [`extra${index}`, index]));
    const result = validateStructuredResearchReport({ ...validDraft(), ...manyKeys }, snapshot);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeLessThanOrEqual(101);

    const tooManyFacts = validDraft();
    tooManyFacts.factReferences = Array.from({ length: 51 }, (_, index) => ({ ...tooManyFacts.factReferences[0], referenceId: `fact_${index}` }));
    expect(codes(validateStructuredResearchReport(tooManyFacts, snapshot))).toContain("INVALID_FACT_REFERENCE_COUNT");
  });

  it("rejects no-longer-eligible evidence in an immutable snapshot", () => {
    const ineligible = structuredClone(snapshot);
    (ineligible.evidence[0] as ResearchEvidenceItem & { aiProcessingEligible: boolean }).aiProcessingEligible = false;
    expect(codes(validateStructuredResearchReport(validDraft(), deepFreeze(ineligible)))).toContain("INELIGIBLE_EVIDENCE");
  });
});
