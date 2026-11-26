import { demoNewsArticles } from "@/lib/news/demo-news";
import type { NewsProvider } from "@/lib/news/provider";

export class MockNewsProvider implements NewsProvider {
  readonly providerName = "Aynox Synthetic News Lab";
  readonly isDemo = true;

  async listArticles() {
    return demoNewsArticles.map((article) => ({ ...article }));
  }
}
