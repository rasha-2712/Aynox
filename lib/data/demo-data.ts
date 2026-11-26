import type { ConstituentPricePoint, ConstituentPriceSeries, NewsStory, PricePoint, Security } from "@/types/market";

export const demoSecurities: Security[] = [
  { id: "US:XNAS:NVDA", symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", country: "United States", currency: "USD", sector: "Semiconductors", price: 142.8, changePercent: 1.84, marketCap: "$3.5T", peRatio: 46.2, description: "Illustrative semiconductor and accelerated computing profile." },
  { id: "US:XNAS:MSFT", symbol: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", country: "United States", currency: "USD", sector: "Software", price: 426.3, changePercent: 0.62, marketCap: "$3.2T", peRatio: 34.8, description: "Illustrative enterprise software and cloud profile." },
  { id: "US:XNAS:AAPL", symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", country: "United States", currency: "USD", sector: "Consumer Technology", price: 232.4, changePercent: -0.38, marketCap: "$3.5T", peRatio: 31.4, description: "Illustrative consumer devices and services profile." },
  { id: "US:XNAS:AMZN", symbol: "AMZN", name: "Amazon.com, Inc.", exchange: "NASDAQ", country: "United States", currency: "USD", sector: "Consumer & Cloud", price: 218.7, changePercent: 1.12, marketCap: "$2.3T", peRatio: 37.5, description: "Illustrative commerce and cloud infrastructure profile." },
  { id: "US:XNAS:GOOGL", symbol: "GOOGL", name: "Alphabet Inc.", exchange: "NASDAQ", country: "United States", currency: "USD", sector: "Communication Services", price: 191.5, changePercent: 0.29, marketCap: "$2.4T", peRatio: 24.1, description: "Illustrative search, advertising and cloud profile." },
  { id: "NL:XAMS:ASML", symbol: "ASML", name: "ASML Holding N.V.", exchange: "Euronext Amsterdam", country: "Netherlands", currency: "EUR", sector: "Semiconductors", price: 682.2, changePercent: 1.37, marketCap: "€268B", peRatio: 31.7, description: "Illustrative lithography equipment company profile." },
  { id: "DK:XCSE:NVO", symbol: "NVO", name: "Novo Nordisk A/S", exchange: "Nasdaq Copenhagen", country: "Denmark", currency: "DKK", sector: "Healthcare", price: 526.8, changePercent: -0.74, marketCap: "DKK 2.4T", peRatio: 22.9, description: "Illustrative pharmaceutical company profile." },
  { id: "TW:XTAI:TSM", symbol: "TSM", name: "Taiwan Semiconductor Mfg.", exchange: "Taiwan Stock Exchange", country: "Taiwan", currency: "TWD", sector: "Semiconductors", price: 1035, changePercent: 2.05, marketCap: "NT$26.8T", peRatio: 25.6, description: "Illustrative semiconductor foundry profile." },
  { id: "GB:XLON:BHP", symbol: "BHP", name: "BHP Group Limited", exchange: "London Stock Exchange", country: "United Kingdom", currency: "GBP", sector: "Materials", price: 21.4, changePercent: -0.21, marketCap: "£108B", peRatio: 12.2, description: "Illustrative diversified materials company profile." },
  { id: "US:XNYS:ORCL", symbol: "ORCL", name: "Oracle Corporation", exchange: "NYSE", country: "United States", currency: "USD", sector: "Software", price: 178.9, changePercent: 0.91, marketCap: "$497B", peRatio: 37.1, description: "Illustrative enterprise software and cloud profile." }
];

export const demoHistoryStart = "2025-11-25";
export const demoHistoryEnd = "2026-11-24";

function weekdays(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  while (current <= last) {
    if (current.getUTCDay() !== 0 && current.getUTCDay() !== 6) dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

const historyDates = weekdays(demoHistoryStart, demoHistoryEnd);

function securityHistory(security: Security, index: number): ConstituentPricePoint[] {
  const priorClose = security.price / (1 + security.changePercent / 100);
  let price = priorClose * 0.78;
  return historyDates.map((date, pointIndex) => {
    if (pointIndex === historyDates.length - 1) price = security.price;
    else if (pointIndex < historyDates.length - 2) {
      const drift = 0.00045 + 0.00012 * Math.sin(pointIndex * 0.17 + index);
      const wave = 0.006 * Math.sin(pointIndex * 0.73 + index * 0.62) + 0.002 * Math.cos(pointIndex * 0.29 + index);
      price *= 1 + drift + wave;
    } else {
      price = priorClose;
    }
    return { date, price: Number(price.toFixed(2)) };
  });
}

export const demoMarketHistory: PricePoint[] = historyDates.filter((_, index) => index % 4 === 0).map((date, index) => ({
  date,
  value: Number((100 + index * 0.035 + Math.sin(index * 0.53) * 1.15).toFixed(2))
}));

export const demoSecuritySeries: Record<string, ConstituentPriceSeries> = Object.fromEntries(
  demoSecurities.map((security, index) => [
    security.symbol,
    {
      securityId: security.id,
      symbol: security.symbol,
      currency: security.currency,
      points: securityHistory(security, index)
    }
  ])
);

export const demoNews: NewsStory[] = [
  { id: "demo-1", symbol: "NVDA", publisher: "Aynox Demo Desk", title: "DEMO: Quarterly outlook highlights data-centre investment themes", date: "2026-11-24", sentiment: "Positive", summary: "Synthetic example of a company-linked article with source attribution and a descriptive sentiment label." },
  { id: "demo-2", symbol: "MSFT", publisher: "Aynox Demo Desk", title: "DEMO: Cloud demand and operating margins in focus", date: "2026-11-21", sentiment: "Mixed", summary: "Illustrative news card showing how multiple business themes could be summarized." },
  { id: "demo-3", symbol: "ASML", publisher: "Aynox Demo Desk", title: "DEMO: Equipment cycle commentary shapes sector discussion", date: "2026-11-19", sentiment: "Neutral", summary: "Synthetic item for layout demonstration only; it does not describe a real event." },
  { id: "demo-4", symbol: "NVO", publisher: "Aynox Demo Desk", title: "DEMO: Healthcare pipeline and capacity themes reviewed", date: "2026-11-17", sentiment: "Mixed", summary: "Example of coverage with a mixed descriptive signal and disclosed mock provenance." }
];

export const demoESG: Record<string, { score: number; label: string; source: string; coverage: string; asOf: string }> = {
  NVDA: { score: 71, label: "Illustrative score", source: "Aynox sample data", coverage: "3 of 3 pillars", asOf: "Demo snapshot" },
  MSFT: { score: 78, label: "Illustrative score", source: "Aynox sample data", coverage: "3 of 3 pillars", asOf: "Demo snapshot" },
  AAPL: { score: 74, label: "Illustrative score", source: "Aynox sample data", coverage: "2 of 3 pillars", asOf: "Demo snapshot" },
  AMZN: { score: 62, label: "Illustrative score", source: "Aynox sample data", coverage: "2 of 3 pillars", asOf: "Demo snapshot" },
  GOOGL: { score: 69, label: "Illustrative score", source: "Aynox sample data", coverage: "3 of 3 pillars", asOf: "Demo snapshot" },
  ASML: { score: 76, label: "Illustrative score", source: "Aynox sample data", coverage: "2 of 3 pillars", asOf: "Demo snapshot" },
  NVO: { score: 81, label: "Illustrative score", source: "Aynox sample data", coverage: "3 of 3 pillars", asOf: "Demo snapshot" },
  TSM: { score: 67, label: "Illustrative score", source: "Aynox sample data", coverage: "2 of 3 pillars", asOf: "Demo snapshot" },
  BHP: { score: 72, label: "Illustrative score", source: "Aynox sample data", coverage: "3 of 3 pillars", asOf: "Demo snapshot" },
  ORCL: { score: 64, label: "Illustrative score", source: "Aynox sample data", coverage: "2 of 3 pillars", asOf: "Demo snapshot" }
};

export const marketIndices = [
  { name: "S&P 500", value: "5,842.16", change: "+0.72%", positive: true, venue: "US market" },
  { name: "NASDAQ", value: "18,392.44", change: "+1.08%", positive: true, venue: "US market" },
  { name: "FTSE 100", value: "8,214.90", change: "−0.16%", positive: false, venue: "UK market" }
];

export const trackedDefaults = ["NVDA", "MSFT", "ASML", "NVO"];

export function getDemoSeries(symbol: string): PricePoint[] {
  const item = demoSecuritySeries[symbol]?.points;
  return item ? item.map(({ date, price }) => ({ date, value: price })) : [];
}
