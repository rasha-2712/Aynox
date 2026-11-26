import { calculateSentimentDistribution } from "@/lib/news/query";
import type { CompanyNewsReport, NewsArticle } from "@/types/news";
import type { Security } from "@/types/market";

export function generateCompanyNewsReport(security: Pick<Security, "id" | "symbol" | "name">, articles: NewsArticle[]): CompanyNewsReport {
  const companyArticles = articles.filter((article) => article.securityId === security.id).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const sentimentDistribution = calculateSentimentDistribution(companyArticles);
  const from = companyArticles.at(-1)?.publishedAt ?? null;
  const to = companyArticles[0]?.publishedAt ?? null;
  const counts = new Map<NewsArticle["category"], number>();
  for (const article of companyArticles) counts.set(article.category, (counts.get(article.category) ?? 0) + 1);
  const mainTopics = [...counts].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  const mostRelevantDevelopments = companyArticles.map((article) => ({
    articleId: article.id, headline: article.headline, category: article.category,
    scenarioStatement: article.scenarioStatement, sentiment: article.sentiment.label, status: article.sentiment.status
  }));
  const possibleImplications = companyArticles.map((article) => ({ articleId: article.id, headline: article.headline, category: article.category, text: article.possibleImplication }));
  const insufficientCoverage = companyArticles.length < 2;
  const executiveSummary = insufficientCoverage
    ? `Insufficient demonstration coverage to summarize ${security.name} reliably. ${companyArticles.length} article${companyArticles.length === 1 ? " is" : "s are"} available.`
    : `The synthetic feed contains ${companyArticles.length} articles for ${security.name} from ${from?.slice(0, 10)} through ${to?.slice(0, 10)}. These examples cover ${mainTopics.slice(0, 3).map((topic) => topic.category.toLowerCase()).join(", ") || "no recurring topics"}.`;
  return {
    symbol: security.symbol, companyName: security.name, status: insufficientCoverage ? "insufficient-coverage" : "available", executiveSummary,
    coverage: { articleCount: companyArticles.length, from, to }, mostRelevantDevelopments,
    positiveDevelopments: mostRelevantDevelopments.filter((item) => item.status === "classified" && item.sentiment === "Positive"),
    negativeDevelopments: mostRelevantDevelopments.filter((item) => item.status === "classified" && item.sentiment === "Negative"),
    neutralDevelopments: mostRelevantDevelopments.filter((item) => item.status === "classified" && item.sentiment === "Neutral"),
    mainTopics, possibleImplications,
    risksAndUncertainties: ["All stories and classifications are synthetic interface demonstrations, not reporting about real events.", "The sample is not necessarily complete or representative; article tone does not establish business impact or future stock performance."],
    sentimentDistribution
  };
}
