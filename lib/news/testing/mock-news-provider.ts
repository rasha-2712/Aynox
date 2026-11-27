import "server-only";
import { demoNewsArticles } from "@/lib/news/demo-news";
import { isVerifiedNewsRetrievalAuthorization } from "@/lib/research/evidence-permissions.server";
import type { NewsProvider } from "@/lib/news/provider";
import type { VerifiedNewsRetrievalAuthorization } from "@/types/news";

const syntheticNewsContract = {
  providerId: "aynox-synthetic-news",
  dataset: "synthetic-company-news",
  contractId: "aynox-synthetic-news-fixture",
  contractVersion: "1",
  retrievalScope: "dataset" as const
};

/** Vitest fixture adapter; production code cannot resolve this module path. */
export class MockNewsProvider implements NewsProvider {
  readonly providerName = "Aynox Synthetic News Lab";
  readonly isDemo = true;

  async listArticles(authorization: VerifiedNewsRetrievalAuthorization) {
    if (!isVerifiedNewsRetrievalAuthorization(authorization, {
      ...syntheticNewsContract,
      market: authorization?.market ?? "",
      securityId: authorization?.securityId ?? ""
    })) throw new TypeError("Verified news retrieval authorization is required.");
    return demoNewsArticles.filter((article) => article.securityId === authorization.securityId
      && this.marketMatchesAuthorization(authorization)).map((article) => ({ ...article }));
  }

  private marketMatchesAuthorization(authorization: VerifiedNewsRetrievalAuthorization): boolean {
    return isVerifiedNewsRetrievalAuthorization(authorization, {
      ...syntheticNewsContract,
      market: authorization.market,
      securityId: authorization.securityId
    });
  }
}
