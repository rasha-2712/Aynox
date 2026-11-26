import type { NewsArticleInput } from "@/types/news";

export interface NewsProvider {
  readonly providerName: string;
  readonly isDemo: boolean;
  listArticles(): Promise<NewsArticleInput[]>;
}
