import { describe, expect, it } from "vitest";
import { demoNewsArticles } from "@/lib/news/demo-news";
import { areDuplicateHeadlines, deduplicateNews, normalizeHeadline } from "@/lib/news/deduplicate";
import { aggregateTrackedCompanyNews, calculateSentimentDistribution, filterNewsArticles } from "@/lib/news/query";
import { generateCompanyNewsReport } from "@/lib/news/report";
import { analyzeNewsArticle, getNewsArticles } from "@/lib/news/service";
import { MockNewsProvider } from "@/lib/news/testing/mock-news-provider";
import { DemoLexiconSentimentClassifier } from "@/lib/news/sentiment";
import { demoSecurities } from "@/lib/data/demo-data";
import type { NewsArticle, NewsArticleInput } from "@/types/news";

const seed = demoNewsArticles[0];
function makeArticle(overrides: Partial<NewsArticleInput> = {}, analyzedOverrides: Partial<NewsArticle> = {}): NewsArticle {
  return { ...analyzeNewsArticle({ ...seed, ...overrides }), ...analyzedOverrides };
}

function atHours(hours: number) {
  return new Date(Date.parse(seed.publishedAt) + hours * 60 * 60 * 1000).toISOString();
}

describe("company news intelligence", () => {
  it("resolves every intended demo story by stable security ID regardless of display-name wording", async () => {
    const articles = await getNewsArticles();
    const expected = new Map<string, number>();
    for (const input of demoNewsArticles) expected.set(input.securityId, (expected.get(input.securityId) ?? 0) + 1);
    const actual = new Map<string, number>();
    for (const article of articles) actual.set(article.securityId, (actual.get(article.securityId) ?? 0) + article.duplicateCount);
    expect(actual).toEqual(expected);
    const tsm = demoSecurities.find((security) => security.symbol === "TSM")!;
    expect(articles.some((article) => article.securityId === tsm.id && article.companyName !== tsm.name)).toBe(true);
    expect(await getNewsArticles()).toEqual(articles);
  });

  it("rejects malformed IDs at news ingestion and direct analysis boundaries", async () => {
    const invalidIds: unknown[] = ["", " \t ", undefined, 17];
    for (const id of invalidIds) {
      expect(() => analyzeNewsArticle({ ...seed, id } as unknown as NewsArticleInput)).toThrow(TypeError);
    }
    const service = await import("@/lib/news/service");
    expect("setNewsProvider" in service).toBe(false);
    expect((await getNewsArticles()).every((article) => article.contentKind === "demo")).toBe(true);
  });

  it("rejects direct synthetic provider calls without a verified retrieval token", async () => {
    const provider = new MockNewsProvider();
    await expect(Reflect.apply(provider.listArticles, provider, [])).rejects.toThrow("Verified news retrieval authorization is required.");
    await expect(Reflect.apply(provider.listArticles, provider, [{
      providerId: "aynox-synthetic-news", dataset: "synthetic-company-news", market: "XNAS",
      securityId: demoSecurities[0].id, contractId: "aynox-synthetic-news-fixture",
      contractVersion: "1", retrievalScope: "dataset", requestId: "forged"
    }])).rejects.toThrow("Verified news retrieval authorization is required.");
  });

  it("filters by stable company, ticker, topic, inclusive date range, and headline/summary search", async () => {
    const all = await getNewsArticles();
    const nvda = filterNewsArticles(all, { companySecurityId: demoSecurities[0].id });
    expect(nvda.length).toBeGreaterThan(0);
    expect(nvda.every((article) => article.securityId === demoSecurities[0].id)).toBe(true);
    expect(filterNewsArticles(all, { companySymbol: "NVDA" }).every((article) => article.symbol === "NVDA")).toBe(true);
    expect(filterNewsArticles(all, { category: "Operations" }).every((article) => article.category === "Operations")).toBe(true);
    expect(filterNewsArticles(all, { dateFrom: "2026-11-23", dateTo: "2026-11-24" }).every((article) => article.publishedAt.slice(0, 10) >= "2026-11-23" && article.publishedAt.slice(0, 10) <= "2026-11-24")).toBe(true);
    expect(filterNewsArticles(all, { search: "capacity" }).length).toBeGreaterThan(0);
    expect(filterNewsArticles(all, { search: "nothing matches" })).toEqual([]);
  });

  it("orders newest first and relevance first when scores differ", () => {
    const oldHigh = makeArticle({ id: "old-high", publishedAt: "2026-11-20T00:00:00.000Z" }, { relevance: { score: 0.95, basis: "security-id-association", explanation: "test" } });
    const newLow = makeArticle({ id: "new-low", publishedAt: "2026-11-24T00:00:00.000Z" }, { relevance: { score: 0.3, basis: "security-id-association", explanation: "test" } });
    const middle = makeArticle({ id: "middle", publishedAt: "2026-11-22T00:00:00.000Z" }, { relevance: { score: 0.6, basis: "security-id-association", explanation: "test" } });
    expect(filterNewsArticles([oldHigh, newLow, middle], { sort: "newest" }).map((item) => item.id)).toEqual(["new-low", "middle", "old-high"]);
    expect(filterNewsArticles([oldHigh, newLow, middle], { sort: "relevance" }).map((item) => item.id)).toEqual(["old-high", "middle", "new-low"]);
  });

  it("only deduplicates same security, topic, normalized headline/summary, and within 72 hours", () => {
    expect(normalizeHeadline("DEMO: Capacity & Growth!")).toBe("capacity growth");
    const base = makeArticle();
    const exact = makeArticle({ id: "copy", headline: "DEMO: Data center buyers discuss orders for accelerator capacity expansion!", publishedAt: atHours(72) });
    expect(areDuplicateHeadlines(base, exact)).toBe(true);
    expect(areDuplicateHeadlines(base, makeArticle({ id: "below", publishedAt: atHours(71.999) }))).toBe(true);
    expect(areDuplicateHeadlines(base, makeArticle({ id: "above", publishedAt: atHours(72.001) }))).toBe(false);
    expect(areDuplicateHeadlines(base, makeArticle({ id: "other-topic", category: "Strategy" }))).toBe(false);
    expect(areDuplicateHeadlines(base, makeArticle({ id: "other-company", securityId: demoSecurities[1].id }))).toBe(false);
  });

  it("does not merge reordered actors, negation, changed outcomes, or transitive-only matches", () => {
    const base = makeArticle({ headline: "Supplier delays component shipments as company raises output forecast", summary: "The supplier causes shipment delays while the company raises its output forecast." });
    const reordered = makeArticle({ id: "reordered", headline: "Company delays component shipments as supplier raises output forecast", summary: "The supplier causes shipment delays while the company raises its output forecast." });
    const negated = makeArticle({ id: "negated", headline: "Supplier does not delay component shipments as company raises output forecast", summary: "The supplier does not cause shipment delays while the company raises its output forecast." });
    const changedOutcome = makeArticle({ id: "changed", headline: "Supplier delays component shipments as company lowers output forecast", summary: "The supplier causes shipment delays while the company lowers its output forecast." });
    expect(areDuplicateHeadlines(base, reordered)).toBe(false);
    expect(areDuplicateHeadlines(base, negated)).toBe(false);
    expect(areDuplicateHeadlines(base, changedOutcome)).toBe(false);

    const a = makeArticle({ id: "chain-a", headline: "DEMO SCENARIO: Customer demand capacity plan", summary: "A fictional demand capacity plan example." });
    const b = makeArticle({ id: "chain-b", headline: "DEMO SCENARIO: Customer demand capacity plan update", summary: "A fictional demand capacity plan example." });
    const c = makeArticle({ id: "chain-c", headline: "DEMO SCENARIO: Customer demand capacity plan update note", summary: "A fictional demand capacity plan example." });
    expect(areDuplicateHeadlines(b, c)).toBe(true);
    expect(areDuplicateHeadlines(a, c)).toBe(false);
    const grouped = deduplicateNews([a, b, c]);
    expect(grouped).toHaveLength(2);
    expect(grouped.find((item) => item.id === "chain-a")?.duplicateCount).toBe(2);
    expect(grouped.some((item) => item.id === "chain-c" && item.duplicateCount === 1)).toBe(true);
  });

  it("preserves duplicate IDs and counts on repeated deduplication", () => {
    const first = makeArticle({ id: "canonical", publishedAt: "2026-11-20T00:00:00.000Z" });
    const second = makeArticle({ id: "duplicate", publishedAt: "2026-11-21T00:00:00.000Z" });
    const once = deduplicateNews([first, second]);
    const twice = deduplicateNews(once);
    expect(once[0]).toMatchObject({ duplicateCount: 2, duplicateArticleIds: ["duplicate"] });
    expect(twice).toHaveLength(1);
    expect(twice[0]).toMatchObject({ id: "canonical", duplicateCount: 2, duplicateArticleIds: ["duplicate"] });
  });

  it("handles negation, mixed evidence, neutral text, boilerplate and insufficient content", () => {
    const classifier = new DemoLexiconSentimentClassifier();
    const baseText = { summary: "", body: "" };
    expect(classifier.classify({ ...baseText, headline: "No growth in sales." })).toMatchObject({ label: "Negative", status: "classified" });
    expect(classifier.classify({ ...baseText, headline: "The product was not delayed." })).toMatchObject({ label: "Positive", status: "classified" });
    expect(classifier.classify({ ...baseText, headline: "Revenue increased, but profits fell." })).toMatchObject({ label: "Neutral", status: "ambiguous" });
    expect(classifier.classify({ ...baseText, headline: "The board met in London." })).toMatchObject({ label: "Neutral", status: "classified" });
    const boilerplate = "Fictional scenario for the Aynox interface demonstration. This is not a report of a real event and has no external source.";
    expect(classifier.classify({ headline: "  ", summary: "", body: `  ${boilerplate}  ` })).toMatchObject({ label: "Neutral", status: "insufficient-content", heuristicConfidence: 0 });
    expect(classifier.classify({ headline: "Stronger growth in planning.", summary: "", body: "" }).calibrated).toBe(false);
  });

  it("keeps ambiguous and insufficient articles out of the genuinely neutral distribution", () => {
    const base = makeArticle();
    const articles = [
      makeArticle({ id: "positive" }, { sentiment: { ...base.sentiment, label: "Positive", status: "classified" } }),
      makeArticle({ id: "negative" }, { sentiment: { ...base.sentiment, label: "Negative", status: "classified" } }),
      makeArticle({ id: "neutral" }, { sentiment: { ...base.sentiment, label: "Neutral", status: "classified" } }),
      makeArticle({ id: "ambiguous" }, { sentiment: { ...base.sentiment, label: "Neutral", status: "ambiguous" } }),
      makeArticle({ id: "insufficient" }, { sentiment: { ...base.sentiment, label: "Neutral", status: "insufficient-content" } })
    ];
    expect(calculateSentimentDistribution(articles)).toEqual({ positive: 1, negative: 1, neutral: 1, ambiguous: 1, insufficient: 1, total: 5 });
    expect(calculateSentimentDistribution([])).toEqual({ positive: 0, negative: 0, neutral: 0, ambiguous: 0, insufficient: 0, total: 0 });
  });

  it("generates grounded reports for zero, one, and adequate coverage", async () => {
    const security = demoSecurities[0];
    const articles = await getNewsArticles();
    const empty = generateCompanyNewsReport(security, []);
    expect(empty).toMatchObject({ status: "insufficient-coverage", coverage: { articleCount: 0, from: null, to: null }, sentimentDistribution: { total: 0 } });
    const one = generateCompanyNewsReport(security, [articles.find((article) => article.securityId === security.id)!]);
    expect(one.status).toBe("insufficient-coverage");
    const adequate = generateCompanyNewsReport(security, articles);
    expect(adequate.status).toBe("available");
    expect(adequate.mostRelevantDevelopments.every((item) => item.scenarioStatement.length > 0)).toBe(true);
    expect(adequate.possibleImplications.every((item) => item.articleId && item.text)).toBe(true);
    expect(adequate.sentimentDistribution.total).toBe(adequate.coverage.articleCount);
    expect(adequate.positiveDevelopments.every((item) => item.status === "classified" && item.sentiment === "Positive")).toBe(true);
  });

  it("excludes malformed article IDs from generated company reports and records the limitation", () => {
    const security = demoSecurities[0];
    const valid = makeArticle({ id: "report-valid" });
    const invalid = ["", "   ", undefined, 8].map((id) => ({ ...valid, id })) as unknown as NewsArticle[];
    const report = generateCompanyNewsReport(security, [...invalid, valid]);
    expect(report.coverage.articleCount).toBe(1);
    expect(report.mostRelevantDevelopments.map((item) => item.articleId)).toEqual([valid.id]);
    expect(report.possibleImplications.map((item) => item.articleId)).toEqual([valid.id]);
    expect(report.risksAndUncertainties.some((item) => item.includes("4 articles were excluded"))).toBe(true);
  });

  it("aggregates only the currently tracked security IDs and handles no-news companies", async () => {
    const articles = await getNewsArticles();
    const currentlyTracked = [demoSecurities[0], demoSecurities[1]];
    const summary = aggregateTrackedCompanyNews(currentlyTracked, articles);
    expect(summary.map((item) => item.securityId)).toEqual(currentlyTracked.map((item) => item.id));
    expect(summary.some((item) => item.symbol === "ASML")).toBe(false);
    const noNews = aggregateTrackedCompanyNews([{ ...demoSecurities[0], id: "test:no-news", symbol: "NO-NEWS" }], articles);
    expect(noNews[0]).toMatchObject({ articleCount: 0, sentiment: { positive: 0, negative: 0, neutral: 0, ambiguous: 0, insufficient: 0, total: 0 } });
  });
});
