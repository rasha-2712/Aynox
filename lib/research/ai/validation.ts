import "server-only";
import { createHash } from "node:crypto";
import {
  RESEARCH_REPORT_SCHEMA_VERSION,
  RESEARCH_REPORT_SECTIONS,
  type AIOutputValidationIssue,
  type AIOutputValidationResult,
  type ResearchFactReferenceKind,
  type ResearchReportFactReferenceDraft,
  type ResearchReportInterpretationDraft,
  type ResearchReportSection,
  type StructuredResearchReportDraft,
  type ValidatedResearchReportDraft
} from "@/types/research-ai";
import type { ResearchEvidenceItem, ResearchEvidenceSnapshot } from "@/types/research";
import { isTrustedResearchEvidenceSnapshot } from "@/lib/research/evidence";
import { matchesResearchContextBinding, revalidateResearchSnapshotPermissions } from "@/lib/research/evidence-permissions.server";
import { validateTrustedResearchRequestContext } from "@/lib/research/request-context.server";
import type { TrustedResearchRequestContext } from "@/types/research-context";
import type { DataOperation } from "@/types/financial";

const MAX_OUTPUT_CHARACTERS = 48_000;
const MAX_JSON_NODES = 10_000;
const MAX_JSON_DEPTH = 64;
const MAX_VALIDATION_ISSUES = 100;
const MAX_SNAPSHOT_EVIDENCE = 1_000;
const MAX_REPORT_ITEMS = 50;
const MAX_TEXT_LENGTH = 1_600;
const MAX_EVIDENCE_IDS_PER_CLAIM = 8;
const ITEM_ID = /^[A-Za-z0-9_-]{1,80}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const validatedDrafts = new WeakSet<object>();

export function isValidatedResearchReportDraft(value: unknown): value is ValidatedResearchReportDraft {
  return typeof value === "object" && value !== null && validatedDrafts.has(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function add(issues: AIOutputValidationIssue[], path: string, code: string, message: string): void {
  if (issues.length < MAX_VALIDATION_ISSUES) issues.push({ path, code, message });
  else if (issues.length === MAX_VALIDATION_ISSUES) issues.push({ path: "$", code: "TOO_MANY_VALIDATION_ERRORS", message: "Output has too many validation errors." });
}

function checkExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[],
  path: string,
  issues: AIOutputValidationIssue[]
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      const code = ["generationStatus", "freshnessStatus", "validationStatus", "sourceUrl", "citation"].includes(key)
        ? "SERVER_OWNED_OR_UNSUPPORTED_FIELD"
        : "UNEXPECTED_FIELD";
      add(issues, path + "." + key, code, "This field is not allowed in model output.");
    }
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) add(issues, path + "." + key, "MISSING_FIELD", "A required field is missing.");
  }
}

function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max && value.trim() === value;
}

function isReferenceString(value: unknown): value is string {
  return isBoundedString(value, 200);
}

function canonicalJson(value: unknown, depth = 0): string {
  if (depth > 64) throw new Error("Snapshot nesting limit exceeded.");
  if (value === undefined) return '"[undefined]"';
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item, depth + 1)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key], depth + 1)}`).join(",")}}`;
}

export function computeResearchEvidenceSnapshotDigest(snapshot: ResearchEvidenceSnapshot): string {
  return createHash("sha256").update(canonicalJson(snapshot)).digest("hex");
}

function isDeepFrozen(value: unknown, seen = new Set<object>()): boolean {
  const pending: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const current = pending.pop()!;
    if (current.value === null || typeof current.value !== "object" || seen.has(current.value)) continue;
    if (++count > 100_000 || current.depth > 64 || !Object.isFrozen(current.value)) return false;
    seen.add(current.value);
    for (const child of Object.values(current.value as Record<string, unknown>)) pending.push({ value: child, depth: current.depth + 1 });
  }
  return true;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child));
  }
  return value;
}

function nestedIdentityMatches(item: ResearchEvidenceItem, snapshot: ResearchEvidenceSnapshot): boolean {
  const subject = snapshot.subject;
  try {
    switch (item.kind) {
      case "financial-observation":
        return item.observation.securityId === subject.securityId
          && canonicalJson(item.observation.period) === canonicalJson(item.reportingPeriod);
      case "calculated-metric":
        return item.calculation.securityId === subject.securityId
          && item.formulaIdentifier === item.calculation.formulaIdentifier
          && item.formulaVersion === item.calculation.formulaVersion
          && item.evidenceId === `calculation:${item.calculation.id}`;
      case "company-news-article":
        return item.article.securityId === subject.securityId && item.article.symbol === subject.symbol;
      case "company-news-summary":
        return item.report.symbol === subject.symbol && item.report.companyName === subject.companyName;
      case "company-profile":
      case "esg-observation":
        return true;
    }
  } catch {
    return false;
  }
}

function validSourceRecord(source: unknown): source is Record<string, unknown> {
  if (!isRecord(source)) return false;
  const environment = source.dataEnvironment;
  if (!(environment === "synthetic" || environment === "development-restricted" || environment === "production-licensed") || source.sourceKind !== environment
      || !isBoundedString(source.providerId, 128) || !isBoundedString(source.providerName, 200)
      || !isBoundedString(source.dataset, 200) || !isBoundedString(source.market, 128)
      || !isBoundedString(source.sourceRecordId, 200) || !isBoundedString(source.retrievedAt, 100)
      || !Number.isFinite(Date.parse(source.retrievedAt))) return false;
  return true;
}

function sourcePermissionsAllowAI(item: ResearchEvidenceItem, snapshot: ResearchEvidenceSnapshot): boolean {
  if (!Array.isArray(item.permissionAssessmentIds) || item.permissionAssessmentIds.length === 0
      || new Set(item.permissionAssessmentIds).size !== item.permissionAssessmentIds.length) return false;
  const assessments = new Map(snapshot.permissionAssessments.map((entry) => [entry.assessmentId, entry]));
  const receipts = new Map(snapshot.entitlementReceipts.map((entry) => [entry.receiptId, entry]));
  const needsDerivation = item.kind === "calculated-metric" || item.kind === "company-news-summary" || item.kind === "company-news-article";
  return item.sources.length > 0 && item.sources.every((source) => {
    const matches = item.permissionAssessmentIds.map((id) => assessments.get(id)).filter((entry) => entry
      && entry.sourceScope.providerId === source.providerId && entry.sourceScope.dataset === source.dataset
      && entry.sourceScope.market === source.market && entry.sourceScope.sourceRecordId === source.sourceRecordId
      && entry.sourceScope.securityId === item.subjectSecurityId && entry.sourceScope.environment === source.dataEnvironment);
    if (matches.length !== 1) return false;
    const entry = matches[0]!;
    const receiptId = entry.decisions.retrieval.receiptId;
    const required: DataOperation[] = ["retrieval", "ai-processing"];
    if (needsDerivation) required.push("derivation");
    return Boolean(receiptId && receipts.has(receiptId) && required.every((operation) => entry.decisions[operation].allowed
      && entry.decisions[operation].receiptId === receiptId));
  });
}

function safeJsonClone(input: unknown, issues: AIOutputValidationIssue[]): unknown {
  let cloned: unknown;
  if (typeof input === "string") {
    if (input.length > MAX_OUTPUT_CHARACTERS) {
      add(issues, "$", "OUTPUT_TOO_LONG", "Structured output exceeds the maximum accepted length.");
      return null;
    }
    try { cloned = JSON.parse(input) as unknown; }
    catch { add(issues, "$", "MALFORMED_JSON", "Provider output is not valid JSON."); return null; }
  } else {
    try {
      const serialized = JSON.stringify(input);
      if (serialized === undefined) throw new Error("Output is not JSON serializable.");
      if (serialized.length > MAX_OUTPUT_CHARACTERS) {
        add(issues, "$", "OUTPUT_TOO_LONG", "Structured output exceeds the maximum accepted length.");
        return null;
      }
      cloned = JSON.parse(serialized) as unknown;
    } catch {
      add(issues, "$", "MALFORMED_OUTPUT", "Provider output is not safely JSON serializable.");
      return null;
    }
  }
  const pending: Array<{ value: unknown; depth: number }> = [{ value: cloned, depth: 0 }];
  let nodes = 0;
  while (pending.length) {
    const current = pending.pop()!;
    nodes += 1;
    if (nodes > MAX_JSON_NODES) {
      add(issues, "$", "TOO_MANY_OUTPUT_NODES", "Provider output exceeds the maximum JSON node count.");
      return null;
    }
    if (current.depth > MAX_JSON_DEPTH) {
      add(issues, "$", "OUTPUT_TOO_DEEP", "Provider output exceeds the maximum nesting depth.");
      return null;
    }
    if (typeof current.value === "string" && current.value.length > MAX_OUTPUT_CHARACTERS) {
      add(issues, "$", "OUTPUT_TOO_LONG", "A provider output string exceeds the maximum accepted length.");
      return null;
    }
    if (Array.isArray(current.value)) {
      for (const child of current.value) pending.push({ value: child, depth: current.depth + 1 });
    } else if (isRecord(current.value)) {
      for (const child of Object.values(current.value)) pending.push({ value: child, depth: current.depth + 1 });
    }
  }
  return cloned;
}

function validateSnapshot(snapshot: ResearchEvidenceSnapshot, context: TrustedResearchRequestContext, issues: AIOutputValidationIssue[]): Map<string, ResearchEvidenceItem> {
  if (!snapshot || !isRecord(snapshot) || !isBoundedString(snapshot.snapshotId, 200)
      || !isRecord(snapshot.subject) || !isBoundedString(snapshot.subject.securityId, 200)
      || !isRecord(snapshot.securityMapping) || snapshot.securityMapping.status !== "resolved"
      || !Array.isArray(snapshot.evidence) || snapshot.evidence.length > MAX_SNAPSHOT_EVIDENCE || !isDeepFrozen(snapshot)) {
    add(issues, "$snapshot", "INVALID_EVIDENCE_SNAPSHOT", "A bounded, deeply immutable resolved evidence snapshot is required.");
    return new Map();
  }
  if (!isTrustedResearchEvidenceSnapshot(snapshot)) {
    add(issues, "$snapshot", "UNTRUSTED_EVIDENCE_SNAPSHOT", "Evidence snapshots must be issued by the server evidence assembler.");
  }
  if (!validateTrustedResearchRequestContext(context).ok || !matchesResearchContextBinding(snapshot.contextBinding, context)
      || !revalidateResearchSnapshotPermissions(snapshot.entitlementReceipts, snapshot.permissionAssessments, context, snapshot.subject.securityId)) {
    add(issues, "$snapshot.contextBinding", "UNTRUSTED_EVIDENCE_SNAPSHOT", "Evidence permissions and request context could not be revalidated.");
  }
  const evidenceById = new Map<string, ResearchEvidenceItem>();
  for (const [index, item] of snapshot.evidence.entries()) {
    if (issues.length >= MAX_VALIDATION_ISSUES) break;
    if (!isRecord(item) || !isReferenceString(item.evidenceId) || item.subjectSecurityId !== snapshot.subject.securityId
        || item.aiProcessingEligible !== true) {
      add(issues, "$snapshot.evidence[" + index + "]", "INELIGIBLE_EVIDENCE", "Snapshot evidence must have a unique ID, match the report subject, and be eligible for AI processing.");
      continue;
    }
    const typedItem = item as unknown as ResearchEvidenceItem;
    if (!nestedIdentityMatches(typedItem, snapshot)) {
      add(issues, `$snapshot.evidence[${index}]`, "NESTED_EVIDENCE_IDENTITY_MISMATCH", "Nested evidence identity or financial period does not match the snapshot subject.");
      continue;
    }
    if (!Array.isArray(item.sources) || item.sources.length === 0 || !item.sources.every(validSourceRecord)) {
      add(issues, `$snapshot.evidence[${index}].sources`, "INVALID_SOURCE_PROVENANCE", "Evidence requires complete factual source provenance.");
      continue;
    }
    const sourcePermissionsEligible = sourcePermissionsAllowAI(item as unknown as ResearchEvidenceItem, snapshot);
    if (!sourcePermissionsEligible || item.aiProcessingEligible !== sourcePermissionsEligible) {
      add(issues, `$snapshot.evidence[${index}].aiProcessingEligible`, "AI_PROCESSING_NOT_PERMITTED", "AI eligibility must agree with explicit retrieval, derivation, and AI-processing permissions.");
      continue;
    }
    if (evidenceById.has(item.evidenceId)) {
      add(issues, "$snapshot.evidence[" + index + "].evidenceId", "DUPLICATE_EVIDENCE_ID", "Evidence IDs must be unique in the snapshot.");
      continue;
    }
    evidenceById.set(item.evidenceId, typedItem);
  }
  for (const [id, candidate] of evidenceById) {
    if (candidate.kind !== "calculated-metric") continue;
    const calculation = candidate.calculation;
    const lineageMatches = candidate.inputEvidenceIds.length > 0
      && candidate.inputEvidenceIds.length === calculation.inputObservationIds.length
      && candidate.inputEvidenceIds.every((inputId, offset) => {
        const source = evidenceById.get(inputId);
        return source?.kind === "financial-observation"
          && source.subjectSecurityId === snapshot.subject.securityId
          && source.observation.securityId === snapshot.subject.securityId
          && source.observation.id === calculation.inputObservationIds[offset];
      });
    if (!lineageMatches) {
      evidenceById.delete(id);
      add(issues, "$snapshot.evidence", "INVALID_CALCULATION_LINEAGE", "Calculated evidence must resolve to same-security financial observations in its declared order.");
    }
  }
  return evidenceById;
}

function validFactReference(
  input: unknown,
  index: number,
  snapshot: ResearchEvidenceSnapshot,
  evidenceById: Map<string, ResearchEvidenceItem>,
  issues: AIOutputValidationIssue[]
): { reference: ResearchReportFactReferenceDraft; fact: ValidatedResearchReportDraft["verifiedFacts"][number] } | null {
  const path = `$.factReferences[${index}]`;
  if (!isRecord(input)) { add(issues, path, "INVALID_FACT_REFERENCE", "Fact reference must be an object."); return null; }
  checkExactKeys(input, ["referenceId", "section", "kind", "evidenceId", "metricKey", "periodEnd", "currency", "unit", "scale", "formulaIdentifier", "formulaVersion", "inputEvidenceIds"],
    ["referenceId", "section", "kind", "evidenceId", "metricKey", "periodEnd", "currency", "unit", "scale", "formulaIdentifier", "formulaVersion", "inputEvidenceIds"], path, issues);
  const section = input.section;
  const kind = input.kind;
  const referenceId = input.referenceId;
  const evidenceId = input.evidenceId;
  if (!isBoundedString(referenceId, 80) || !ITEM_ID.test(referenceId)) add(issues, `${path}.referenceId`, "INVALID_REFERENCE_ID", "Reference ID has an invalid format.");
  if (typeof section !== "string" || !RESEARCH_REPORT_SECTIONS.includes(section as ResearchReportSection)) add(issues, `${path}.section`, "UNSUPPORTED_SECTION", "Fact section is not supported.");
  if (kind !== "reported_observation" && kind !== "calculated_metric") add(issues, `${path}.kind`, "UNSUPPORTED_FACT_KIND", "Fact kind must identify a reported observation or deterministic calculation.");
  if (!isReferenceString(evidenceId)) { add(issues, `${path}.evidenceId`, "INVALID_EVIDENCE_REFERENCE", "Fact must reference an evidence ID."); return null; }
  const item = evidenceById.get(evidenceId);
  if (!item || item.subjectSecurityId !== snapshot.subject.securityId || !item.aiProcessingEligible) {
    add(issues, `${path}.evidenceId`, "INELIGIBLE_EVIDENCE_REFERENCE", "Fact evidence must belong to the report security and be AI-eligible."); return null;
  }
  if (!isReferenceString(input.metricKey) || !isReferenceString(input.periodEnd) || typeof input.unit !== "string"
      || !(input.currency === null || typeof input.currency === "string") || !(input.scale === null || typeof input.scale === "string")
      || !(input.formulaIdentifier === null || typeof input.formulaIdentifier === "string")
      || !(input.formulaVersion === null || typeof input.formulaVersion === "string")
      || !Array.isArray(input.inputEvidenceIds) || input.inputEvidenceIds.length > MAX_EVIDENCE_IDS_PER_CLAIM
      || input.inputEvidenceIds.some((id) => !isReferenceString(id))) {
    add(issues, path, "INVALID_FACT_METADATA", "Fact metadata or calculation lineage is malformed or exceeds limits."); return null;
  }
  const draft = input as unknown as ResearchReportFactReferenceDraft;
  if (!ITEM_ID.test(draft.referenceId) || !RESEARCH_REPORT_SECTIONS.includes(draft.section)
      || (draft.kind !== "reported_observation" && draft.kind !== "calculated_metric")) return null;
  const factKind: ResearchFactReferenceKind = draft.kind;
  if (kind === "reported_observation") {
    if (item.kind !== "financial-observation") { add(issues, path, "FACT_KIND_MISMATCH", "Reported facts must resolve to a financial observation."); return null; }
    const observation = item.observation;
    if (observation.securityId !== snapshot.subject.securityId || observation.value === null || observation.metricMappingStatus !== "verified"
        || canonicalJson(observation.period) !== canonicalJson(item.reportingPeriod)) {
      add(issues, path, "INVALID_FINANCIAL_EVIDENCE", "Observation identity, value, mapping, or period does not satisfy the financial evidence contract."); return null;
    }
    if (draft.metricKey !== observation.metricKey || draft.periodEnd !== observation.period.end || draft.currency !== observation.currency
        || draft.unit !== observation.unit || draft.scale !== observation.scale || draft.formulaIdentifier !== null
        || draft.formulaVersion !== null || draft.inputEvidenceIds.length !== 0) {
      add(issues, path, "FACT_METADATA_MISMATCH", "Observation reference must match its exact metric, period, unit, currency, and lineage."); return null;
    }
    return { reference: draft, fact: { referenceId: draft.referenceId, section: draft.section, kind: factKind, evidenceId: draft.evidenceId, label: observation.metricKey, value: observation.value,
      metricKey: observation.metricKey, periodEnd: observation.period.end, currency: observation.currency, unit: observation.unit, scale: observation.scale,
      formulaIdentifier: null, formulaVersion: null, inputEvidenceIds: [] } };
  }
  if (item.kind !== "calculated-metric") { add(issues, path, "FACT_KIND_MISMATCH", "Calculated facts must resolve to a calculation result."); return null; }
  const calculation = item.calculation;
  if (calculation.securityId !== snapshot.subject.securityId || calculation.status !== "calculated" || calculation.value === null
      || item.formulaIdentifier !== calculation.formulaIdentifier || item.formulaVersion !== calculation.formulaVersion
      || item.evidenceId !== `calculation:${calculation.id}` || item.inputEvidenceIds.length !== calculation.inputObservationIds.length) {
    add(issues, path, "INVALID_CALCULATION_EVIDENCE", "Calculation identity, status, value, formula, or lineage is invalid."); return null;
  }
  const lineageObservations = item.inputEvidenceIds.map((id) => evidenceById.get(id));
  const lineageValid = lineageObservations.length > 0 && lineageObservations.every((source, offset) => source?.kind === "financial-observation"
    && source.subjectSecurityId === snapshot.subject.securityId && source.observation.securityId === snapshot.subject.securityId
    && source.observation.id === calculation.inputObservationIds[offset]);
  if (!lineageValid || draft.metricKey !== calculation.metricId || draft.periodEnd !== (calculation.reportingPeriod?.end ?? "unknown")
      || draft.currency !== calculation.currency || draft.unit !== calculation.unit || draft.scale !== calculation.scale
      || draft.formulaIdentifier !== calculation.formulaIdentifier || draft.formulaVersion !== calculation.formulaVersion
      || canonicalJson(draft.inputEvidenceIds) !== canonicalJson(item.inputEvidenceIds)) {
    add(issues, path, "CALCULATION_METADATA_MISMATCH", "Calculation reference must match the exact metric, period, unit, currency, formula, and observation lineage."); return null;
  }
  return { reference: draft, fact: { referenceId: draft.referenceId, section: draft.section, kind: factKind, evidenceId: draft.evidenceId, label: calculation.displayName, value: calculation.value,
    metricKey: calculation.metricId, periodEnd: calculation.reportingPeriod?.end ?? "unknown", currency: calculation.currency, unit: calculation.unit, scale: calculation.scale,
    formulaIdentifier: calculation.formulaIdentifier, formulaVersion: calculation.formulaVersion, inputEvidenceIds: [...item.inputEvidenceIds] } };
}

export function validateStructuredResearchReport(
  rawOutput: unknown,
  snapshot: ResearchEvidenceSnapshot,
  context: TrustedResearchRequestContext
): AIOutputValidationResult {
  const issues: AIOutputValidationIssue[] = [];
  const evidenceById = validateSnapshot(snapshot, context, issues);
  if (issues.some((issue) => issue.code === "INVALID_EVIDENCE_SNAPSHOT")) return { ok: false, errors: issues };
  let digest: string;
  try { digest = computeResearchEvidenceSnapshotDigest(snapshot); }
  catch { return { ok: false, errors: [{ path: "$snapshot", code: "INVALID_EVIDENCE_SNAPSHOT", message: "Evidence snapshot cannot be deterministically hashed." }] }; }

  const parsed = safeJsonClone(rawOutput, issues);
  if (!isRecord(parsed)) {
    if (!issues.length) add(issues, "$", "INVALID_REPORT", "Structured report output must be an object.");
    return { ok: false, errors: issues };
  }

  checkExactKeys(parsed, ["schemaVersion", "snapshotId", "snapshotDigest", "securityId", "sections", "factReferences", "interpretations"],
    ["schemaVersion", "snapshotId", "snapshotDigest", "securityId", "sections", "factReferences", "interpretations"], "$", issues);
  if (parsed.schemaVersion !== RESEARCH_REPORT_SCHEMA_VERSION) add(issues, "$.schemaVersion", "UNSUPPORTED_SCHEMA_VERSION", "Report schema version is unsupported.");
  if (parsed.snapshotId !== snapshot.snapshotId) add(issues, "$.snapshotId", "SNAPSHOT_MISMATCH", "Report snapshot ID does not match the supplied evidence snapshot.");
  if (parsed.snapshotDigest !== digest || typeof parsed.snapshotDigest !== "string" || !SHA256.test(parsed.snapshotDigest)) add(issues, "$.snapshotDigest", "SNAPSHOT_DIGEST_MISMATCH", "Report snapshot digest does not match the exact supplied evidence content.");
  if (parsed.securityId !== snapshot.subject.securityId) add(issues, "$.securityId", "SECURITY_MISMATCH", "Report security ID does not match the evidence snapshot.");

  const facts: ValidatedResearchReportDraft["verifiedFacts"] = [];
  const factRefs = new Map<string, ResearchReportFactReferenceDraft>();
  if (!Array.isArray(parsed.factReferences) || parsed.factReferences.length > MAX_REPORT_ITEMS) {
    add(issues, "$.factReferences", "INVALID_FACT_REFERENCE_COUNT", "Fact references must be a bounded array.");
  } else {
    parsed.factReferences.forEach((item, index) => {
      if (issues.length > MAX_VALIDATION_ISSUES) return;
      const resolved = validFactReference(item, index, snapshot, evidenceById, issues);
      if (!resolved) return;
      if (factRefs.has(resolved.reference.referenceId)) add(issues, `$.factReferences[${index}].referenceId`, "DUPLICATE_REFERENCE_ID", "Fact reference IDs must be unique.");
      else { factRefs.set(resolved.reference.referenceId, resolved.reference); facts.push(resolved.fact); }
    });
  }

  const interpretations: ValidatedResearchReportDraft["interpretations"] = [];
  const interpretationRefs = new Map<string, ResearchReportInterpretationDraft>();
  if (!Array.isArray(parsed.interpretations) || parsed.interpretations.length > MAX_REPORT_ITEMS) {
    add(issues, "$.interpretations", "INVALID_INTERPRETATION_COUNT", "Interpretations must be a bounded array.");
  } else {
    parsed.interpretations.forEach((value, index) => {
      const path = `$.interpretations[${index}]`;
      if (!isRecord(value)) { add(issues, path, "INVALID_INTERPRETATION", "Interpretation must be an object."); return; }
      checkExactKeys(value, ["interpretationId", "section", "text", "contextEvidenceIds"], ["interpretationId", "section", "text", "contextEvidenceIds"], path, issues);
      if (!isBoundedString(value.interpretationId, 80) || !ITEM_ID.test(value.interpretationId)
          || typeof value.section !== "string" || !RESEARCH_REPORT_SECTIONS.includes(value.section as ResearchReportSection)
          || !isBoundedString(value.text, MAX_TEXT_LENGTH) || !Array.isArray(value.contextEvidenceIds)
          || value.contextEvidenceIds.length === 0 || value.contextEvidenceIds.length > MAX_EVIDENCE_IDS_PER_CLAIM
          || value.contextEvidenceIds.some((id) => typeof id !== "string" || !isReferenceString(id))) {
        add(issues, path, "INVALID_INTERPRETATION", "Interpretation identity, text, section, or context references are invalid."); return;
      }
      const ids = value.contextEvidenceIds as string[];
      if (new Set(ids).size !== ids.length || ids.some((id) => {
        const evidence = evidenceById.get(id);
        return !evidence || evidence.subjectSecurityId !== snapshot.subject.securityId || !evidence.aiProcessingEligible;
      })) { add(issues, `${path}.contextEvidenceIds`, "INVALID_CONTEXT_EVIDENCE", "Context evidence must be unique, eligible, and belong to this security."); return; }
      const draft = value as unknown as ResearchReportInterpretationDraft;
      if (interpretationRefs.has(draft.interpretationId)) add(issues, `${path}.interpretationId`, "DUPLICATE_INTERPRETATION_ID", "Interpretation IDs must be unique.");
      else {
        interpretationRefs.set(draft.interpretationId, draft);
        interpretations.push({ ...draft, contextEvidenceIds: [...ids], classification: "unverified_ai_interpretation" });
      }
    });
  }

  const sectionReferenceIds = new Set<string>();
  if (!isRecord(parsed.sections)) {
    add(issues, "$.sections", "INVALID_SECTIONS", "Section fact and interpretation references must be an object.");
  } else {
    checkExactKeys(parsed.sections, RESEARCH_REPORT_SECTIONS, RESEARCH_REPORT_SECTIONS, "$.sections", issues);
    for (const sectionName of RESEARCH_REPORT_SECTIONS) {
      const sectionValue = parsed.sections[sectionName];
      const sectionPath = `$.sections.${sectionName}`;
      if (!isRecord(sectionValue)) {
        add(issues, sectionPath, "INVALID_SECTION_REFERENCES", "Section references must contain fact and interpretation ID arrays.");
        continue;
      }
      checkExactKeys(sectionValue, ["factReferenceIds", "interpretationIds"], ["factReferenceIds", "interpretationIds"], sectionPath, issues);
      for (const [key, refs] of [["factReferenceIds", sectionValue.factReferenceIds], ["interpretationIds", sectionValue.interpretationIds]] as const) {
        if (!Array.isArray(refs) || refs.length > MAX_REPORT_ITEMS) { add(issues, `${sectionPath}.${key}`, "INVALID_SECTION_REFERENCES", "Section reference list exceeds its bound or is not an array."); continue; }
        for (const [index, referenceId] of refs.entries()) {
          if (typeof referenceId !== "string" || !ITEM_ID.test(referenceId)) {
            add(issues, `${sectionPath}.${key}[${index}]`, "INVALID_ITEM_REFERENCE", "Section contains a malformed item reference.");
          continue;
        }
          const compound = `${key}:${referenceId}`;
          if (sectionReferenceIds.has(compound)) add(issues, sectionPath, "DUPLICATE_ITEM_REFERENCE", "Each item must appear in exactly one report section.");
          sectionReferenceIds.add(compound);
          const item = key === "factReferenceIds" ? factRefs.get(referenceId) : interpretationRefs.get(referenceId);
          if (!item) add(issues, sectionPath, "UNSUPPORTED_ITEM_REFERENCE", "Section references an item that does not exist.");
          else if (item.section !== sectionName) add(issues, sectionPath, "ITEM_SECTION_MISMATCH", "Item section does not match its section reference.");
        }
      }
    }
  }
  for (const id of factRefs.keys()) if (!sectionReferenceIds.has(`factReferenceIds:${id}`)) add(issues, "$.factReferences", "UNREFERENCED_FACT", "Every fact reference must appear in exactly one section.");
  for (const id of interpretationRefs.keys()) if (!sectionReferenceIds.has(`interpretationIds:${id}`)) add(issues, "$.interpretations", "UNREFERENCED_INTERPRETATION", "Every interpretation must appear in exactly one section.");

  if (issues.length) return { ok: false, errors: issues };
  const value = deepFreeze({
      schemaVersion: RESEARCH_REPORT_SCHEMA_VERSION,
      snapshotId: snapshot.snapshotId,
      snapshotDigest: digest,
      securityId: snapshot.subject.securityId,
      sections: parsed.sections as unknown as StructuredResearchReportDraft["sections"],
      verifiedFacts: facts,
      interpretations,
      structuralValidation: "passed" as const,
      publicationEligibility: "not_eligible_step_3_2" as const
    });
  validatedDrafts.add(value);
  return {
    ok: true,
    value
  };
}
