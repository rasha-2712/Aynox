import "server-only";
import type { ResearchEvidenceItem, ResearchEvidenceSnapshot } from "@/types/research";
import type { ResearchGenerationEvidence, ResearchGenerationInput } from "@/types/research-ai";
import type { TrustedResearchRequestContext } from "@/types/research-context";
import { isTrustedResearchEvidenceSnapshot } from "@/lib/research/evidence";
import { matchesResearchContextBinding, revalidateResearchSnapshotPermissions } from "@/lib/research/evidence-permissions.server";
import { validateTrustedResearchRequestContext } from "@/lib/research/request-context.server";
import { computeResearchEvidenceSnapshotDigest } from "@/lib/research/ai/validation";

const MAX_GENERATION_EVIDENCE_ITEMS = 1_000;
const MAX_GENERATION_EVIDENCE_CHARS = 200_000;
const MAX_GENERATION_ITEM_CHARS = 40_000;
const MAX_GENERATION_ITEM_NODES = 1_000;
const MAX_GENERATION_ITEM_DEPTH = 32;

function projectedFacts(item: ResearchEvidenceItem): Record<string, unknown> {
  switch (item.kind) {
    case "company-profile": return { field: item.field, value: item.value, providerField: item.providerField };
    case "financial-observation": {
      const { value, metricKey, metricMappingStatus, currency, unit, scale, period, accountingBasis, consolidationScope } = item.observation;
      return { value, metricKey, metricMappingStatus, currency, unit, scale, period, accountingBasis, consolidationScope };
    }
    case "calculated-metric": {
      const { metricId, displayName, value, currency, unit, scale, reportingPeriod, formulaIdentifier, formulaVersion, inputObservationIds } = item.calculation;
      return { metricId, displayName, value, currency, unit, scale, reportingPeriod, formulaIdentifier, formulaVersion, inputObservationIds };
    }
    case "company-news-article": return { article: item.article, sentiment: item.sentiment, articleDate: item.articleDate };
    case "company-news-summary": return { report: item.report, sentiment: item.sentiment };
    case "esg-observation": return { score: item.score, label: item.label, methodology: item.methodology, verificationStatus: item.verificationStatus };
  }
}

function isEligible(item: ResearchEvidenceItem, snapshot: ResearchEvidenceSnapshot): boolean {
  if (!item.aiProcessingEligible || !item.permissionAssessmentIds.length) return false;
  const assessments = new Map(snapshot.permissionAssessments.map((assessment) => [assessment.assessmentId, assessment]));
  const receipts = new Set(snapshot.entitlementReceipts.map((receipt) => receipt.receiptId));
  const required = item.kind === "calculated-metric" || item.kind === "company-news-article" || item.kind === "company-news-summary"
    ? ["retrieval", "derivation", "ai-processing"] as const : ["retrieval", "ai-processing"] as const;
  return item.sources.length > 0 && item.sources.every((source) => {
    const matches = item.permissionAssessmentIds.map((id) => assessments.get(id)).filter((assessment) => assessment
      && assessment.sourceScope.providerId === source.providerId && assessment.sourceScope.dataset === source.dataset
      && assessment.sourceScope.market === source.market && assessment.sourceScope.sourceRecordId === source.sourceRecordId
      && assessment.sourceScope.securityId === item.subjectSecurityId && assessment.sourceScope.environment === source.dataEnvironment);
    if (matches.length !== 1) return false;
    const assessment = matches[0]!;
    const id = assessment.decisions.retrieval.receiptId;
    return Boolean(id && receipts.has(id) && required.every((operation) => assessment.decisions[operation].allowed && assessment.decisions[operation].receiptId === id));
  });
}

function assertBoundedGenerationEvidence(evidence: readonly ResearchGenerationEvidence[]): void {
  if (evidence.length > MAX_GENERATION_EVIDENCE_ITEMS) throw new TypeError("Research evidence exceeds generation limits.");
  let totalCharacters = 0;
  for (const item of evidence) {
    const pending: Array<{ value: unknown; depth: number }> = [{ value: item, depth: 0 }];
    let nodes = 0;
    while (pending.length) {
      const current = pending.pop()!;
      if (++nodes > MAX_GENERATION_ITEM_NODES || current.depth > MAX_GENERATION_ITEM_DEPTH) {
        throw new TypeError("Research evidence exceeds generation structure limits.");
      }
      if (typeof current.value === "string" && current.value.length > MAX_GENERATION_ITEM_CHARS) {
        throw new TypeError("A research evidence field exceeds generation limits.");
      }
      if (current.value === null || typeof current.value === "string" || typeof current.value === "boolean") continue;
      if (typeof current.value === "number") {
        if (!Number.isFinite(current.value)) throw new TypeError("Research evidence contains a non-JSON number.");
        continue;
      }
      if (Array.isArray(current.value)) {
        if (current.value.length > MAX_GENERATION_ITEM_NODES - nodes - pending.length) {
          throw new TypeError("Research evidence exceeds generation structure limits.");
        }
        for (const child of current.value) pending.push({ value: child, depth: current.depth + 1 });
      } else if (current.value && typeof current.value === "object") {
        const prototype = Object.getPrototypeOf(current.value);
        if (prototype !== Object.prototype && prototype !== null) throw new TypeError("Research evidence contains a non-JSON object.");
        for (const key in current.value as Record<string, unknown>) {
          if (!Object.prototype.hasOwnProperty.call(current.value, key)) continue;
          if (nodes + pending.length >= MAX_GENERATION_ITEM_NODES) throw new TypeError("Research evidence exceeds generation structure limits.");
          pending.push({ value: (current.value as Record<string, unknown>)[key], depth: current.depth + 1 });
        }
      } else {
        throw new TypeError("Research evidence contains a non-JSON value.");
      }
    }
    let serialized: string;
    try { serialized = JSON.stringify(item); } catch { throw new TypeError("Research evidence is not safely serializable."); }
    if (serialized.length > MAX_GENERATION_ITEM_CHARS) throw new TypeError("A research evidence item exceeds generation limits.");
    totalCharacters += serialized.length;
    if (totalCharacters > MAX_GENERATION_EVIDENCE_CHARS) throw new TypeError("Research evidence exceeds aggregate generation limits.");
  }
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
  }
  return value;
}

/** Projects only permission-cleared facts for the model. Trust metadata stays server-side. */
export function createResearchGenerationInput(
  snapshot: ResearchEvidenceSnapshot,
  context: TrustedResearchRequestContext
): ResearchGenerationInput {
  if (!isTrustedResearchEvidenceSnapshot(snapshot) || !validateTrustedResearchRequestContext(context).ok
      || !matchesResearchContextBinding(snapshot.contextBinding, context)
      || !revalidateResearchSnapshotPermissions(snapshot.entitlementReceipts, snapshot.permissionAssessments, context, snapshot.subject.securityId)) {
    throw new TypeError("Trusted permission-cleared research evidence is required.");
  }
  if (snapshot.evidence.length > MAX_GENERATION_EVIDENCE_ITEMS) throw new TypeError("Research evidence exceeds generation limits.");
  const evidence: ResearchGenerationEvidence[] = snapshot.evidence.filter((item) => isEligible(item, snapshot)).map((item) => ({
    evidenceId: item.evidenceId,
    kind: item.kind,
    subjectSecurityId: item.subjectSecurityId,
    sources: item.sources.map(({ providerId, dataset, market, sourceRecordId, sourceAsOf }) => ({ providerId, dataset, market, sourceRecordId, sourceAsOf })),
    facts: projectedFacts(item)
  }));
  assertBoundedGenerationEvidence(evidence);
  const snapshotDigest = computeResearchEvidenceSnapshotDigest(snapshot);
  return freeze({
    snapshotId: snapshot.snapshotId,
    snapshotDigest,
    securityId: snapshot.subject.securityId,
    subject: { symbol: snapshot.subject.symbol, exchange: snapshot.subject.exchange, currency: snapshot.subject.currency, companyName: snapshot.subject.companyName },
    evidence
  });
}
