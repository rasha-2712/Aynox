import "server-only";
import { randomUUID } from "node:crypto";
import { demoSecurities } from "@/lib/data/demo-data";
import { calculateFinancialMetric } from "@/lib/financial/calculation-engine";
import { securityIdentityFromSecurity } from "@/lib/financial/security-mapping";
import { validateCompanyProfileRecord, validateFinancialStatementBundle } from "@/lib/financial/validation";
import { financialFormulaCatalogue } from "@/lib/financial/formula-catalogue";
import { parseDecimalString } from "@/lib/financial/decimal";
import { getFundamentalsProvider } from "@/lib/providers";
import { getNewsArticles } from "@/lib/news/service";
import { generateCompanyNewsReport } from "@/lib/news/report";
import { isValidNewsArticleId } from "@/lib/news/validation";
import type { DataOperation, FinancialCalculationResult, FinancialDataProvenance, FinancialObservation, FundamentalsProvider, SecurityIdentity } from "@/types/financial";
import type { NewsArticle } from "@/types/news";
import type { CalculatedMetricEvidence, DeepReadonly, EvidenceCompleteness, EvidenceFreshness, EvidencePermissionAssessment, EntitlementVerificationReceipt, ResearchEvidenceAssemblyOptions, ResearchEvidenceAssemblerDependencies, ResearchEvidenceItem, ResearchEvidenceSnapshot, ResearchSourceProvenance, ResearchSourceInput, ResearchSubject, VerifiedEsgEvidenceCandidate } from "@/types/research";
import { evaluateResearchSourceEntitlement, createResearchContextBinding, verifyNewsRetrievalAuthorization, verifyResearchRetrievalPreflight } from "@/lib/research/evidence-permissions.server";
import { validateTrustedResearchRequestContext } from "@/lib/research/request-context.server";
import { isSyntheticEvidenceFixtureAllowed } from "@/lib/research/synthetic-evidence-policy.server";

const trustedResearchEvidenceSnapshots = new WeakSet<object>();
const assessmentForSource = new WeakMap<object, { assessment: EvidencePermissionAssessment; receipt: EntitlementVerificationReceipt | null; eligibleForAI: boolean }>();

/** True only for immutable snapshots issued by this server-side evidence assembler. */
export function isTrustedResearchEvidenceSnapshot(value: unknown): value is DeepReadonly<ResearchEvidenceSnapshot> {
  return typeof value === "object" && value !== null && trustedResearchEvidenceSnapshots.has(value);
}

/** Deterministically assembles permitted, source-grounded evidence. It does not persist data or generate AI reports. */
export async function assembleResearchEvidence(
  securityId: string,
  options: ResearchEvidenceAssemblyOptions,
  dependencies: ResearchEvidenceAssemblerDependencies = {}
): Promise<DeepReadonly<ResearchEvidenceSnapshot>> {
  if (!validateTrustedResearchRequestContext(options.requestContext).ok
      || options.requestContext.authorizedSecurityId !== securityId) {
    throw new TypeError("A trusted request context authorized for this security is required.");
  }
  const contextBinding = createResearchContextBinding(options.requestContext);
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
    return immutableSnapshot({ snapshotId, schemaVersion: "1.0.0", subject, securityMapping: { status: mapping.status, providerId: provider.providerId, reason: mapping.reason }, assembledAt, contextBinding, completeness: "unavailable", freshness: "unknown", sections: sectionStatus, evidence, entitlementReceipts: [], permissionAssessments: [], limitations, sourceObservationIds: [], calculationVersions: [] });
  }

  const identity: SecurityIdentity = securityIdentityFromSecurity(security!);
  const syntheticFixtureAllowed = isSyntheticEvidenceFixtureAllowed(options.requestContext);
  const entitlementContract = provider.getResearchEntitlementContract?.() ?? null;
  let preflight = null;
  try { preflight = await provider.getResearchRetrievalPreflight?.(identity) ?? null; } catch { preflight = null; }
  const preflightOk = verifyResearchRetrievalPreflight(preflight, provider.providerId, entitlementContract?.dataset ?? "", identity.exchange,
    securityId, entitlementContract, options.requestContext);
  if (!preflightOk) {
    limitations.push({ code: "retrieval-preflight-denied", message: "Provider retrieval authorization was unavailable or did not match the trusted request scope; protected fundamentals were not fetched.", subjectSecurityId: securityId });
  }
  let newsRetrievalAuthorization: import("@/types/news").VerifiedNewsRetrievalAuthorization | null = null;
  if (dependencies.loadNewsArticles) {
    let newsPreflight = null;
    try { newsPreflight = await dependencies.newsRetrievalPreflight?.(identity) ?? null; } catch { newsPreflight = null; }
    newsRetrievalAuthorization = verifyNewsRetrievalAuthorization(newsPreflight, "aynox-synthetic-news", "synthetic-company-news", identity.exchange,
      securityId, { contractId: "aynox-synthetic-news-fixture", contractVersion: "1", retrievalScope: "dataset" }, options.requestContext);
    if (!newsRetrievalAuthorization) limitations.push({ code: "news-retrieval-preflight-denied", message: "News loader was not called because signed retrieval preflight was unavailable or mismatched.", subjectSecurityId: securityId });
  }
  const acceptedInjectedNews = options.newsArticles?.filter((article) => syntheticFixtureAllowed && article?.contentKind === "demo") ?? [];
  if (options.newsArticles !== undefined && acceptedInjectedNews.length !== options.newsArticles.length) {
    limitations.push({ code: "injected-news-fixture-denied", message: "Preloaded news is accepted only as a demo fixture under the explicit synthetic test policy.", subjectSecurityId: securityId });
  }
  const [profileResult, statementResult, loadedNews] = await Promise.all([
    preflightOk ? provider.getCompanyProfile(identity).catch(() => null) : Promise.resolve(null),
    preflightOk ? provider.getFinancialStatements(identity).catch(() => null) : Promise.resolve(null),
    options.newsArticles !== undefined
      ? Promise.resolve(acceptedInjectedNews)
      : dependencies.loadNewsArticles
        ? (newsRetrievalAuthorization && syntheticFixtureAllowed ? dependencies.loadNewsArticles(newsRetrievalAuthorization).catch(() => []) : Promise.resolve([]))
        : (syntheticFixtureAllowed ? getNewsArticles().catch(() => []) : Promise.resolve([]))
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
      && sourceEntitlementsEligible(profile.source, provider, securityId, options.requestContext, profileResult.dataEnvironment);
    if (!profileEnvironmentMatches || profileResult.dataEnvironment !== profile.source.dataEnvironment
        || profile.source.entitlements.some((entitlement) => entitlement.dataEnvironment !== profile.source.dataEnvironment)) {
      limitations.push({ code: "source-environment-mismatch", message: "Company profile provider response, provenance and permission environments disagree; profile facts were excluded.", subjectSecurityId: securityId, sourceId: profile.source.sourceRecordId });
    }
    for (const fact of profile.facts) {
      if (duplicateProfileFields.has(fact.providerField)) continue;
      if (fact.value === null || !envelopeEligible) continue;
      const evidenceId = `profile:${profile.source.providerId}:${profile.source.sourceRecordId}:${fact.providerField}`;
      const source = sourceFromFinancialProvenance(profile.source, assembledAt, options.requestContext, provider, securityId);
      if (!isSourceEligible(source)) continue;
      evidence.push({ evidenceId, kind: "company-profile", subjectSecurityId: securityId, sources: [source], permissionAssessmentIds: permissionIds([source]), sourceAsOf: fact.asOf ?? profile.source.asOf, collectedAt: assembledAt, freshness: freshnessFor(fact.asOf ?? profile.source.asOf, assembledAt, options), aiProcessingEligible: true, field: fact.field, value: fact.value, providerField: fact.providerField });
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
          || !sourceEntitlementsEligible(observation.source, provider, securityId, options.requestContext, statementResult.dataEnvironment)) continue;
      const source = sourceFromFinancialProvenance(observation.source, assembledAt, options.requestContext, provider, securityId);
      if (!isSourceEligible(source)) continue;
      const evidenceId = `financial:${observation.source.providerId}:${observation.id}`;
      eligibleObservations.push(observation);
      observationEvidenceIds.set(observation.id, evidenceId);
      evidence.push({ evidenceId, kind: "financial-observation", subjectSecurityId: securityId, sources: [source], permissionAssessmentIds: permissionIds([source]), sourceAsOf: observation.source.asOf, collectedAt: assembledAt, freshness: freshnessFor(observation.source.asOf, assembledAt, options), aiProcessingEligible: true, observation, reportingPeriod: observation.period });
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
    const sources = uniqueSources(inputObservations.map((item) => sourceFromFinancialProvenance(item.source, assembledAt, options.requestContext, provider, securityId)));
    const metric: CalculatedMetricEvidence = {
      evidenceId: `calculation:${result.id}`, kind: "calculated-metric", subjectSecurityId: securityId, sources,
      sourceAsOf: minDate(sources.map((source) => source.sourceAsOf)), collectedAt: assembledAt,
      freshness: combinedFreshness(sources.map((source) => freshnessFor(source.sourceAsOf, assembledAt, options))),
      aiProcessingEligible: sources.every((source) => isSourceEligible(source) && sourceOperationAllowed(source, "derivation")), permissionAssessmentIds: permissionIds(sources), calculation: result, inputEvidenceIds,
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
  const nonDemoArticles = rawCompanyArticles.filter((article) => article.contentKind !== "demo");
  if (nonDemoArticles.length) {
    limitations.push({ code: "news-content-not-authenticated", message: "Non-demo news content was excluded; retrieval entitlement does not authenticate article content.", subjectSecurityId: securityId });
  }
  const demoCompanyArticles = rawCompanyArticles.filter((article) => article.contentKind === "demo");
  const validIdArticles = demoCompanyArticles.filter((article) => isValidNewsArticleId((article as NewsArticle | null)?.id));
  demoCompanyArticles.filter((candidate) => !isValidNewsArticleId((candidate as NewsArticle | null)?.id)).forEach(() => {
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
    const source = sourceFromInput(newsSource(article, identity.exchange, assembledAt, options.newsEntitlementRecords?.[article.id]), assembledAt, options.requestContext, undefined, securityId);
    if (!isSourceEligible(source)) {
      limitations.push({ code: "news-permission-denied-or-unverified", message: "A news item was excluded because retrieval or AI-processing permission is missing, denied, or unverified.", subjectSecurityId: securityId, sourceId: article.id });
      continue;
    }
    eligibleArticles.push(article);
    if (!sourceOperationAllowed(source, "derivation")) continue;
    evidence.push({ evidenceId: `news:${article.id}`, kind: "company-news-article", subjectSecurityId: securityId, sources: [source], permissionAssessmentIds: permissionIds([source]), sourceAsOf: article.publishedAt, collectedAt: assembledAt, freshness: freshnessFor(article.publishedAt, assembledAt, options), aiProcessingEligible: true, article, sentiment: article.sentiment, articleDate: article.publishedAt });
  }
  const newsCoverageStatus = options.newsCoverageStatus ?? "partial";
  sectionStatus.news = eligibleArticles.length
    ? (newsCoverageStatus === "complete" && duplicateArticleIds.size === 0 && eligibleArticles.length === companyArticles.length ? "complete" : "partial")
    : "unavailable";
  if (eligibleArticles.length !== companyArticles.length || newsCoverageStatus !== "complete") {
    limitations.push({ code: "news-coverage-limited", message: "News coverage is a partial or synthetic sample and may not represent all company news.", subjectSecurityId: securityId });
  }
  if (eligibleArticles.length) {
    const summarySources = uniqueNewsSources(eligibleArticles, identity.exchange, options, assembledAt).map((input) => sourceFromInput(input, assembledAt, options.requestContext, undefined, securityId));
    const summaryId = eligibleArticles.map((article) => article.id).sort().join("|");
    if (summarySources.every((source) => isSourceEligible(source) && sourceOperationAllowed(source, "derivation"))) {
      const newsReport = generateCompanyNewsReport(security!, eligibleArticles);
      evidence.push({ evidenceId: `news-summary:${securityId}:${summaryId}`, kind: "company-news-summary", subjectSecurityId: securityId, sources: summarySources, permissionAssessmentIds: permissionIds(summarySources), sourceAsOf: minDate(summarySources.map((source) => source.sourceAsOf)), collectedAt: assembledAt, freshness: combinedFreshness(summarySources.map((source) => freshnessFor(source.sourceAsOf, assembledAt, options))), aiProcessingEligible: summarySources.every((source) => isSourceEligible(source) && sourceOperationAllowed(source, "derivation")), report: newsReport, sentiment: newsReport.sentimentDistribution });
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
    const source = sourceFromInput(candidate.source, assembledAt, options.requestContext);
    if (!isSourceEligible(source) || !isValidTimestamp(candidate.sourceAsOf)) continue;
    evidence.push({ evidenceId: `esg:${candidate.source.providerId}:${candidate.id}`, kind: "esg-observation", subjectSecurityId: securityId, sources: [source], permissionAssessmentIds: permissionIds([source]), sourceAsOf: candidate.sourceAsOf, collectedAt: assembledAt, freshness: freshnessFor(candidate.sourceAsOf, assembledAt, options), aiProcessingEligible: true, score: candidate.score, label: candidate.label, methodology: candidate.methodology, verificationStatus: "verified" });
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
  const sources = uniqueSources(uniqueEvidence.flatMap((item) => item.sources));
  const evaluations = sources.map((source) => assessmentForSource.get(source)).filter((value): value is NonNullable<typeof value> => Boolean(value));
  const snapshot = makeSnapshot({
    snapshotId, schemaVersion: "1.0.0", subject, securityMapping: { status: "resolved", providerId: provider.providerId }, assembledAt, contextBinding,
    completeness: determineCompleteness(sectionStatus, uniqueEvidence), freshness: combinedFreshness(uniqueEvidence.map((item) => item.freshness)),
    sections: sectionStatus, evidence: uniqueEvidence, entitlementReceipts: [...new Map(evaluations.flatMap((item) => item.receipt ? [[item.receipt.receiptId, item.receipt] as const] : [])).values()], permissionAssessments: evaluations.map((item) => item.assessment), limitations, sourceObservationIds: eligibleObservations.filter((item) => includedObservationIds.has(item.id)).map((item) => item.id),
    calculationVersions: uniqueEvidence.filter((item): item is CalculatedMetricEvidence => item.kind === "calculated-metric")
      .map((item) => ({ formulaIdentifier: item.formulaIdentifier, formulaVersion: item.formulaVersion }))
  });
  return immutableSnapshot(snapshot);
}

function collectCalculations(securityId: string, observations: FinancialObservation[], options: ResearchEvidenceAssemblyOptions, assembledAt: string): FinancialCalculationResult[] {
  const context = { consumer: { environment: "synthetic" as const, audience: "demo-only" as const }, calculatedAt: assembledAt };
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

function sourceFromFinancialProvenance(source: FinancialDataProvenance, at: string, context: ResearchEvidenceAssemblyOptions["requestContext"], provider: FundamentalsProvider, securityId: string): ResearchSourceProvenance {
  return sourceFromInput({ providerId: source.providerId, providerName: source.providerName, dataset: source.dataset, market: source.market,
    sourceRecordId: source.sourceRecordId, sourceUrl: source.sourceUrl, sourceAsOf: source.asOf, retrievedAt: source.retrievedAt,
    dataEnvironment: source.dataEnvironment, entitlements: source.entitlements, technicalEntitlements: source.technicalEntitlements,
    expectedContract: provider.getResearchEntitlementContract?.() ?? undefined, revisionStatus: source.revision.status, revisionId: source.revision.revisionId }, at, context, undefined, securityId);
}

function sourceFromInput(input: ResearchSourceInput, at: string, context: ResearchEvidenceAssemblyOptions["requestContext"], expectedEnvironment: ResearchSourceInput["dataEnvironment"] = input.dataEnvironment, securityId = context.authorizedSecurityId): ResearchSourceProvenance {
  const expected = input.expectedContract;
  const evaluation = evaluateResearchSourceEntitlement({
    providerId: input.providerId, dataset: input.dataset, market: input.market, securityId,
    sourceRecordId: input.sourceRecordId, dataEnvironment: input.dataEnvironment,
    expectedContract: expected ?? null, records: input.technicalEntitlements ?? []
  }, context, at);
  const source: ResearchSourceProvenance = { providerId: input.providerId, providerName: input.providerName, dataset: input.dataset, market: input.market,
    sourceRecordId: input.sourceRecordId, sourceUrl: input.sourceUrl, sourceAsOf: input.sourceAsOf, retrievedAt: input.retrievedAt,
    dataEnvironment: input.dataEnvironment, revisionStatus: input.revisionStatus, revisionId: input.revisionId,
    sourceKind: input.dataEnvironment };
  const assessment = expectedEnvironment === input.dataEnvironment ? evaluation : evaluateResearchSourceEntitlement({
    providerId: input.providerId, dataset: input.dataset, market: input.market, securityId,
    sourceRecordId: input.sourceRecordId, dataEnvironment: "development-restricted", expectedContract: null, records: []
  }, context, at);
  assessmentForSource.set(source, { assessment: assessment.assessment, receipt: assessment.receipt, eligibleForAI: assessment.eligibleForAI });
  return source;
}

function sourceEntitlementsEligible(source: FinancialDataProvenance, provider: FundamentalsProvider, securityId: string, context: ResearchEvidenceAssemblyOptions["requestContext"], providerEnvironment: ResearchSourceInput["dataEnvironment"]): boolean {
  if (source.dataEnvironment !== providerEnvironment) return false;
  const evaluation = evaluateResearchSourceEntitlement({
    providerId: source.providerId, dataset: source.dataset, market: source.market, securityId,
    sourceRecordId: source.sourceRecordId, dataEnvironment: source.dataEnvironment,
    expectedContract: provider.getResearchEntitlementContract?.() ?? null,
    records: source.technicalEntitlements ?? []
  }, context);
  return evaluation.eligibleForAI;
}

function providerEnvironmentMatches(environment: ResearchSourceInput["dataEnvironment"], entitlements: FinancialDataProvenance["entitlements"]): boolean {
  return entitlements.length > 0 && entitlements.every((entitlement) => entitlement.dataEnvironment === environment);
}

function isSourceEligible(source: ResearchSourceProvenance): boolean {
  const evaluation = assessmentForSource.get(source);
  return Boolean(evaluation?.eligibleForAI && evaluation.assessment.decisions.retrieval.allowed && evaluation.assessment.decisions["ai-processing"].allowed);
}

function sourceOperationAllowed(source: ResearchSourceProvenance, operation: DataOperation): boolean {
  return assessmentForSource.get(source)?.assessment.decisions[operation]?.allowed === true;
}

function permissionIds(sources: readonly ResearchSourceProvenance[]): string[] {
  return [...new Set(sources.map((source) => assessmentForSource.get(source)?.assessment.assessmentId).filter((id): id is string => Boolean(id)))];
}

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

function newsSource(article: NewsArticle, market: string, retrievedAt: string, technicalEntitlements?: ResearchSourceInput["technicalEntitlements"]): ResearchSourceInput {
  const synthetic = article.contentKind === "demo";
  return { providerId: synthetic ? "aynox-synthetic-news" : (technicalEntitlements?.[0]?.providerId ?? "unknown-news-provider"),
    providerName: article.sourceName, dataset: synthetic ? "synthetic-company-news" : (technicalEntitlements?.[0]?.dataset ?? "unknown-news-dataset"),
    market, sourceRecordId: article.id, sourceAsOf: article.publishedAt, retrievedAt,
    dataEnvironment: synthetic ? "synthetic" : (technicalEntitlements?.[0]?.environment ?? "development-restricted"), entitlements: [],
    technicalEntitlements, expectedContract: synthetic ? { contractId: "aynox-synthetic-news-fixture", contractVersion: "1" } : undefined };
}

function uniqueNewsSources(articles: NewsArticle[], market: string, options: ResearchEvidenceAssemblyOptions, retrievedAt: string): ResearchSourceInput[] {
  const unique = new Map<string, ResearchSourceInput>();
  for (const article of articles) {
    const source = newsSource(article, market, retrievedAt, options.newsEntitlementRecords?.[article.id]);
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
  const snapshot = deepFreeze(structuredClone(makeSnapshot(input)));
  trustedResearchEvidenceSnapshots.add(snapshot as object);
  return snapshot;
}

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value as DeepReadonly<T>;
}
