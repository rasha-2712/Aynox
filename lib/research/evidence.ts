import { randomUUID } from "node:crypto";
import { demoSecurities } from "@/lib/data/demo-data";
import { calculateFinancialMetric } from "@/lib/financial/calculation-engine";
import { createSyntheticDemoEntitlement, evaluateDataPermission } from "@/lib/financial/permissions";
import { securityIdentityFromSecurity } from "@/lib/financial/security-mapping";
import { validateCompanyProfileRecord, validateFinancialStatementBundle } from "@/lib/financial/validation";
import { financialFormulaCatalogue } from "@/lib/financial/formula-catalogue";
import { parseDecimalString } from "@/lib/financial/decimal";
import { getFundamentalsProvider } from "@/lib/providers";
import { getNewsArticles } from "@/lib/news/service";
import { generateCompanyNewsReport } from "@/lib/news/report";
import { isValidNewsArticleId } from "@/lib/news/validation";
import type { DataOperation, DataEntitlement, FinancialCalculationResult, FinancialDataProvenance, FinancialObservation, FundamentalsProvider, SecurityIdentity } from "@/types/financial";
import type { NewsArticle } from "@/types/news";
import type { CalculatedMetricEvidence, DeepReadonly, EvidenceCompleteness, EvidenceFreshness, PermissionEvidence, ResearchEvidenceAssemblyOptions, ResearchEvidenceAssemblerDependencies, ResearchEvidenceItem, ResearchEvidenceSnapshot, ResearchSourceProvenance, ResearchSourceInput, ResearchSubject, VerifiedEsgEvidenceCandidate } from "@/types/research";

const OPERATIONS: DataOperation[] = ["retrieval", "storage", "display", "derivation", "ai-processing", "retention", "redistribution"];

/** Deterministically assembles permitted, source-grounded evidence. It does not persist data or generate AI reports. */
export async function assembleResearchEvidence(
  securityId: string,
  options: ResearchEvidenceAssemblyOptions,
  dependencies: ResearchEvidenceAssemblerDependencies = {}
): Promise<DeepReadonly<ResearchEvidenceSnapshot>> {
  const assembledAt = options.assembledAt ?? new Date().toISOString();
  const snapshotId = `research-snapshot:${(dependencies.makeSnapshotId ?? randomUUID)()}`;
  const security = demoSecurities.find((item) => item.id === securityId);
  const subject: ResearchSubject = security
    ? { securityId: security.id, symbol: security.symbol, exchange: security.exchange, currency: security.currency, companyName: security.name }
    : { securityId, symbol: "", exchange: "", currency: "", companyName: "" };
  const provider: FundamentalsProvider = dependencies.fundamentalsProvider ?? getFundamentalsProvider();
  const limitations: ResearchEvidenceSnapshot["limitations"] = [];
  const evidence: ResearchEvidenceItem[] = [];
  const sectionStatus: ResearchEvidenceSnapshot["sections"] = {
    profile: "unavailable", financialStatements: "unavailable", calculatedMetrics: "unavailable", news: "unavailable", esg: "not-assessed"
  };
  const mapping = security ? provider.resolveSecurity(securityIdentityFromSecurity(security))
    : { status: "unsupported" as const, reason: "The canonical security ID is not present in the supported security catalogue." };

  if (mapping.status !== "resolved") {
    limitations.push({ code: mapping.status === "ambiguous" ? "security-mapping-ambiguous" : "security-mapping-unsupported", message: mapping.reason, subjectSecurityId: securityId });
    return immutableSnapshot({ snapshotId, schemaVersion: "1.0.0", subject, securityMapping: { status: mapping.status, providerId: provider.providerId, reason: mapping.reason }, assembledAt, completeness: "unavailable", freshness: "unknown", sections: sectionStatus, evidence, limitations, sourceObservationIds: [], calculationVersions: [] });
  }

  const identity: SecurityIdentity = securityIdentityFromSecurity(security!);
  const [profileResult, statementResult, loadedNews] = await Promise.all([
    provider.getCompanyProfile(identity).catch(() => null),
    provider.getFinancialStatements(identity).catch(() => null),
    options.newsArticles ? Promise.resolve(options.newsArticles) : (dependencies.loadNewsArticles ?? getNewsArticles)().catch(() => [])
  ]);

  const eligibleObservations: FinancialObservation[] = [];
  const observationEvidenceIds = new Map<string, string>();
  const rawProfile = profileResult?.data;
  const profileValidationIssues = rawProfile ? validateCompanyProfileRecord(rawProfile) : [];
  const validProfile = rawProfile !== null && rawProfile !== undefined && profileResult !== null
    && (profileResult.status === "complete" || profileResult.status === "partial")
    && profileValidationIssues.length === 0;
  const profileIdentityMatches = Boolean(rawProfile && validProfile && rawProfile.securityId === securityId
    && rawProfile.canonicalSymbol.trim().toLocaleUpperCase("en-US") === identity.symbol.toLocaleUpperCase("en-US")
    && rawProfile.exchange.trim().toLocaleUpperCase("en-US") === identity.exchange.toLocaleUpperCase("en-US"));
  if (validProfile && !profileIdentityMatches) {
    limitations.push({ code: "profile-identity-mismatch", message: "Company profile identity does not match the requested canonical security; profile facts were excluded.", subjectSecurityId: securityId, sourceId: rawProfile.source.sourceRecordId });
  }
  if (profileResult?.data && (profileResult.status === "complete" || profileResult.status === "partial")
      && profileIdentityMatches) {
    const profile = profileResult.data;
    const duplicateProfileFields = duplicateValues(profile.facts.map((fact) => fact.providerField));
    const profileEnvironmentMatches = providerEnvironmentMatches(profileResult.dataEnvironment, profileResult.entitlements);
    const envelopeEligible = profile.source.providerId === profileResult.provider.id
      && profileResult.provider.id === provider.providerId
      && profileEnvironmentMatches
      && sourceEntitlementsEligible(profileResult.entitlements, profile.source, assembledAt, options.consumer, profileResult.dataEnvironment);
    if (!profileEnvironmentMatches || profileResult.dataEnvironment !== profile.source.dataEnvironment
        || profile.source.entitlements.some((entitlement) => entitlement.dataEnvironment !== profile.source.dataEnvironment)) {
      limitations.push({ code: "source-environment-mismatch", message: "Company profile provider response, provenance and permission environments disagree; profile facts were excluded.", subjectSecurityId: securityId, sourceId: profile.source.sourceRecordId });
    }
    for (const fact of profile.facts) {
      if (duplicateProfileFields.has(fact.providerField)) continue;
      if (fact.value === null || !envelopeEligible) continue;
      const evidenceId = `profile:${profile.source.providerId}:${profile.source.sourceRecordId}:${fact.providerField}`;
      const source = sourceFromFinancialProvenance(profile.source, assembledAt, options.consumer);
      if (!isSourceEligible(source)) continue;
      evidence.push({ evidenceId, kind: "company-profile", subjectSecurityId: securityId, sources: [source], sourceAsOf: fact.asOf ?? profile.source.asOf, collectedAt: assembledAt, freshness: freshnessFor(fact.asOf ?? profile.source.asOf, assembledAt, options), aiProcessingEligible: true, field: fact.field, value: fact.value, providerField: fact.providerField });
    }
    for (const providerField of duplicateProfileFields) limitations.push({ code: "duplicate-profile-field-id", message: `Company profile field ${providerField} is duplicated; ambiguous facts were excluded.`, subjectSecurityId: securityId, sourceId: profile.source.sourceRecordId });
    const profileCount = evidence.filter((item) => item.kind === "company-profile").length;
    sectionStatus.profile = profileCount ? (profileResult.status === "complete" && envelopeEligible && profileCount === profile.facts.filter((fact) => fact.value !== null).length ? "complete" : "partial") : "unavailable";
    if (sectionStatus.profile !== "complete") limitations.push({ code: "profile-partial-or-excluded", message: "Company profile coverage is partial or permission checks excluded its facts.", subjectSecurityId: securityId, sourceId: profile.source.sourceRecordId });
  } else if (profileValidationIssues.some((issue) => issue.code.includes("ENVIRONMENT_MISMATCH"))) {
    limitations.push({ code: "source-environment-mismatch", message: "Company profile source and permission environments disagree; profile facts were excluded.", subjectSecurityId: securityId, sourceId: rawProfile?.source.sourceRecordId });
  } else if (!validProfile) {
    limitations.push({ code: "profile-unavailable", message: "Validated company profile evidence is unavailable.", subjectSecurityId: securityId });
  }

  const statementValidationIssues = statementResult?.data ? validateFinancialStatementBundle(statementResult.data) : [];
  if (statementResult?.data && (statementResult.status === "complete" || statementResult.status === "partial")
      && statementValidationIssues.length === 0) {
    const responseEnvironmentMatches = providerEnvironmentMatches(statementResult.dataEnvironment, statementResult.entitlements);
    const providerIdentityMatches = statementResult.provider.id === provider.providerId;
    const providerEnvelopeValid = providerIdentityMatches && responseEnvironmentMatches;
    if (!responseEnvironmentMatches) limitations.push({ code: "source-environment-mismatch", message: "Financial provider response and permission environments disagree; affected observations were excluded.", subjectSecurityId: securityId });
    if (!providerIdentityMatches) limitations.push({ code: "financial-provider-identity-mismatch", message: "Financial provider response identity does not match the configured fundamentals provider; observations were excluded.", subjectSecurityId: securityId });
    const observations = [
      ...statementResult.data.incomeStatement.observations,
      ...statementResult.data.balanceSheet.observations,
      ...statementResult.data.cashFlow.observations
    ];
    const duplicateObservationIds = duplicateValues(observations.map((observation) => observation.id));
    for (const observation of observations) {
      if (duplicateObservationIds.has(observation.id)) {
        limitations.push({ code: "duplicate-financial-observation-id", message: `Financial observation ID ${observation.id} is duplicated; ambiguous records were excluded.`, subjectSecurityId: securityId, sourceId: observation.id });
        continue;
      }
      if (observation.value === null) {
        limitations.push({ code: "financial-value-missing", message: `Reported observation ${observation.metricKey} is missing; it was not converted to zero.`, subjectSecurityId: securityId, sourceId: observation.id });
        continue;
      }
      if (observation.securityId !== securityId || !providerEnvelopeValid
          || observation.source.providerId !== statementResult.provider.id
          || !sourceEntitlementsEligible(statementResult.entitlements, observation.source, assembledAt, options.consumer, statementResult.dataEnvironment)) continue;
      const source = sourceFromFinancialProvenance(observation.source, assembledAt, options.consumer);
      if (!isSourceEligible(source)) continue;
      const evidenceId = `financial:${observation.source.providerId}:${observation.id}`;
      eligibleObservations.push(observation);
      observationEvidenceIds.set(observation.id, evidenceId);
      evidence.push({ evidenceId, kind: "financial-observation", subjectSecurityId: securityId, sources: [source], sourceAsOf: observation.source.asOf, collectedAt: assembledAt, freshness: freshnessFor(observation.source.asOf, assembledAt, options), aiProcessingEligible: true, observation, reportingPeriod: observation.period });
    }
    const allSectionsComplete = [statementResult.data.incomeStatement, statementResult.data.balanceSheet, statementResult.data.cashFlow].every((section) => section.status === "complete");
    sectionStatus.financialStatements = eligibleObservations.length
      ? (statementResult.status === "complete" && allSectionsComplete && providerEnvelopeValid && eligibleObservations.length === observations.length ? "complete" : "partial")
      : "unavailable";
    if (sectionStatus.financialStatements !== "complete") limitations.push({ code: "financial-coverage-partial-or-excluded", message: "Financial statements are partial, unavailable, or some observations were excluded by validation or permissions.", subjectSecurityId: securityId });
  } else if (statementValidationIssues.some((issue) => issue.code.includes("ENVIRONMENT_MISMATCH"))) {
    limitations.push({ code: "source-environment-mismatch", message: "Financial source and permission environments disagree; observations were excluded.", subjectSecurityId: securityId });
  } else {
    limitations.push({ code: "financial-statements-unavailable", message: "Validated financial statement evidence is unavailable.", subjectSecurityId: securityId });
  }

  const calculationResults = collectCalculations(securityId, eligibleObservations, options, assembledAt);
  for (const result of calculationResults) {
    if (result.status !== "calculated" || result.value === null) {
      limitations.push({ code: `metric-${result.status}`, message: result.explanation ?? `${result.displayName} could not be calculated from eligible evidence.`, subjectSecurityId: securityId, sourceId: result.formulaIdentifier });
      continue;
    }
    const inputEvidenceIds = result.inputObservationIds.map((id) => observationEvidenceIds.get(id)).filter((id): id is string => Boolean(id));
    if (inputEvidenceIds.length !== result.inputObservationIds.length) {
      limitations.push({ code: "metric-lineage-incomplete", message: `${result.displayName} was excluded because one or more input evidence IDs could not be resolved.`, subjectSecurityId: securityId, sourceId: result.formulaIdentifier });
      continue;
    }
    const inputObservations = result.inputObservationIds.map((id) => eligibleObservations.find((item) => item.id === id)).filter((item): item is FinancialObservation => Boolean(item));
    const sources = uniqueSources(inputObservations.map((item) => sourceFromFinancialProvenance(item.source, assembledAt, options.consumer)));
    const metric: CalculatedMetricEvidence = {
      evidenceId: `calculation:${result.id}`, kind: "calculated-metric", subjectSecurityId: securityId, sources,
      sourceAsOf: minDate(sources.map((source) => source.sourceAsOf)), collectedAt: assembledAt,
      freshness: combinedFreshness(sources.map((source) => freshnessFor(source.sourceAsOf, assembledAt, options))),
      aiProcessingEligible: sources.every(isSourceEligible), calculation: result, inputEvidenceIds,
      formulaIdentifier: result.formulaIdentifier, formulaVersion: result.formulaVersion
    };
    if (metric.aiProcessingEligible) evidence.push(metric);
  }
  sectionStatus.calculatedMetrics = evidence.some((item) => item.kind === "calculated-metric") ? "complete" : "unavailable";
  for (const formula of financialFormulaCatalogue) {
    if (formula.implementationStatus === "blocked-open-definition") limitations.push({ code: "metric-definition-open", message: `${formula.displayName} was not calculated because its definition remains open in D-34.`, subjectSecurityId: securityId, sourceId: formula.formulaIdentifier });
  }
  if (eligibleObservations.length && !evidence.some((item) => item.kind === "calculated-metric")) {
    limitations.push({ code: "no-calculated-metrics-available", message: "No supported metric had a complete, compatible, permitted input set.", subjectSecurityId: securityId });
  }

  const rawCompanyArticles = loadedNews.filter((article) => article && typeof article === "object" && article.securityId === securityId);
  const validIdArticles = rawCompanyArticles.filter((article) => isValidNewsArticleId((article as NewsArticle | null)?.id));
  rawCompanyArticles.filter((candidate) => !isValidNewsArticleId((candidate as NewsArticle | null)?.id)).forEach(() => {
    limitations.push({ code: "news-article-id-invalid", message: "A news article was excluded because its identifier is missing or malformed.", subjectSecurityId: securityId });
  });
  const duplicateArticleIds = duplicateValues(validIdArticles.map((article) => article.id));
  const companyArticles = validIdArticles.filter((article) => !duplicateArticleIds.has(article.id));
  for (const articleId of duplicateArticleIds) limitations.push({ code: "duplicate-news-article-id", message: `News article ID ${articleId} is duplicated; ambiguous records were excluded.`, subjectSecurityId: securityId, sourceId: articleId });
  const eligibleArticles: NewsArticle[] = [];
  for (const article of companyArticles) {
    if (article.contentKind !== "demo" && article.contentKind !== "licensed") {
      limitations.push({ code: "news-source-type-invalid", message: "A news article was excluded because its source type is not recognized.", subjectSecurityId: securityId, sourceId: article.id });
      continue;
    }
    if (!isValidSentiment(article.sentiment)) {
      limitations.push({ code: "news-sentiment-invalid", message: "A news article was excluded because its sentiment label, confidence or explanatory metadata is invalid.", subjectSecurityId: securityId, sourceId: article.id });
      continue;
    }
    const entitlements = article.contentKind === "demo"
      ? [createSyntheticDemoEntitlement({ providerId: "aynox-synthetic-news", dataset: "synthetic-company-news", market: identity.exchange })]
      : options.newsEntitlements?.[article.id] ?? [];
    const source = sourceFromInput(newsSource(article, identity.exchange, entitlements, assembledAt), assembledAt, options.consumer);
    if (!isSourceEligible(source)) {
      limitations.push({ code: "news-permission-denied-or-unverified", message: "A news item was excluded because retrieval or AI-processing permission is missing, denied, or unverified.", subjectSecurityId: securityId, sourceId: article.id });
      continue;
    }
    eligibleArticles.push(article);
    evidence.push({ evidenceId: `news:${article.id}`, kind: "company-news-article", subjectSecurityId: securityId, sources: [source], sourceAsOf: article.publishedAt, collectedAt: assembledAt, freshness: freshnessFor(article.publishedAt, assembledAt, options), aiProcessingEligible: true, article, sentiment: article.sentiment, articleDate: article.publishedAt });
  }
  const newsCoverageStatus = options.newsCoverageStatus ?? "partial";
  sectionStatus.news = eligibleArticles.length
    ? (newsCoverageStatus === "complete" && duplicateArticleIds.size === 0 && eligibleArticles.length === companyArticles.length ? "complete" : "partial")
    : "unavailable";
  if (eligibleArticles.length !== companyArticles.length || newsCoverageStatus !== "complete") {
    limitations.push({ code: "news-coverage-limited", message: "News coverage is a partial or synthetic sample and may not represent all company news.", subjectSecurityId: securityId });
  }
  if (eligibleArticles.length) {
    const summarySources = uniqueNewsSources(eligibleArticles, identity.exchange, options, assembledAt).map((input) => sourceFromInput(input, assembledAt, options.consumer));
    const summaryId = eligibleArticles.map((article) => article.id).sort().join("|");
    if (summarySources.every((source) => isSourceEligible(source) && source.permissions.derivation.allowed)) {
      const newsReport = generateCompanyNewsReport(security!, eligibleArticles);
      evidence.push({ evidenceId: `news-summary:${securityId}:${summaryId}`, kind: "company-news-summary", subjectSecurityId: securityId, sources: summarySources, sourceAsOf: minDate(summarySources.map((source) => source.sourceAsOf)), collectedAt: assembledAt, freshness: combinedFreshness(summarySources.map((source) => freshnessFor(source.sourceAsOf, assembledAt, options))), aiProcessingEligible: summarySources.every(isSourceEligible), report: newsReport, sentiment: newsReport.sentimentDistribution });
    } else {
      limitations.push({ code: "news-summary-derivation-permission-denied", message: "The company news summary was excluded because derivation permission is denied, unverified or out of scope for at least one source article.", subjectSecurityId: securityId });
    }
  }

  let eligibleEsgCount = 0;
  const esgCandidates = (options.esgCandidates ?? []).filter((item) => item.securityId === securityId);
  const duplicateEsgIds = duplicateValues(esgCandidates.map((item) => `${item.source.providerId}:${item.id}`));
  for (const candidate of esgCandidates) {
    if (duplicateEsgIds.has(`${candidate.source.providerId}:${candidate.id}`)) continue;
    if (candidate.isIllustrative !== false || candidate.source.dataEnvironment === "synthetic") {
      limitations.push({ code: "esg-synthetic-excluded", message: "Synthetic or illustrative ESG evidence is not eligible for a research snapshot.", subjectSecurityId: securityId, sourceId: candidate.id });
      continue;
    }
    if (!isVerifiedEsgCandidate(candidate)) continue;
    const source = sourceFromInput(candidate.source, assembledAt, options.consumer);
    if (!isSourceEligible(source) || !isValidTimestamp(candidate.sourceAsOf)) continue;
    evidence.push({ evidenceId: `esg:${candidate.source.providerId}:${candidate.id}`, kind: "esg-observation", subjectSecurityId: securityId, sources: [source], sourceAsOf: candidate.sourceAsOf, collectedAt: assembledAt, freshness: freshnessFor(candidate.sourceAsOf, assembledAt, options), aiProcessingEligible: true, score: candidate.score, label: candidate.label, methodology: candidate.methodology, verificationStatus: "verified" });
    eligibleEsgCount += 1;
  }
  for (const candidateId of duplicateEsgIds) limitations.push({ code: "duplicate-esg-candidate-id", message: `ESG candidate ID ${candidateId} is duplicated; ambiguous candidates were excluded.`, subjectSecurityId: securityId, sourceId: candidateId });
  sectionStatus.esg = eligibleEsgCount ? "complete" : "not-assessed";
  if (!eligibleEsgCount) limitations.push({ code: "esg-not-verified", message: "No ESG evidence with verified source, methodology, date and permitted use was available; illustrative ESG demos were excluded.", subjectSecurityId: securityId });

  for (const item of evidence) {
    if (item.freshness === "stale" || item.freshness === "unknown" || item.freshness === "mixed") {
      limitations.push({ code: `evidence-freshness-${item.freshness}`, message: `Evidence ${item.evidenceId} has ${item.freshness} freshness status.`, subjectSecurityId: securityId, sourceId: item.evidenceId });
    }
  }
  const collisionFreeEvidence = excludeEvidenceIdCollisions(evidence, limitations, securityId);
  const uniqueEvidenceIds = new Set(collisionFreeEvidence.filter((item) => item.kind !== "calculated-metric").map((item) => item.evidenceId));
  const uniqueEvidence = collisionFreeEvidence
    .filter((item) => {
      if (item.kind !== "calculated-metric") return true;
      const lineageComplete = item.inputEvidenceIds.every((id) => uniqueEvidenceIds.has(id));
      if (!lineageComplete) limitations.push({ code: "metric-lineage-incomplete", message: `${item.calculation.displayName} was excluded because final evidence-ID validation removed an input record.`, subjectSecurityId: securityId, sourceId: item.formulaIdentifier });
      return lineageComplete;
    });
  const includedObservationIds = new Set(uniqueEvidence.filter((item) => item.kind === "financial-observation").map((item) => item.observation.id));
  if (sectionStatus.calculatedMetrics === "complete" && !uniqueEvidence.some((item) => item.kind === "calculated-metric")) sectionStatus.calculatedMetrics = "unavailable";
  const snapshot = makeSnapshot({
    snapshotId, schemaVersion: "1.0.0", subject, securityMapping: { status: "resolved", providerId: provider.providerId }, assembledAt,
    completeness: determineCompleteness(sectionStatus, uniqueEvidence), freshness: combinedFreshness(uniqueEvidence.map((item) => item.freshness)),
    sections: sectionStatus, evidence: uniqueEvidence, limitations, sourceObservationIds: eligibleObservations.filter((item) => includedObservationIds.has(item.id)).map((item) => item.id),
    calculationVersions: uniqueEvidence.filter((item): item is CalculatedMetricEvidence => item.kind === "calculated-metric")
      .map((item) => ({ formulaIdentifier: item.formulaIdentifier, formulaVersion: item.formulaVersion }))
  });
  return immutableSnapshot(snapshot);
}

function collectCalculations(securityId: string, observations: FinancialObservation[], options: ResearchEvidenceAssemblyOptions, assembledAt: string): FinancialCalculationResult[] {
  const context = { consumer: options.consumer, calculatedAt: assembledAt };
  const results: FinancialCalculationResult[] = [];
  for (const formula of financialFormulaCatalogue) {
    if (formula.implementationStatus !== "implemented-provisional") continue;
    const groups = formula.requiredMetricKeys.map((metricKey) => observations.filter((observation) => observation.metricKey === metricKey && observation.securityId === securityId)
      .sort((a, b) => b.period.end.localeCompare(a.period.end) || a.id.localeCompare(b.id)));
    if (groups.some((group) => group.length === 0)) {
      results.push(calculateFinancialMetric(formula.metricId, groups.flat().slice(0, formula.requiredMetricKeys.length), context));
      continue;
    }
    let lastResult: FinancialCalculationResult | undefined;
    let found = false;
    for (const inputs of candidateInputSets(formula.metricId, groups)) {
      const result = calculateFinancialMetric(formula.metricId, inputs, context);
      if (result.status === "calculated" && result.value !== null) { results.push(result); found = true; break; }
      lastResult = result;
    }
    if (!found) results.push(lastResult ?? calculateFinancialMetric(formula.metricId, groups.flat().slice(0, formula.requiredMetricKeys.length), context));
  }
  return results;
}

function candidateInputSets(metricId: string, groups: FinancialObservation[][]): FinancialObservation[][] {
  if (metricId === "revenue-growth" && groups.length === 2 && groups[0] === groups[1]) {
    return groups[0].flatMap((current) => groups[0].filter((prior) => prior.id !== current.id && prior.period.end < current.period.end).map((prior) => [current, prior]));
  }
  const sets: FinancialObservation[][] = [];
  const visit = (index: number, chosen: FinancialObservation[]) => {
    if (index === groups.length) { if (new Set(chosen.map((item) => item.id)).size === chosen.length) sets.push(chosen); return; }
    for (const observation of groups[index]) visit(index + 1, [...chosen, observation]);
  };
  visit(0, []);
  return sets;
}

function sourceFromFinancialProvenance(source: FinancialDataProvenance, at: string, consumer: ResearchEvidenceAssemblyOptions["consumer"]): ResearchSourceProvenance {
  return sourceFromInput({ providerId: source.providerId, providerName: source.providerName, dataset: source.dataset, market: source.market,
    sourceRecordId: source.sourceRecordId, sourceUrl: source.sourceUrl, sourceAsOf: source.asOf, retrievedAt: source.retrievedAt,
    dataEnvironment: source.dataEnvironment, entitlements: source.entitlements, revisionStatus: source.revision.status, revisionId: source.revision.revisionId }, at, consumer);
}

function sourceFromInput(input: ResearchSourceInput, at: string, consumer: ResearchEvidenceAssemblyOptions["consumer"], expectedEnvironment: ResearchSourceInput["dataEnvironment"] = input.dataEnvironment): ResearchSourceProvenance {
  const entitlement = input.entitlements.length === 1 ? input.entitlements[0] : undefined;
  const scope = { providerId: input.providerId, dataset: input.dataset, market: input.market,
    contractRef: entitlement?.contractRef ?? "", contractVersion: entitlement?.contractVersion ?? "" };
  const permissions = Object.fromEntries(OPERATIONS.map((operation) => {
    const decision = evaluateDataPermission(input.entitlements, scope, operation, at, consumer);
    const environmentMatches = Boolean(entitlement && input.dataEnvironment === expectedEnvironment && entitlement.dataEnvironment === input.dataEnvironment);
    return [operation, { allowed: decision.allowed && environmentMatches, reason: environmentMatches ? decision.reason : "source-environment-mismatch", entitlementId: decision.entitlementId }];
  })) as Record<DataOperation, PermissionEvidence>;
  return { providerId: input.providerId, providerName: input.providerName, dataset: input.dataset, market: input.market,
    sourceRecordId: input.sourceRecordId, sourceUrl: input.sourceUrl, sourceAsOf: input.sourceAsOf, retrievedAt: input.retrievedAt,
    dataEnvironment: input.dataEnvironment, revisionStatus: input.revisionStatus, revisionId: input.revisionId,
    sourceKind: input.dataEnvironment, permissionScope: scope, permissions, entitledAudience: entitlement?.permittedAudience ?? null };
}

function sourceEntitlementsEligible(entitlements: DataEntitlement[], source: FinancialDataProvenance, at: string, consumer: ResearchEvidenceAssemblyOptions["consumer"], providerEnvironment: ResearchSourceInput["dataEnvironment"]): boolean {
  if (source.entitlements.length !== 1) return false;
  const sourceEntitlement = source.entitlements[0];
  if (source.dataEnvironment !== providerEnvironment || sourceEntitlement.dataEnvironment !== source.dataEnvironment) return false;
  const scope = { providerId: source.providerId, dataset: source.dataset, market: source.market,
    contractRef: sourceEntitlement.contractRef, contractVersion: sourceEntitlement.contractVersion };
  const matches = entitlements.filter((item) => item.id === sourceEntitlement.id && item.providerId === scope.providerId
    && item.dataset === scope.dataset && item.market === scope.market && item.contractRef === scope.contractRef
    && item.contractVersion === scope.contractVersion);
  if (matches.length !== 1) return false;
  return evaluateDataPermission(entitlements, scope, "retrieval", at, consumer).allowed
    && evaluateDataPermission(entitlements, scope, "ai-processing", at, consumer).allowed;
}

function providerEnvironmentMatches(environment: ResearchSourceInput["dataEnvironment"], entitlements: DataEntitlement[]): boolean {
  return entitlements.length > 0 && entitlements.every((entitlement) => entitlement.dataEnvironment === environment);
}

function isSourceEligible(source: ResearchSourceProvenance): boolean { return source.permissions.retrieval.allowed && source.permissions["ai-processing"].allowed; }

function isValidSentiment(value: unknown): value is NewsArticle["sentiment"] {
  if (!value || typeof value !== "object") return false;
  const sentiment = value as Partial<NewsArticle["sentiment"]>;
  return (sentiment.label === "Positive" || sentiment.label === "Negative" || sentiment.label === "Neutral")
    && typeof sentiment.explanation === "string" && Boolean(sentiment.explanation.trim())
    && Array.isArray(sentiment.matchedPositiveTerms) && sentiment.matchedPositiveTerms.every((term) => typeof term === "string")
    && Array.isArray(sentiment.matchedNegativeTerms) && sentiment.matchedNegativeTerms.every((term) => typeof term === "string")
    && typeof sentiment.heuristicConfidence === "number" && Number.isFinite(sentiment.heuristicConfidence)
    && sentiment.heuristicConfidence >= 0 && sentiment.heuristicConfidence <= 1
    && sentiment.calibrated === false && typeof sentiment.classifier === "string" && Boolean(sentiment.classifier.trim())
    && (sentiment.status === "classified" || sentiment.status === "ambiguous" || sentiment.status === "insufficient-content")
    && (sentiment.status === "classified" || sentiment.label === "Neutral");
}

function duplicateValues(values: string[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) { if (seen.has(value)) duplicates.add(value); else seen.add(value); }
  return duplicates;
}

export function excludeEvidenceIdCollisions(items: ResearchEvidenceItem[], limitations: ResearchEvidenceSnapshot["limitations"], securityId: string): ResearchEvidenceItem[] {
  const duplicates = duplicateValues(items.map((item) => item.evidenceId));
  for (const evidenceId of duplicates) limitations.push({ code: "duplicate-evidence-id", message: `Evidence ID ${evidenceId} collides in the assembled snapshot; all ambiguous records were excluded.`, subjectSecurityId: securityId, sourceId: evidenceId });
  return items.filter((item) => !duplicates.has(item.evidenceId));
}

function newsSource(article: NewsArticle, market: string, entitlements: DataEntitlement[], retrievedAt: string): ResearchSourceInput {
  const synthetic = article.contentKind === "demo";
  return { providerId: synthetic ? "aynox-synthetic-news" : (entitlements[0]?.providerId ?? "unknown-news-provider"),
    providerName: article.sourceName, dataset: synthetic ? "synthetic-company-news" : (entitlements[0]?.dataset ?? "unknown-news-dataset"),
    market, sourceRecordId: article.id, sourceAsOf: article.publishedAt, retrievedAt,
    dataEnvironment: synthetic ? "synthetic" : (entitlements[0]?.dataEnvironment ?? "development-restricted"), entitlements };
}

function uniqueNewsSources(articles: NewsArticle[], market: string, options: ResearchEvidenceAssemblyOptions, retrievedAt: string): ResearchSourceInput[] {
  const unique = new Map<string, ResearchSourceInput>();
  for (const article of articles) {
    const entitlements = article.contentKind === "demo" ? [createSyntheticDemoEntitlement({ providerId: "aynox-synthetic-news", dataset: "synthetic-company-news", market })] : options.newsEntitlements?.[article.id] ?? [];
    const source = newsSource(article, market, entitlements, retrievedAt);
    unique.set(`${source.providerId}:${source.dataset}:${source.market}:${source.sourceRecordId}`, source);
  }
  return [...unique.values()];
}

function isVerifiedEsgCandidate(candidate: VerifiedEsgEvidenceCandidate): boolean {
  return candidate.sourceVerificationStatus === "verified" && candidate.methodologyVerificationStatus === "verified" && Boolean(candidate.id.trim() && candidate.score.trim()
    && candidate.label.trim() && candidate.methodology.trim() && candidate.source.providerId.trim()
    && candidate.source.dataset.trim() && candidate.source.sourceRecordId.trim()
    && parseDecimalString(candidate.score) !== null && isValidTimestamp(candidate.sourceAsOf));
}

function freshnessFor(sourceAsOf: string | null, assembledAt: string, options: ResearchEvidenceAssemblyOptions): EvidenceFreshness {
  return options.freshnessEvaluator ? options.freshnessEvaluator(sourceAsOf, assembledAt) : "unknown";
}

function combinedFreshness(values: EvidenceFreshness[]): EvidenceFreshness {
  const distinct = new Set(values);
  if (!distinct.size) return "unknown";
  return distinct.size === 1 ? values[0] : "mixed";
}

function minDate(values: Array<string | null>): string | null { return values.filter((value): value is string => Boolean(value)).sort()[0] ?? null; }
function isValidTimestamp(value: string): boolean { return Number.isFinite(Date.parse(value)); }

function uniqueSources(sources: ResearchSourceProvenance[]): ResearchSourceProvenance[] {
  const unique = new Map<string, ResearchSourceProvenance>();
  for (const source of sources) unique.set(`${source.providerId}:${source.dataset}:${source.market}:${source.sourceRecordId}`, source);
  return [...unique.values()];
}

function determineCompleteness(sections: ResearchEvidenceSnapshot["sections"], evidence: ResearchEvidenceItem[]): EvidenceCompleteness {
  const financialCount = evidence.filter((item) => item.kind === "financial-observation").length;
  const newsCount = evidence.filter((item) => item.kind === "company-news-article").length;
  if (!evidence.length) return "unavailable";
  if (!financialCount && (newsCount > 0 || sections.profile !== "unavailable")) return "insufficient-evidence";
  return sections.profile === "complete" && sections.financialStatements === "complete" && sections.news === "complete" ? "complete" : "partial";
}

function makeSnapshot(input: ResearchEvidenceSnapshot): ResearchEvidenceSnapshot { return input; }

function immutableSnapshot(input: ResearchEvidenceSnapshot): DeepReadonly<ResearchEvidenceSnapshot> {
  return deepFreeze(structuredClone(makeSnapshot(input)));
}

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value as DeepReadonly<T>;
}
