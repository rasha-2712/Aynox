import { describe, expect, it } from "vitest";
import { demoSecurities } from "@/lib/data/demo-data";
import { createSyntheticDemoEntitlement } from "@/lib/financial/permissions";
import { generateCompanyNewsReport } from "@/lib/news/report";
import { MockFundamentalsProvider } from "@/lib/providers/mock-fundamentals-provider";
import { getNewsArticles } from "@/lib/news/service";
import { assembleResearchEvidence, excludeEvidenceIdCollisions } from "@/lib/research/evidence";
import type { CompanyProfileRecord, FinancialStatementBundle, FundamentalsProvider, ProviderResult } from "@/types/financial";
import type { NewsArticle } from "@/types/news";

const collectedAt = "2026-11-26T12:00:00.000Z";
const consumer = { environment: "synthetic" as const, audience: "demo-only" as const };
const nvda = demoSecurities.find((item) => item.symbol === "NVDA")!;

describe("research evidence assembly", () => {
  it("assembles permitted synthetic fundamentals, calculated metrics and source-linked news", async () => {
    const articles = await getNewsArticles();
    const snapshot = await assembleResearchEvidence(nvda.id, { consumer, assembledAt: collectedAt, newsArticles: articles, newsCoverageStatus: "complete" }, { fundamentalsProvider: completeProvider() });
    expect(Object.isFrozen(articles[0])).toBe(false);
    expect(snapshot.securityMapping.status).toBe("resolved");
    expect(snapshot.completeness).toBe("complete");
    expect(snapshot.freshness).toBe("unknown");
    const ids = snapshot.evidence.map((item) => item.evidenceId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(snapshot.evidence.every((item) => item.subjectSecurityId === nvda.id && item.aiProcessingEligible)).toBe(true);
    expect(snapshot.evidence.every((item) => item.collectedAt === collectedAt)).toBe(true);
    expect(snapshot.evidence.filter((item) => item.kind === "financial-observation").every((item) => item.sources[0].sourceKind === "synthetic")).toBe(true);
    const financial = snapshot.evidence.find((item) => item.kind === "financial-observation");
    if (financial) {
      expect(financial.sources[0].permissions.retrieval.allowed).toBe(true);
      expect(financial.sources[0].permissions["ai-processing"].allowed).toBe(true);
      expect(financial.sources[0].permissions.redistribution.allowed).toBe(false);
    }
    const metric = snapshot.evidence.find((item) => item.kind === "calculated-metric");
    expect(metric?.kind).toBe("calculated-metric");
    if (metric?.kind === "calculated-metric") {
      expect(metric.formulaVersion).toBe("v1");
      expect(metric.inputEvidenceIds.length).toBe(metric.calculation.inputObservationIds.length);
    }
    const news = snapshot.evidence.find((item) => item.kind === "company-news-article");
    expect(news?.evidenceId).toMatch(/^news:/);
    if (news?.kind === "company-news-article") {
      expect(news.sentiment).toEqual(news.article.sentiment);
      expect(news.sourceAsOf).toBe(news.article.publishedAt);
      expect(news.sources[0].retrievedAt).toBe(collectedAt);
    }
    expect(snapshot.evidence.some((item) => item.kind === "company-news-summary")).toBe(true);
    expect(snapshot.evidence.some((item) => item.kind === "esg-observation")).toBe(false);
    expect(snapshot.limitations.some((item) => item.code === "esg-not-verified")).toBe(true);
  });

  it("preserves partial and insufficient-evidence states independently from freshness", async () => {
    const articles = await getNewsArticles();
    const partial = await assembleResearchEvidence("US:XNAS:MSFT", { consumer, assembledAt: collectedAt, newsArticles: articles, newsCoverageStatus: "complete" }, { fundamentalsProvider: new MockFundamentalsProvider() });
    expect(partial.sections.financialStatements).toBe("partial");
    expect(partial.completeness).toBe("partial");
    expect(partial.freshness).toBe("unknown");

    const partialCurrent = await assembleResearchEvidence("US:XNAS:MSFT", {
      consumer, assembledAt: collectedAt, newsArticles: articles, newsCoverageStatus: "complete", freshnessEvaluator: () => "current"
    }, { fundamentalsProvider: new MockFundamentalsProvider() });
    expect(partialCurrent.completeness).toBe("partial");
    expect(partialCurrent.freshness).toBe("current");

    const completeStale = await assembleResearchEvidence(nvda.id, {
      consumer, assembledAt: collectedAt, newsArticles: articles, newsCoverageStatus: "complete", freshnessEvaluator: () => "stale"
    }, { fundamentalsProvider: completeProvider() });
    expect(completeStale.completeness).toBe("complete");
    expect(completeStale.freshness).toBe("stale");

    const none = unavailableProvider();
    const newsOnly = await assembleResearchEvidence(nvda.id, { consumer, assembledAt: collectedAt, newsArticles: articles }, { fundamentalsProvider: none });
    expect(newsOnly.completeness).toBe("insufficient-evidence");
    expect(newsOnly.evidence.some((item) => item.kind === "financial-observation")).toBe(false);
    expect(newsOnly.evidence.some((item) => item.kind === "calculated-metric")).toBe(false);

    const stale = await assembleResearchEvidence(nvda.id, { consumer, assembledAt: collectedAt, newsArticles: articles, freshnessEvaluator: () => "stale" }, { fundamentalsProvider: new MockFundamentalsProvider() });
    expect(stale.completeness).toBe("partial");
    expect(stale.freshness).toBe("stale");

    let evaluations = 0;
    const mixed = await assembleResearchEvidence(nvda.id, {
      consumer, assembledAt: collectedAt, newsArticles: articles,
      freshnessEvaluator: () => evaluations++ === 0 ? "unknown" : "current"
    }, { fundamentalsProvider: new MockFundamentalsProvider() });
    expect(mixed.freshness).toBe("mixed");
    expect(mixed.completeness).toBe("partial");
    expect(mixed.evidence.some((item) => item.freshness === "unknown")).toBe(true);
    expect(mixed.evidence.some((item) => item.freshness === "current")).toBe(true);
  });

  it("checks profile identity against the requested canonical security", async () => {
    const articles = await getNewsArticles();
    const cases: Array<(profile: CompanyProfileRecord) => CompanyProfileRecord> = [
      (profile) => ({ ...profile, securityId: "US:XNAS:MSFT" }),
      (profile) => ({ ...profile, canonicalSymbol: "MSFT" }),
      (profile) => ({ ...profile, exchange: "NYSE" })
    ];
    for (const transform of cases) {
      const snapshot = await assembleResearchEvidence(nvda.id, { consumer, assembledAt: collectedAt, newsArticles: articles }, { fundamentalsProvider: providerWithProfile(transform) });
      expect(snapshot.evidence.some((item) => item.kind === "company-profile")).toBe(false);
      expect(snapshot.limitations.some((item) => item.code === "profile-identity-mismatch")).toBe(true);
      expect(snapshot.limitations.find((item) => item.code === "profile-identity-mismatch")?.message).toContain("canonical security");
    }
    const matched = await assembleResearchEvidence(nvda.id, { consumer, assembledAt: collectedAt, newsArticles: articles }, { fundamentalsProvider: new MockFundamentalsProvider() });
    expect(matched.evidence.some((item) => item.kind === "company-profile")).toBe(true);
  });

  it("excludes duplicate IDs from profile, financial, news and ESG evidence", async () => {
    const articles = await getNewsArticles();
    const duplicateNews = articles.find((item) => item.securityId === nvda.id)!;
    const newsSnapshot = await assembleResearchEvidence(nvda.id, { consumer, assembledAt: collectedAt, newsArticles: [duplicateNews, structuredClone(duplicateNews)] }, { fundamentalsProvider: new MockFundamentalsProvider() });
    expect(newsSnapshot.evidence.some((item) => item.kind === "company-news-article")).toBe(false);
    expect(newsSnapshot.limitations.some((item) => item.code === "duplicate-news-article-id")).toBe(true);

    let duplicateProfileField = "";
    const profileSnapshot = await assembleResearchEvidence(nvda.id, { consumer, assembledAt: collectedAt, newsArticles: [] }, { fundamentalsProvider: providerWithProfile((profile) => {
      duplicateProfileField = profile.facts[0].providerField;
      return { ...profile, facts: [...profile.facts, structuredClone(profile.facts[0])] };
    }) });
    expect(profileSnapshot.evidence.some((item) => item.kind === "company-profile" && item.providerField === duplicateProfileField)).toBe(false);
    expect(profileSnapshot.limitations.some((item) => item.code === "duplicate-profile-field-id")).toBe(true);

    const financialSnapshot = await assembleResearchEvidence(nvda.id, { consumer, assembledAt: collectedAt, newsArticles: [] }, { fundamentalsProvider: providerWithStatements((bundle) => {
      const first = bundle.incomeStatement.observations[0];
      return { ...bundle, incomeStatement: { ...bundle.incomeStatement, observations: [...bundle.incomeStatement.observations, structuredClone(first)] } };
    }) });
    expect(financialSnapshot.evidence.filter((item) => item.kind === "financial-observation").some((item) => item.kind === "financial-observation" && item.observation.id === "NVDA-revenue-current")).toBe(false);
    expect(financialSnapshot.limitations.some((item) => item.code === "duplicate-financial-observation-id")).toBe(true);

    const entitlement = developmentEntitlement("test-esg", "test-esg-dataset", nvda.exchange);
    const candidate = { id: "same-esg", securityId: nvda.id, isIllustrative: false, score: "72", label: "B", source: researchSource(entitlement), sourceAsOf: collectedAt, methodology: "Verified method", sourceVerificationStatus: "verified" as const, methodologyVerificationStatus: "verified" as const };
    const esgSnapshot = await assembleResearchEvidence(nvda.id, { consumer: { environment: "development-restricted", audience: "internal" }, assembledAt: collectedAt, newsArticles: [], esgCandidates: [candidate, structuredClone(candidate)] }, { fundamentalsProvider: new MockFundamentalsProvider() });
    expect(esgSnapshot.evidence.some((item) => item.kind === "esg-observation")).toBe(false);
    expect(esgSnapshot.limitations.some((item) => item.code === "duplicate-esg-candidate-id")).toBe(true);
  });

  it("rejects missing, blank and non-string news identifiers before evidence assembly", async () => {
    const sourceArticle = (await getNewsArticles()).find((item) => item.securityId === nvda.id)!;
    const empty = { ...structuredClone(sourceArticle), id: "" } as NewsArticle;
    const whitespace = { ...structuredClone(sourceArticle), id: " \t " } as NewsArticle;
    const missing = structuredClone(sourceArticle) as unknown as Record<string, unknown>;
    delete missing.id;
    const numeric = { ...structuredClone(sourceArticle), id: 29 } as unknown as NewsArticle;
    for (const malformed of [empty, whitespace, missing as unknown as NewsArticle, numeric]) {
      const snapshot = await assembleResearchEvidence(nvda.id, { consumer, assembledAt: collectedAt, newsArticles: [malformed] }, { fundamentalsProvider: new MockFundamentalsProvider() });
      expect(snapshot.evidence.some((item) => item.kind === "company-news-article" || item.kind === "company-news-summary" || item.evidenceId.startsWith("news:"))).toBe(false);
      expect(snapshot.limitations.some((item) => item.code === "news-article-id-invalid")).toBe(true);
    }
    const valid = await assembleResearchEvidence(nvda.id, { consumer, assembledAt: collectedAt, newsArticles: [sourceArticle] }, { fundamentalsProvider: new MockFundamentalsProvider() });
    expect(valid.evidence.some((item) => item.kind === "company-news-article" && item.evidenceId === `news:${sourceArticle.id}`)).toBe(true);
  });

  it("filters final assembled evidence-ID collisions and preserves shared financial inputs", async () => {
    const articles = await getNewsArticles();
    const snapshot = await assembleResearchEvidence(nvda.id, { consumer, assembledAt: collectedAt, newsArticles: articles }, { fundamentalsProvider: new MockFundamentalsProvider() });
    const profile = snapshot.evidence.find((item) => item.kind === "company-profile");
    const news = snapshot.evidence.find((item) => item.kind === "company-news-article");
    expect(profile?.kind).toBe("company-profile");
    expect(news?.kind).toBe("company-news-article");
    if (profile?.kind === "company-profile" && news?.kind === "company-news-article") {
      const collision = { ...structuredClone(profile), evidenceId: "forced-final-collision" } as unknown as import("@/types/research").ResearchEvidenceItem;
      const otherCollision = { ...structuredClone(news), evidenceId: "forced-final-collision" } as unknown as import("@/types/research").ResearchEvidenceItem;
      const limitations: import("@/types/research").ResearchEvidenceSnapshot["limitations"] = [];
      expect(excludeEvidenceIdCollisions([collision, otherCollision], limitations, nvda.id)).toEqual([]);
      expect(limitations).toContainEqual(expect.objectContaining({ code: "duplicate-evidence-id", sourceId: "forced-final-collision" }));
    }

    const sharedInputSnapshot = await assembleResearchEvidence(nvda.id, { consumer, assembledAt: collectedAt, newsArticles: [] }, { fundamentalsProvider: providerWithStatements((bundle) => {
      const revenue = bundle.incomeStatement.observations.find((item) => item.id === "NVDA-rev-ytd-q2")!;
      const grossProfit = { ...structuredClone(revenue), id: "NVDA-gross-profit-ytd-q2", metricKey: "gross-profit", providerMetricName: "Gross Profit", value: "900000" as typeof revenue.value };
      const operatingIncome = { ...structuredClone(revenue), id: "NVDA-operating-income-ytd-q2", metricKey: "operating-income", providerMetricName: "Operating Income", value: "700000" as typeof revenue.value };
      return { ...bundle, incomeStatement: { ...bundle.incomeStatement, observations: [...bundle.incomeStatement.observations, grossProfit, operatingIncome] } };
    }) });
    const grossMargin = sharedInputSnapshot.evidence.find((item) => item.kind === "calculated-metric" && item.formulaIdentifier === "gross-margin");
    const operatingMargin = sharedInputSnapshot.evidence.find((item) => item.kind === "calculated-metric" && item.formulaIdentifier === "operating-margin");
    expect(grossMargin?.kind).toBe("calculated-metric");
    expect(operatingMargin?.kind).toBe("calculated-metric");
    if (grossMargin?.kind === "calculated-metric" && operatingMargin?.kind === "calculated-metric") {
      const sharedRevenueEvidenceId = `financial:${grossMargin.sources[0].providerId}:NVDA-rev-ytd-q2`;
      expect(grossMargin.inputEvidenceIds).toContain(sharedRevenueEvidenceId);
      expect(operatingMargin.inputEvidenceIds).toContain(sharedRevenueEvidenceId);
      expect(sharedInputSnapshot.evidence.filter((item) => item.kind === "financial-observation" && item.evidenceId === sharedRevenueEvidenceId)).toHaveLength(1);
    }
  });

  it("requires retrieval and AI processing for article evidence and derivation for summaries independently", async () => {
    const sourceArticle = (await getNewsArticles()).find((item) => item.securityId === nvda.id)!;
    const article: NewsArticle = { ...structuredClone(sourceArticle), id: "licensed-permission-check", contentKind: "licensed" };
    const operations = ["retrieval", "storage", "display", "derivation", "ai-processing", "retention", "redistribution"] as const;
    for (const operation of operations) {
      const entitlement = developmentEntitlement(`rights-${operation}`, "rights-news", nvda.exchange);
      entitlement.permissions[operation] = { state: "denied" };
      const snapshot = await assembleResearchEvidence(nvda.id, {
        consumer: { environment: "development-restricted", audience: "internal" }, assembledAt: collectedAt,
        newsArticles: [article], newsEntitlements: { [article.id]: [entitlement] }
      }, { fundamentalsProvider: new MockFundamentalsProvider() });
      const articleEvidence = snapshot.evidence.find((item) => item.kind === "company-news-article");
      const summary = snapshot.evidence.find((item) => item.kind === "company-news-summary");
      if (operation === "retrieval" || operation === "ai-processing") {
        expect(articleEvidence).toBeUndefined();
        expect(summary).toBeUndefined();
      } else if (operation === "derivation") {
        expect(articleEvidence).toBeDefined();
        expect(summary).toBeUndefined();
        expect(snapshot.limitations.some((item) => item.code === "news-summary-derivation-permission-denied")).toBe(true);
      } else {
        expect(articleEvidence).toBeDefined();
        expect(summary).toBeDefined();
        if (articleEvidence?.kind === "company-news-article") {
          expect(articleEvidence.sources[0].permissions[operation].allowed).toBe(false);
          for (const otherOperation of operations.filter((item) => item !== operation)) {
            expect(articleEvidence.sources[0].permissions[otherOperation].allowed).toBe(true);
          }
        }
      }
    }
  });

  it("fails closed when source and provider environments disagree with entitlements", async () => {
    for (const mismatchKind of ["provider", "provenance", "entitlement"] as const) {
      const mismatch = await assembleResearchEvidence(nvda.id, { consumer, assembledAt: collectedAt, newsArticles: [] }, { fundamentalsProvider: providerWithEnvironmentMismatch(mismatchKind) });
      expect(mismatch.evidence.some((item) => item.kind === "company-profile" || item.kind === "financial-observation")).toBe(false);
      expect(mismatch.sections.profile).toBe("unavailable");
      expect(mismatch.sections.financialStatements).toBe("unavailable");
      expect(mismatch.limitations.some((item) => item.code === "source-environment-mismatch")).toBe(true);
    }
  });

  it("excludes synthetic ESG candidates even when marked verified", async () => {
    const entitlement = createSyntheticDemoEntitlement({ providerId: "demo-esg", dataset: "synthetic-esg", market: nvda.exchange });
    const candidate = { id: "demo-esg-nvda", securityId: nvda.id, isIllustrative: true, score: "88", label: "A", source: researchSource(entitlement), sourceAsOf: collectedAt, methodology: "Claimed verified method", sourceVerificationStatus: "verified" as const, methodologyVerificationStatus: "verified" as const };
    const snapshot = await assembleResearchEvidence(nvda.id, { consumer, assembledAt: collectedAt, newsArticles: [], esgCandidates: [candidate] }, { fundamentalsProvider: new MockFundamentalsProvider() });
    expect(snapshot.evidence.some((item) => item.kind === "esg-observation")).toBe(false);
    expect(snapshot.limitations.some((item) => item.code === "esg-synthetic-excluded")).toBe(true);

    const developmentGrant = developmentEntitlement("verified-esg", "verified-esg-dataset", nvda.exchange);
    const verifiedCandidate = { ...candidate, id: "verified-esg-nvda", isIllustrative: false, source: researchSource(developmentGrant), sourceVerificationStatus: "verified" as const, methodologyVerificationStatus: "verified" as const };
    const verified = await assembleResearchEvidence(nvda.id, { consumer: { environment: "development-restricted", audience: "internal" }, assembledAt: collectedAt, newsArticles: [], esgCandidates: [verifiedCandidate] }, { fundamentalsProvider: new MockFundamentalsProvider() });
    expect(verified.evidence.some((item) => item.kind === "esg-observation")).toBe(true);
    for (const status of ["sourceVerificationStatus", "methodologyVerificationStatus"] as const) {
      const unverified = { ...verifiedCandidate, [status]: "unverified" as const };
      const excluded = await assembleResearchEvidence(nvda.id, { consumer: { environment: "development-restricted", audience: "internal" }, assembledAt: collectedAt, newsArticles: [], esgCandidates: [unverified] }, { fundamentalsProvider: new MockFundamentalsProvider() });
      expect(excluded.evidence.some((item) => item.kind === "esg-observation")).toBe(false);
    }
  });

  it("rejects malformed injected sentiment and preserves valid illustrative decimals", async () => {
    const sourceArticle = (await getNewsArticles()).find((item) => item.securityId === nvda.id)!;
    const invalidCases = [
      -0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY, undefined
    ];
    for (const confidence of invalidCases) {
      const article = structuredClone(sourceArticle);
      article.id = `bad-confidence-${String(confidence)}`;
      (article.sentiment as { heuristicConfidence: number }).heuristicConfidence = confidence as number;
      const snapshot = await assembleResearchEvidence(nvda.id, { consumer, assembledAt: collectedAt, newsArticles: [article] }, { fundamentalsProvider: new MockFundamentalsProvider() });
      expect(snapshot.evidence.some((item) => item.kind === "company-news-article")).toBe(false);
      expect(snapshot.limitations.some((item) => item.code === "news-sentiment-invalid")).toBe(true);
    }
    const invalidLabel = { ...structuredClone(sourceArticle), sentiment: { ...sourceArticle.sentiment, label: "Bullish" } } as unknown as NewsArticle;
    const invalidCalibration = { ...structuredClone(sourceArticle), sentiment: { ...sourceArticle.sentiment, calibrated: true } } as unknown as NewsArticle;
    const invalidExplanation = { ...structuredClone(sourceArticle), sentiment: { ...sourceArticle.sentiment, explanation: "   " } } as unknown as NewsArticle;
    const invalidMissingExplanation = { ...structuredClone(sourceArticle), sentiment: { ...sourceArticle.sentiment, explanation: undefined } } as unknown as NewsArticle;
    const invalidStatusLabel = { ...structuredClone(sourceArticle), sentiment: { ...sourceArticle.sentiment, status: "ambiguous", label: "Positive" } } as unknown as NewsArticle;
    for (const article of [invalidLabel, invalidCalibration, invalidExplanation, invalidMissingExplanation, invalidStatusLabel]) {
      const snapshot = await assembleResearchEvidence(nvda.id, { consumer, assembledAt: collectedAt, newsArticles: [article] }, { fundamentalsProvider: new MockFundamentalsProvider() });
      expect(snapshot.evidence.some((item) => item.kind === "company-news-article")).toBe(false);
    }
    for (const confidence of [0, 1]) {
      const boundaryArticle = structuredClone(sourceArticle);
      boundaryArticle.id = `valid-confidence-${confidence}`;
      boundaryArticle.sentiment.heuristicConfidence = confidence;
      const valid = await assembleResearchEvidence(nvda.id, { consumer, assembledAt: collectedAt, newsArticles: [boundaryArticle] }, { fundamentalsProvider: new MockFundamentalsProvider() });
      const evidence = valid.evidence.find((item) => item.kind === "company-news-article");
      expect(evidence?.kind).toBe("company-news-article");
      if (evidence?.kind === "company-news-article") {
        expect(evidence.sentiment.heuristicConfidence).toBeGreaterThanOrEqual(0);
        expect(evidence.sentiment.heuristicConfidence).toBeLessThanOrEqual(1);
        expect(evidence.sentiment.calibrated).toBe(false);
      }
    }
  });

  it("uses source-aware wording in company reports", async () => {
    const sourceArticle = (await getNewsArticles()).find((item) => item.securityId === nvda.id)!;
    const demoReport = generateCompanyNewsReport(nvda, [sourceArticle, { ...sourceArticle, id: `${sourceArticle.id}-2` }]);
    const licensed = { ...sourceArticle, contentKind: "licensed" as const };
    const licensedReport = generateCompanyNewsReport(nvda, [licensed, { ...licensed, id: `${licensed.id}-2` }]);
    expect(demoReport.executiveSummary).toContain("synthetic demonstration feed");
    expect(demoReport.risksAndUncertainties[0]).toContain("synthetic interface demonstrations");
    expect(licensedReport.executiveSummary).toContain("licensed news sources");
    expect(licensedReport.executiveSummary).not.toContain("synthetic");
    expect(licensedReport.risksAndUncertainties[0]).not.toContain("synthetic");
    const mixedReport = generateCompanyNewsReport(nvda, [sourceArticle, { ...sourceArticle, id: `${sourceArticle.id}-licensed`, contentKind: "licensed" }]);
    expect(mixedReport.executiveSummary).toContain("mixed synthetic and licensed");
    expect(mixedReport.risksAndUncertainties[0]).toContain("consult each article's source attribution");
  });

  it("excludes news with missing or denied AI permissions and unverified ESG evidence", async () => {
    const article = (await getNewsArticles()).find((item) => item.securityId === nvda.id)!;
    const licensed: NewsArticle = { ...article, id: "licensed-without-entitlement", contentKind: "licensed" };
    const entitlement = createSyntheticDemoEntitlement({ providerId: "licensed-test-provider", dataset: "licensed-test-news", market: nvda.exchange });
    entitlement.permissions["ai-processing"] = { state: "denied" };
    const denied: NewsArticle = { ...article, id: "licensed-denied-ai", contentKind: "licensed" };
    const snapshot = await assembleResearchEvidence(nvda.id, {
      consumer, assembledAt: collectedAt, newsArticles: [licensed, denied],
      newsEntitlements: { [denied.id]: [entitlement] }
    }, { fundamentalsProvider: new MockFundamentalsProvider() });
    expect(snapshot.evidence.filter((item) => item.kind === "company-news-article")).toHaveLength(0);
    expect(snapshot.limitations.some((item) => item.code === "news-permission-denied-or-unverified")).toBe(true);
    expect(snapshot.evidence.some((item) => item.kind === "esg-observation")).toBe(false);
  });

  it("does not promote synthetic demo rights into production or convert missing values to zero", async () => {
    const articles = await getNewsArticles();
    const production = await assembleResearchEvidence(nvda.id, {
      consumer: { environment: "production-licensed", audience: "public" }, assembledAt: collectedAt, newsArticles: articles
    }, { fundamentalsProvider: new MockFundamentalsProvider() });
    expect(production.evidence).toHaveLength(0);
    expect(production.completeness).toBe("unavailable");

    const aapl = demoSecurities.find((item) => item.symbol === "AAPL")!;
    const snapshot = await assembleResearchEvidence(aapl.id, {
      consumer, assembledAt: collectedAt, newsArticles: await getNewsArticles()
    }, { fundamentalsProvider: new MockFundamentalsProvider() });
    const financialItems = snapshot.evidence.filter((item) => item.kind === "financial-observation");
    expect(financialItems.some((item) => item.kind === "financial-observation" && item.observation.id === "AAPL-revenue-missing")).toBe(false);
    expect(financialItems.some((item) => item.kind === "financial-observation" && item.observation.id === "AAPL-other-income-zero" && String(item.observation.value) === "0")).toBe(true);
  });

  it("fails closed on unsupported or ambiguous mappings", async () => {
    const unsupported = await assembleResearchEvidence("UNKNOWN:SECURITY", { consumer, assembledAt: collectedAt });
    expect(unsupported).toMatchObject({ completeness: "unavailable", securityMapping: { status: "unsupported" }, evidence: [] });
    const base = new MockFundamentalsProvider();
    const ambiguous: FundamentalsProvider = {
      providerId: base.providerId, providerName: base.providerName, isDemo: true,
      resolveSecurity: () => ({ status: "ambiguous", candidates: [], reason: "ambiguous fixture" }),
      getCompanyProfile: (identity) => base.getCompanyProfile(identity),
      getFinancialStatements: (identity) => base.getFinancialStatements(identity)
    };
    const result = await assembleResearchEvidence(nvda.id, { consumer, assembledAt: collectedAt }, { fundamentalsProvider: ambiguous });
    expect(result).toMatchObject({ completeness: "unavailable", securityMapping: { status: "ambiguous" }, evidence: [] });
  });

  it("deep-freezes snapshots and creates a distinct snapshot ID on regeneration", async () => {
    const inputArticle = structuredClone((await getNewsArticles()).find((item) => item.securityId === nvda.id)!);
    const options = { consumer, assembledAt: collectedAt, newsArticles: [inputArticle] };
    const first = await assembleResearchEvidence(nvda.id, options, { fundamentalsProvider: new MockFundamentalsProvider() });
    const second = await assembleResearchEvidence(nvda.id, options, { fundamentalsProvider: new MockFundamentalsProvider() });
    expect(first.snapshotId).not.toBe(second.snapshotId);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.evidence)).toBe(true);
    expect(() => (first.evidence as unknown as unknown[]).push({})).toThrow(TypeError);
    const articleEvidence = first.evidence.find((item) => item.kind === "company-news-article");
    expect(articleEvidence?.kind).toBe("company-news-article");
    if (articleEvidence?.kind === "company-news-article") {
      const originalHeadline = articleEvidence.article.headline;
      const originalTerm = articleEvidence.article.sentiment.matchedPositiveTerms[0];
      inputArticle.headline = "mutated after assembly";
      inputArticle.sentiment.matchedPositiveTerms.push("mutated");
      expect(articleEvidence.article.headline).toBe(originalHeadline);
      expect(articleEvidence.article.sentiment.matchedPositiveTerms[0]).toBe(originalTerm);
      expect(Object.isFrozen(articleEvidence.article.sentiment.matchedPositiveTerms)).toBe(true);
      expect(() => (articleEvidence.article.sentiment.matchedPositiveTerms as unknown as string[]).push("blocked")).toThrow(TypeError);
    }
    expect(first.assembledAt).toBe(collectedAt);
  });

  it("excludes a news summary when derivation permission is unverified", async () => {
    const sourceArticle = (await getNewsArticles()).find((item) => item.securityId === nvda.id)!;
    const article: NewsArticle = { ...sourceArticle, id: "unverified-derivation-news", contentKind: "licensed" };
    const entitlement = developmentEntitlement("unverified-derivation-provider", "unverified-derivation-dataset", nvda.exchange);
    entitlement.permissions.derivation = { state: "unverified" };
    const snapshot = await assembleResearchEvidence(nvda.id, {
      consumer: { environment: "development-restricted", audience: "internal" }, assembledAt: collectedAt,
      newsArticles: [article], newsEntitlements: { [article.id]: [entitlement] }
    }, { fundamentalsProvider: new MockFundamentalsProvider() });
    expect(snapshot.evidence.some((item) => item.kind === "company-news-article")).toBe(true);
    expect(snapshot.evidence.some((item) => item.kind === "company-news-summary")).toBe(false);
    expect(snapshot.limitations.some((item) => item.code === "news-summary-derivation-permission-denied")).toBe(true);
  });
});

function unavailableProvider(): FundamentalsProvider {
  const base = new MockFundamentalsProvider();
  const unavailable = <T>(): ProviderResult<T> => ({ status: "unavailable", provider: { id: base.providerId, name: base.providerName, isDemo: true }, coverage: { status: "unsupported", supportedFields: [], missingFields: ["fundamentals"] }, retrievedAt: collectedAt, dataEnvironment: "synthetic", entitlements: [], data: null });
  return { providerId: base.providerId, providerName: base.providerName, isDemo: true, resolveSecurity: (identity) => base.resolveSecurity(identity), getCompanyProfile: async () => unavailable(), getFinancialStatements: async () => unavailable() };
}

function completeProvider(): FundamentalsProvider {
  const base = new MockFundamentalsProvider();
  const cleanSection = <T extends { observations: Array<{ value: string | null }> }>(section: T): T => ({ ...section, observations: section.observations.filter((item) => item.value !== null) } as T);
  return {
    providerId: base.providerId, providerName: base.providerName, isDemo: true,
    resolveSecurity: (identity) => base.resolveSecurity(identity),
    getCompanyProfile: (identity) => base.getCompanyProfile(identity),
    getFinancialStatements: async (identity) => {
      const result = await base.getFinancialStatements(identity);
      if (!result.data) return result;
      return { ...result, data: { ...result.data, incomeStatement: cleanSection(result.data.incomeStatement), balanceSheet: cleanSection(result.data.balanceSheet), cashFlow: cleanSection(result.data.cashFlow) } };
    }
  };
}

function providerWithProfile(transform: (profile: CompanyProfileRecord) => CompanyProfileRecord): FundamentalsProvider {
  const base = new MockFundamentalsProvider();
  return {
    providerId: base.providerId, providerName: base.providerName, isDemo: true,
    resolveSecurity: (identity) => base.resolveSecurity(identity),
    getCompanyProfile: async (identity) => {
      const result = await base.getCompanyProfile(identity);
      return result.data ? { ...result, data: transform(structuredClone(result.data)) } : result;
    },
    getFinancialStatements: (identity) => base.getFinancialStatements(identity)
  };
}

function providerWithStatements(transform: (bundle: FinancialStatementBundle) => FinancialStatementBundle): FundamentalsProvider {
  const base = new MockFundamentalsProvider();
  return {
    providerId: base.providerId, providerName: base.providerName, isDemo: true,
    resolveSecurity: (identity) => base.resolveSecurity(identity),
    getCompanyProfile: (identity) => base.getCompanyProfile(identity),
    getFinancialStatements: async (identity) => {
      const result = await base.getFinancialStatements(identity);
      return result.data ? { ...result, data: transform(structuredClone(result.data)) } : result;
    }
  };
}

function providerWithEnvironmentMismatch(mismatchKind: "provider" | "provenance" | "entitlement"): FundamentalsProvider {
  const base = new MockFundamentalsProvider();
  const providerEnvironment: "synthetic" | "development-restricted" = mismatchKind === "provider" ? "development-restricted" : "synthetic";
  const provenanceEnvironment: "synthetic" | "development-restricted" = mismatchKind === "provenance" ? "development-restricted" : "synthetic";
  const entitlementEnvironment: "synthetic" | "development-restricted" = mismatchKind === "entitlement" ? "development-restricted" : "synthetic";
  const alterEntitlement = (entitlement: import("@/types/financial").DataEntitlement) => ({
    ...entitlement, dataEnvironment: entitlementEnvironment,
    authorizedEnvironments: [entitlementEnvironment],
    permittedAudience: entitlementEnvironment === "synthetic" ? "demo-only" as const : "internal" as const
  });
  return {
    providerId: base.providerId, providerName: base.providerName, isDemo: true,
    resolveSecurity: (identity) => base.resolveSecurity(identity),
    getCompanyProfile: async (identity) => {
      const result = await base.getCompanyProfile(identity);
      return result.data ? { ...result, dataEnvironment: providerEnvironment,
        entitlements: result.entitlements.map(alterEntitlement),
        data: { ...result.data, source: { ...result.data.source, dataEnvironment: provenanceEnvironment, entitlements: result.data.source.entitlements.map(alterEntitlement) } } } : result;
    },
    getFinancialStatements: async (identity) => {
      const result = await base.getFinancialStatements(identity);
      if (!result.data) return result;
      const alter = <T extends { observations: Array<{ source: { dataEnvironment: "synthetic" | "development-restricted" | "production-licensed", entitlements: import("@/types/financial").DataEntitlement[] } }> }>(section: T): T => ({ ...section, observations: section.observations.map((observation) => ({ ...observation, source: { ...observation.source, dataEnvironment: provenanceEnvironment, entitlements: observation.source.entitlements.map(alterEntitlement) } })) });
      return { ...result, dataEnvironment: providerEnvironment, entitlements: result.entitlements.map(alterEntitlement), data: { ...result.data, incomeStatement: alter(result.data.incomeStatement), balanceSheet: alter(result.data.balanceSheet), cashFlow: alter(result.data.cashFlow) } };
    }
  };
}

function developmentEntitlement(providerId: string, dataset: string, market: string) {
  const entitlement = createSyntheticDemoEntitlement({ providerId, dataset, market });
  const operations = ["retrieval", "storage", "display", "derivation", "ai-processing", "retention", "redistribution"] as const;
  return { ...entitlement, contractRef: "development-fixture", dataEnvironment: "development-restricted" as const, authorizedEnvironments: ["development-restricted" as const], permittedAudience: "internal" as const, permissions: Object.fromEntries(operations.map((operation) => [operation, { state: "allowed" as const }])) as typeof entitlement.permissions };
}

function researchSource(entitlement: ReturnType<typeof developmentEntitlement> | ReturnType<typeof createSyntheticDemoEntitlement>) {
  return { providerId: entitlement.providerId, providerName: "Fixture", dataset: entitlement.dataset, market: entitlement.market, sourceRecordId: "source-1", sourceAsOf: collectedAt, retrievedAt: collectedAt, dataEnvironment: entitlement.dataEnvironment, entitlements: [entitlement] };
}
