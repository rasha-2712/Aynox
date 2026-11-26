import { demoSecurities } from "@/lib/data/demo-data";
import { deduplicateNews } from "@/lib/news/deduplicate";
import { MockNewsProvider } from "@/lib/news/mock-news-provider";
import { isValidNewsArticleId } from "@/lib/news/validation";
import { demoSentimentClassifier, type SentimentClassifier } from "@/lib/news/sentiment";
import type { NewsArticle, NewsArticleInput } from "@/types/news";
import type { NewsProvider } from "@/lib/news/provider";

let activeNewsProvider: NewsProvider = new MockNewsProvider();
let activeSentimentClassifier: SentimentClassifier = demoSentimentClassifier;

export function setNewsProvider(provider: NewsProvider) { activeNewsProvider = provider; }
export function setSentimentClassifier(classifier: SentimentClassifier) { activeSentimentClassifier = classifier; }

function articleRelevance(input: NewsArticleInput): NewsArticle["relevance"] {
  const security = demoSecurities.find((item) => item.id === input.securityId);
  const normalizedName = input.companyName.trim().toLocaleLowerCase();
  const text = `${input.headline} ${input.summary} ${input.body}`.toLocaleLowerCase();
  const escapedSymbol = input.symbol.toLocaleLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hasTickerText = new RegExp(`\\b${escapedSymbol}\\b`).test(text);
  const hasCompanyText = normalizedName.length > 0 && text.includes(normalizedName);
  const score = Math.min(1, 0.72 + (hasTickerText ? 0.14 : 0) + (hasCompanyText ? 0.14 : 0));
  return {
    score,
    basis: "security-id-association",
    explanation: security
      ? `This article is associated with the stable security ID ${security.id}; text match signals are illustrative.`
      : "The news record contains an unknown security association."
  };
}

export function analyzeNewsArticle(input: NewsArticleInput): NewsArticle {
  if (!input || !isValidNewsArticleId((input as NewsArticleInput | null)?.id)) {
    throw new TypeError("News article ID must be a non-empty string without surrounding whitespace.");
  }
  return {
    ...input,
    symbol: input.symbol.toUpperCase(),
    relevance: articleRelevance(input),
    sentiment: activeSentimentClassifier.classify(input),
    duplicateCount: 1,
    duplicateArticleIds: []
  };
}

export async function getNewsArticles(): Promise<NewsArticle[]> {
  const inputs = await activeNewsProvider.listArticles();
  const knownSecurityIds = new Set(demoSecurities.map((security) => security.id));
  const analyzed = inputs
    .filter((article) => isValidNewsArticleId((article as NewsArticleInput | null)?.id)
      && knownSecurityIds.has(article.securityId)
      && (!activeNewsProvider.isDemo || article.contentKind === "demo"))
    .map(analyzeNewsArticle);
  return deduplicateNews(analyzed);
}

export async function getCompanyNews(symbol: string): Promise<NewsArticle[]> {
  const security = demoSecurities.find((item) => item.symbol === symbol.toUpperCase());
  return security ? (await getNewsArticles()).filter((article) => article.securityId === security.id) : [];
}
