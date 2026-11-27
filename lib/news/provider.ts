import type { NewsArticleInput, VerifiedNewsRetrievalAuthorization } from "@/types/news";

export interface NewsProvider {
  readonly providerName: string;
  readonly isDemo: boolean;
  listArticles(authorization: VerifiedNewsRetrievalAuthorization): Promise<NewsArticleInput[]>;
}
