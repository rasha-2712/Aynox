export const NEWS_CATEGORIES = [
  "Earnings",
  "Products",
  "Operations",
  "Markets",
  "Regulation",
  "Sustainability",
  "Strategy"
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];
export type NewsSentimentLabel = "Positive" | "Negative" | "Neutral";
export type SentimentAssessmentStatus = "classified" | "ambiguous" | "insufficient-content";

/** Runtime-unforgeable, request-scoped authorization passed to server-side news providers. */
export interface VerifiedNewsRetrievalAuthorization {
  readonly providerId: string;
  readonly dataset: string;
  readonly market: string;
  readonly securityId: string;
  readonly contractId: string;
  readonly contractVersion: string;
  readonly retrievalScope: "dataset";
  readonly requestId: string;
}

export interface NewsArticleInput {
  id: string;
  securityId: string;
  symbol: string;
  companyName: string;
  headline: string;
  summary: string;
  body: string;
  sourceName: string;
  publishedAt: string;
  category: NewsCategory;
  articleUrl?: string;
  contentKind: "demo" | "licensed";
  scenarioStatement: string;
  possibleImplication: string;
}

export interface NewsRelevance {
  score: number;
  basis: "security-id-association";
  explanation: string;
}

export interface NewsSentiment {
  label: NewsSentimentLabel;
  explanation: string;
  matchedPositiveTerms: string[];
  matchedNegativeTerms: string[];
  /** Illustrative, uncalibrated confidence represented as a decimal in [0, 1]. */
  heuristicConfidence: number;
  status: SentimentAssessmentStatus;
  classifier: string;
  calibrated: false;
}

export interface NewsArticle extends NewsArticleInput {
  relevance: NewsRelevance;
  sentiment: NewsSentiment;
  duplicateCount: number;
  duplicateArticleIds: string[];
}

export type NewsSort = "newest" | "relevance";

export interface NewsFilters {
  companySecurityId?: string;
  companySymbol?: string;
  category?: NewsCategory | "All topics";
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: NewsSort;
}

export interface SentimentDistribution {
  positive: number;
  negative: number;
  neutral: number;
  ambiguous: number;
  insufficient: number;
  total: number;
}

export interface NewsReportDevelopment {
  articleId: string;
  headline: string;
  category: NewsCategory;
  scenarioStatement: string;
  sentiment: NewsSentimentLabel;
  status: SentimentAssessmentStatus;
}

export interface NewsReportImplication {
  articleId: string;
  headline: string;
  category: NewsCategory;
  text: string;
}

export interface CompanyNewsReport {
  symbol: string;
  companyName: string;
  status: "available" | "insufficient-coverage";
  executiveSummary: string;
  coverage: {
    articleCount: number;
    from: string | null;
    to: string | null;
  };
  mostRelevantDevelopments: NewsReportDevelopment[];
  positiveDevelopments: NewsReportDevelopment[];
  negativeDevelopments: NewsReportDevelopment[];
  neutralDevelopments: NewsReportDevelopment[];
  mainTopics: Array<{ category: NewsCategory; count: number }>;
  possibleImplications: NewsReportImplication[];
  risksAndUncertainties: string[];
  sentimentDistribution: SentimentDistribution;
}

export interface CompanyNewsPortfolioSummary {
  securityId: string;
  symbol: string;
  companyName: string;
  articleCount: number;
  sentiment: SentimentDistribution;
  positiveThemes: Array<{ category: NewsCategory; count: number }>;
  negativeThemes: Array<{ category: NewsCategory; count: number }>;
  latestArticles: NewsArticle[];
}
