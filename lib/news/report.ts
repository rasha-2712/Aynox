import { calculateSentimentDistribution } from "@/lib/news/query";
import { isValidNewsArticleId } from "@/lib/news/validation";
import type { CompanyNewsReport, NewsArticle } from "@/types/news";
import type { Security } from "@/types/market";

export function generateCompanyNewsReport(security: Pick<Security, "id" | "symbol" | "name">, articles: NewsArticle[]): CompanyNewsReport {
  const companyCandidates = articles.filter((article) => article && typeof article === "object" && article.securityId === security.id);
  const invalidIdCount = companyCandidates.filter((article) => !isValidNewsArticleId((article as NewsArticle | null)?.id)).length;
  const companyArticles = companyCandidates.filter((article) => isValidNewsArticleId((article as NewsArticle | null)?.id)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
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
  const sourceKinds = new Set(companyArticles.map((article) => article.contentKind));
  const sourceDescription = sourceKinds.size === 0 ? "available news data"
    : sourceKinds.size > 1 ? "mixed synthetic and licensed news sources"
    : sourceKinds.has("licensed") ? "licensed news sources" : "synthetic demonstration feed";
  const executiveSummary = insufficientCoverage
    ? `Insufficient ${sourceDescription} coverage to summarize ${security.name} reliably. ${companyArticles.length} article${companyArticles.length === 1 ? " is" : "s are"} available.`
    : `Available from ${sourceDescription}: ${companyArticles.length} articles for ${security.name} from ${from?.slice(0, 10)} through ${to?.slice(0, 10)}. These articles cover ${mainTopics.slice(0, 3).map((topic) => topic.category.toLowerCase()).join(", ") || "no recurring topics"}.`;
  const sourceDisclosure = sourceKinds.size === 0
    ? "No articles were available to determine the source type; there is no news evidence to assess."
    : sourceKinds.size > 1
    ? "This report includes both synthetic interface demonstrations and licensed articles; consult each article's source attribution."
    : sourceKinds.has("licensed")
      ? "This report summarizes licensed articles in the available dataset; coverage may be incomplete and article tone does not establish business impact or future stock performance."
      : "All stories and classifications are synthetic interface demonstrations, not reporting about real events.";
  const risksAndUncertainties = [sourceDisclosure, "The sample is not necessarily complete or representative; article tone does not establish business impact or future stock performance."];
  if (invalidIdCount > 0) risksAndUncertainties.push(`${invalidIdCount} article${invalidIdCount === 1 ? " was" : "s were"} excluded because the identifier was missing or malformed.`);
  return {
    symbol: security.symbol, companyName: security.name, status: insufficientCoverage ? "insufficient-coverage" : "available", executiveSummary,
    coverage: { articleCount: companyArticles.length, from, to }, mostRelevantDevelopments,
    positiveDevelopments: mostRelevantDevelopments.filter((item) => item.status === "classified" && item.sentiment === "Positive"),
    negativeDevelopments: mostRelevantDevelopments.filter((item) => item.status === "classified" && item.sentiment === "Negative"),
    neutralDevelopments: mostRelevantDevelopments.filter((item) => item.status === "classified" && item.sentiment === "Neutral"),
    mainTopics, possibleImplications,
    risksAndUncertainties,
    sentimentDistribution
  };
}
