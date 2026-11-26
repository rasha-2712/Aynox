import { demoMarketHistory, demoSecurities, getDemoSeries } from "@/lib/data/demo-data";
import { getNewsArticles } from "@/lib/news/service";
import type { MarketDataProvider } from "@/lib/providers/market-data";

export class MockMarketDataProvider implements MarketDataProvider {
  readonly providerName = "Aynox synthetic demo provider";
  readonly isDemo = true;

  async listSecurities() {
    return demoSecurities;
  }

  async getSecurity(symbol: string) {
    return demoSecurities.find((security) => security.symbol === symbol.toUpperCase());
  }

  async getHistoricalSeries(symbol: string) {
    return symbol === "MARKET" ? demoMarketHistory : getDemoSeries(symbol.toUpperCase());
  }

  async listCompanyNews(symbol?: string) {
    const articles = await getNewsArticles();
    return symbol ? articles.filter((article) => article.symbol === symbol.toUpperCase()) : articles;
  }
}
