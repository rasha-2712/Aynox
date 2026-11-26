import { MockFundamentalsProvider } from "@/lib/providers/mock-fundamentals-provider";
import { MockMarketDataProvider } from "@/lib/providers/mock-market-data";
import type { MarketDataProvider } from "@/lib/providers/market-data";

let provider: MarketDataProvider | undefined;

export function getMarketDataProvider(): MarketDataProvider {
  provider ??= new MockMarketDataProvider();
  return provider;
}

let fundamentalsProvider: MockFundamentalsProvider | undefined;

export function getFundamentalsProvider(): MockFundamentalsProvider {
  fundamentalsProvider ??= new MockFundamentalsProvider();
  return fundamentalsProvider;
}
