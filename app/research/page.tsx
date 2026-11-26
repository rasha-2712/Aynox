"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, ChevronDown, FileText, Leaf, Sparkles } from "lucide-react";
import { DemoBadge } from "@/components/demo-badge";
import { MarketChart } from "@/components/market-chart";
import { PageHeading } from "@/components/page-heading";
import { SectionHeading } from "@/components/section-heading";
import { CompanyNewsWorkspace } from "@/components/news/news-intelligence";
import { useNewsArticles } from "@/components/news-provider";
import { calculateSentimentDistribution, filterNewsArticles } from "@/lib/news/query";
import { demoESG, demoSecuritySeries, demoSecurities } from "@/lib/data/demo-data";

const money = (value: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

export default function ResearchPage() {
  const [symbol, setSymbol] = useState("NVDA");
  const security = useMemo(() => demoSecurities.find((item) => item.symbol === symbol) ?? demoSecurities[0], [symbol]);
  const esg = demoESG[security.symbol];
  const chart = demoSecuritySeries[security.symbol]?.points.map(({ date, price }) => ({ date, value: price })) ?? [];
  const articles = filterNewsArticles(useNewsArticles(), { companySecurityId: security.id });
  const sentiment = calculateSentimentDistribution(articles);
  const sentimentLabel = sentiment.ambiguous ? "Ambiguous evidence" : sentiment.insufficient ? "Insufficient evidence" : sentiment.positive && sentiment.negative ? "Mixed" : sentiment.positive ? "Positive" : sentiment.negative ? "Negative" : "Neutral";

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("symbol");
    if (requested && demoSecurities.some((item) => item.symbol === requested.toUpperCase())) {
      window.requestAnimationFrame(() => setSymbol(requested.toUpperCase()));
    }
  }, []);

  return (
    <>
      <PageHeading eyebrow="Company intelligence" title="Company research" description="A structured overview of company, market, news, sentiment, ESG and model availability." action={<DemoBadge>SYNTHETIC EXAMPLES</DemoBadge>} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-3">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-light text-xs font-bold text-brand">{security.symbol.slice(0, 2)}</span><div><p className="text-[13px] font-bold text-ink">{security.name}</p><p className="mt-1 text-[10px] text-muted">{security.symbol} · {security.exchange} · {security.currency}</p></div></div>
        <label className="flex items-center gap-2 text-[10px] font-semibold text-muted">Select company <span className="relative"><select className="input-control !w-44 appearance-none pr-8" value={symbol} onChange={(event) => setSymbol(event.target.value)}>{demoSecurities.map((item) => <option value={item.symbol} key={item.symbol}>{item.symbol} · {item.name}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" /></span></label>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(275px,.72fr)]">
        <div className="panel panel-pad">
          <SectionHeading title="Company overview" detail="Illustrative company profile · not verified company data" />
          <p className="text-[12px] leading-relaxed text-ink-soft">{security.description} This profile is synthetic demo content and has not been reviewed as investment research.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-surface-muted p-3"><p className="metric-label">Demo price</p><p className="mt-2 text-[14px] font-bold text-ink">{money(security.price, security.currency)}</p></div>
            <div className="rounded-xl bg-surface-muted p-3"><p className="metric-label">Daily move</p><p className={`mt-2 flex items-center text-[14px] font-bold ${security.changePercent >= 0 ? "text-positive" : "text-negative"}`}>{security.changePercent >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{security.changePercent >= 0 ? "+" : ""}{security.changePercent.toFixed(2)}%</p></div>
            <div className="rounded-xl bg-surface-muted p-3"><p className="metric-label">Market cap</p><p className="mt-2 text-[14px] font-bold text-ink">{security.marketCap}</p></div>
            <div className="rounded-xl bg-surface-muted p-3"><p className="metric-label">P/E · demo</p><p className="mt-2 text-[14px] font-bold text-ink">{security.peRatio}</p></div>
          </div>
          <div className="mt-5 flex items-center justify-between"><h3 className="section-title">Price history</h3><span className="eyebrow"><CalendarDays size={11} className="mr-1 inline" />Illustrative series</span></div>
          <div className="mt-3"><MarketChart data={chart} height={225} prefix={security.currency + " "} /></div>
          <p className="mt-2 text-[9px] text-muted">Synthetic historical series · local currency · no provider or exchange data</p>
        </div>

        <div className="panel panel-pad">
          <SectionHeading title="Research summary" detail="Descriptive only · demo" />
          <div className="rounded-xl bg-positive-soft p-4">
            <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-positive">Synthetic sentiment</span><Sparkles size={15} className="text-positive" /></div>
            <p className="mt-3 text-2xl font-bold text-ink">{sentimentLabel}</p>
            <p className="mt-1 text-[10px] text-muted">Illustrative article tone · not a price signal</p>
            <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-white"><span className="bg-positive" style={{ width: `${sentiment.total ? sentiment.positive / sentiment.total * 100 : 0}%` }} /><span className="bg-negative" style={{ width: `${sentiment.total ? sentiment.negative / sentiment.total * 100 : 0}%` }} /><span className="bg-muted" style={{ width: `${sentiment.total ? sentiment.neutral / sentiment.total * 100 : 0}%` }} /><span className="bg-warning" style={{ width: `${sentiment.total ? sentiment.ambiguous / sentiment.total * 100 : 0}%` }} /><span className="bg-line" style={{ width: `${sentiment.total ? sentiment.insufficient / sentiment.total * 100 : 0}%` }} /></div>
            <div className="mt-2 flex flex-wrap justify-between gap-1 text-[9px] text-muted"><span>{sentiment.positive} positive · {sentiment.negative} negative · {sentiment.neutral} neutral · {sentiment.ambiguous} ambiguous · {sentiment.insufficient} insufficient</span><span>{sentiment.total} canonical demo stories</span></div>
          </div>
          <div className="mt-3 rounded-xl border border-line p-4">
            <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-muted">ESG preview</span><Leaf size={15} className="text-positive" /></div>
            <div className="mt-3 flex items-end justify-between"><span className="text-3xl font-bold text-ink">{esg?.score ?? "—"}</span><span className="text-[10px] font-semibold text-muted">{esg?.label ?? "No demo score"}</span></div>
            <p className="mt-2 text-[10px] text-muted">{esg?.source} · {esg?.coverage} · {esg?.asOf}</p>
            <p className="mt-2 text-[9px] leading-relaxed text-muted">Illustrative values do not represent a verified ESG rating or comparable provider score.</p>
          </div>
        </div>
      </div>

      <section className="mt-5">
        <CompanyNewsWorkspace key={symbol} securities={demoSecurities} initialSymbol={symbol} />
      </section>

      <section className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="panel panel-pad">
          <SectionHeading title="Forecasting" detail="Validation gate not implemented" action={<BarChart3 size={16} className="text-muted" />} />
          <div className="flex min-h-[235px] flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-muted px-5 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-muted shadow-sm"><FileText size={18} /></span>
            <p className="mt-3 text-[13px] font-bold text-ink">Forecasting coming soon</p>
            <p className="mt-2 max-w-xs text-[10px] leading-relaxed text-muted">Forecasts will appear only after chronological out-of-sample evaluation, baseline comparison, uncertainty reporting, and an approved release gate.</p>
            <span className="mt-4 rounded-full border border-line bg-white px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-muted">Not available in demo</span>
          </div>
          <Link href="/portfolio" className="mt-4 inline-flex items-center gap-1 text-[10px] font-bold text-positive">See tracked-stock methodology <ArrowRight size={12} /></Link>
        </div>
      </section>
    </>
  );
}
