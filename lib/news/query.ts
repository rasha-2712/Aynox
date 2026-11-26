import type { NewsArticle, NewsFilters, NewsSentimentLabel, SentimentDistribution } from "@/types/news";
import type { Security } from "@/types/market";

export const emptyNewsFilters: Required<NewsFilters> = {
  companySecurityId: "",
  companySymbol: "",
  category: "All topics",
  search: "",
  dateFrom: "",
  dateTo: "",
  sort: "newest"
};

export function filterNewsArticles(articles: NewsArticle[], filters: NewsFilters = {}): NewsArticle[] {
  const query = filters.search?.trim().toLocaleLowerCase() ?? "";
  const result = articles.filter((article) => {
    if (filters.companySecurityId && article.securityId !== filters.companySecurityId) return false;
    if (filters.companySymbol && article.symbol !== filters.companySymbol.toUpperCase()) return false;
    if (filters.category && filters.category !== "All topics" && article.category !== filters.category) return false;
    const articleDate = article.publishedAt.slice(0, 10);
    if (filters.dateFrom && articleDate < filters.dateFrom) return false;
    if (filters.dateTo && articleDate > filters.dateTo) return false;
    if (query && !`${article.headline} ${article.summary}`.toLocaleLowerCase().includes(query)) return false;
    return true;
  });

  return result.sort((a, b) => filters.sort === "relevance"
    ? b.relevance.score - a.relevance.score || b.publishedAt.localeCompare(a.publishedAt)
    : b.publishedAt.localeCompare(a.publishedAt) || b.relevance.score - a.relevance.score);
}

export function calculateSentimentDistribution(articles: NewsArticle[]): SentimentDistribution {
  const distribution: SentimentDistribution = { positive: 0, negative: 0, neutral: 0, ambiguous: 0, insufficient: 0, total: articles.length };
  for (const article of articles) {
    if (article.sentiment.status === "insufficient-content") distribution.insufficient += 1;
    else if (article.sentiment.status === "ambiguous") distribution.ambiguous += 1;
    else if (article.sentiment.label === "Positive") distribution.positive += 1;
    else if (article.sentiment.label === "Negative") distribution.negative += 1;
    else distribution.neutral += 1;
  }
  return distribution;
}

function topCategories(articles: NewsArticle[], sentiment: NewsSentimentLabel): Array<{ category: NewsArticle["category"]; count: number }> {
  const counts = new Map<NewsArticle["category"], number>();
  articles.filter((article) => article.sentiment.status === "classified" && article.sentiment.label === sentiment)
    .forEach((article) => counts.set(article.category, (counts.get(article.category) ?? 0) + 1));
  return [...counts].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

export function aggregateTrackedCompanyNews(securities: Security[], articles: NewsArticle[]) {
  return securities.map((security) => {
    const companyArticles = filterNewsArticles(articles, { companySecurityId: security.id, sort: "newest" });
    return {
      securityId: security.id,
      symbol: security.symbol,
      companyName: security.name,
      articleCount: companyArticles.length,
      sentiment: calculateSentimentDistribution(companyArticles),
      positiveThemes: topCategories(companyArticles, "Positive"),
      negativeThemes: topCategories(companyArticles, "Negative"),
      latestArticles: companyArticles.slice(0, 3)
    };
  });
}
