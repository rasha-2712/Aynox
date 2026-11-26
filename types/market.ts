export interface Security {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  country: string;
  currency: string;
  sector: string;
  price: number;
  changePercent: number;
  marketCap: string;
  peRatio: number;
  description: string;
}

export interface PricePoint {
  date: string;
  value: number | null;
}

export interface ConstituentPricePoint {
  date: string;
  price: number | null;
}

export interface ConstituentPriceSeries {
  securityId: string;
  symbol: string;
  currency: string;
  points: ConstituentPricePoint[];
}

export interface IndexPoint {
  date: string;
  value: number | null;
  eligible: number;
  total: number;
}

export type MembershipEventType = "added" | "removed";

export interface MembershipEvent {
  id: string;
  securityId: string;
  type: MembershipEventType;
  effectiveAt: string;
}

export interface MembershipInterval {
  securityId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface NewsStory {
  id: string;
  symbol: string;
  publisher: string;
  title: string;
  date: string;
  sentiment: "Positive" | "Mixed" | "Neutral";
  summary: string;
}

export interface ESGSnapshot {
  label: string;
  score: number;
  source: string;
  asOf: string;
  coverage: string;
}
