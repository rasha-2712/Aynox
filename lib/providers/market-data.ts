import type { PricePoint, Security } from "@/types/market";
import type { NewsArticle } from "@/types/news";

export interface MarketDataProvider {
  readonly providerName: string;
  readonly isDemo: boolean;
  listSecurities(): Promise<Security[]>;
  getSecurity(symbol: string): Promise<Security | undefined>;
  getHistoricalSeries(symbol: string): Promise<PricePoint[]>;
  listCompanyNews(symbol?: string): Promise<NewsArticle[]>;
}
