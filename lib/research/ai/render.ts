import "server-only";
import { computeResearchEvidenceSnapshotDigest, isValidatedResearchReportDraft } from "@/lib/research/ai/validation";
import type { ResearchEvidenceItem, ResearchEvidenceSnapshot } from "@/types/research";
import type { ResolvedResearchFact, ValidatedResearchReportDraft } from "@/types/research-ai";
import type { TrustedResearchRequestContext } from "@/types/research-context";
import { evidenceOperationAllowed, matchesResearchContextBinding, revalidateResearchSnapshotPermissions } from "@/lib/research/evidence-permissions.server";
import { isTrustedResearchEvidenceSnapshot } from "@/lib/research/evidence";
import { validateTrustedResearchRequestContext } from "@/lib/research/request-context.server";

export interface RenderedVerifiedFact {
  referenceId: string;
  evidenceId: string;
  label: string;
  value: string;
  currency: string | null;
  unit: string;
  scale: string | null;
  periodEnd: string;
  periodBasis: string;
  displayText: string;
}

function resolveFact(
  fact: ResolvedResearchFact,
  item: ResearchEvidenceItem,
  byId: Map<string, ResearchEvidenceItem>,
  securityId: string
): Omit<RenderedVerifiedFact, "displayText"> | null {
  if (fact.kind === "reported_observation" && item.kind === "financial-observation") {
    const observation = item.observation;
    if (item.subjectSecurityId !== securityId || observation.securityId !== securityId || observation.value === null || observation.metricMappingStatus !== "verified"
        || fact.metricKey !== observation.metricKey || fact.periodEnd !== observation.period.end
        || fact.currency !== observation.currency || fact.unit !== observation.unit || fact.scale !== observation.scale
        || fact.formulaIdentifier !== null || fact.formulaVersion !== null || fact.inputEvidenceIds.length !== 0) return null;
    return { referenceId: fact.referenceId, evidenceId: item.evidenceId, label: observation.metricKey, value: observation.value,
      currency: observation.currency, unit: observation.unit, scale: observation.scale, periodEnd: observation.period.end,
      periodBasis: observation.period.basis };
  }
  if (fact.kind === "calculated_metric" && item.kind === "calculated-metric") {
    const calculation = item.calculation;
    const lineageMatches = item.inputEvidenceIds.length > 0
      && item.inputEvidenceIds.length === calculation.inputObservationIds.length
      && item.inputEvidenceIds.every((id, index) => {
        const source = byId.get(id);
        return source?.kind === "financial-observation" && source.subjectSecurityId === securityId
          && source.observation.securityId === securityId && source.observation.id === calculation.inputObservationIds[index];
      });
    if (item.subjectSecurityId !== securityId || calculation.securityId !== securityId || !lineageMatches
        || calculation.value === null || calculation.status !== "calculated"
        || item.evidenceId !== `calculation:${calculation.id}` || item.formulaIdentifier !== calculation.formulaIdentifier
        || item.formulaVersion !== calculation.formulaVersion || fact.metricKey !== calculation.metricId
        || fact.periodEnd !== (calculation.reportingPeriod?.end ?? "unknown") || fact.currency !== calculation.currency
        || fact.unit !== calculation.unit || fact.scale !== calculation.scale || fact.formulaIdentifier !== calculation.formulaIdentifier
        || fact.formulaVersion !== calculation.formulaVersion || fact.inputEvidenceIds.length !== item.inputEvidenceIds.length
        || fact.inputEvidenceIds.some((id, index) => id !== item.inputEvidenceIds[index])) return null;
    return { referenceId: fact.referenceId, evidenceId: item.evidenceId, label: calculation.displayName, value: calculation.value,
      currency: calculation.currency, unit: calculation.unit, scale: calculation.scale,
      periodEnd: calculation.reportingPeriod?.end ?? "unknown", periodBasis: calculation.periodType ?? "unknown" };
  }
  return null;
}

/** Resolve and format facts again from the bound immutable snapshot; model-provided values are never rendered. */
export function renderVerifiedResearchFacts(
  report: ValidatedResearchReportDraft,
  snapshot: ResearchEvidenceSnapshot,
  context: TrustedResearchRequestContext
): readonly RenderedVerifiedFact[] {
  if (!isValidatedResearchReportDraft(report) || !isTrustedResearchEvidenceSnapshot(snapshot)
      || !validateTrustedResearchRequestContext(context).ok || !matchesResearchContextBinding(snapshot.contextBinding, context)
      || !revalidateResearchSnapshotPermissions(snapshot.entitlementReceipts, snapshot.permissionAssessments, context, snapshot.subject.securityId)
      || report.snapshotId !== snapshot.snapshotId
      || report.securityId !== snapshot.subject.securityId
      || report.snapshotDigest !== computeResearchEvidenceSnapshotDigest(snapshot)) {
    throw new TypeError("Validated research report is not bound to this evidence snapshot.");
  }
  const byId = new Map(snapshot.evidence.map((item) => [item.evidenceId, item]));
  const rendered = report.verifiedFacts.map((fact) => {
    const item = byId.get(fact.evidenceId);
    const displayAllowed = item && evidenceOperationAllowed(item, snapshot.permissionAssessments, snapshot.entitlementReceipts, "display");
    const lineageDisplayAllowed = item?.kind !== "calculated-metric" || item.inputEvidenceIds.every((id) => {
      const input = byId.get(id);
      return input?.kind === "financial-observation"
        && evidenceOperationAllowed(input, snapshot.permissionAssessments, snapshot.entitlementReceipts, "display");
    });
    if (!displayAllowed || !lineageDisplayAllowed) throw new TypeError("Fact display permission is not available for every source.");
    const resolved = item && resolveFact(fact, item, byId, snapshot.subject.securityId);
    if (!resolved) throw new TypeError("Verified fact no longer matches authoritative evidence.");
    const amount = [resolved.value, resolved.scale, resolved.currency, resolved.unit === "currency" ? null : resolved.unit].filter(Boolean).join(" ");
    const period = resolved.periodBasis === "instant" ? `as of ${resolved.periodEnd}` : `${resolved.periodBasis} ending ${resolved.periodEnd}`;
    return { ...resolved, displayText: `${resolved.label}: ${amount} (${period})` };
  });
  return Object.freeze(rendered.map((fact) => Object.freeze(fact)));
}
