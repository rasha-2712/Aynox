"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, CalendarDays, Info, Leaf } from "lucide-react";
import { DemoBadge } from "@/components/demo-badge";
import { MarketChart } from "@/components/market-chart";
import { PageHeading } from "@/components/page-heading";
import { SectionHeading } from "@/components/section-heading";
import { TrackStockButton } from "@/components/track-stock-button";
import { CompanyNewsWorkspace } from "@/components/news/news-intelligence";
import { demoESG, demoSecuritySeries } from "@/lib/data/demo-data";
import type { PricePoint, Security } from "@/types/market";

type Period = "1M" | "3M" | "6M" | "1Y";
const periodMonths: Record<Period, number> = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12 };
const money = (value: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

export function CompanyDetail({ security }: { security: Security }) {
  const [period, setPeriod] = useState<Period>("3M");
  const chart = useMemo(() => {
    const points = demoSecuritySeries[security.symbol]?.points ?? [];
    const lastDate = points.at(-1)?.date;
    if (!lastDate) return [];
    const cutoff = new Date(`${lastDate}T00:00:00.000Z`);
    cutoff.setUTCMonth(cutoff.getUTCMonth() - periodMonths[period]);
    return points.filter((point) => new Date(`${point.date}T00:00:00.000Z`) >= cutoff)
      .map(({ date, price }) => ({ date, value: price } satisfies PricePoint));
  }, [period, security.symbol]);
  const esg = demoESG[security.symbol];
  const positive = security.changePercent >= 0;

  return <>
    <Link href="/discover" className="mb-4 inline-flex items-center gap-1 text-[10px] font-semibold text-muted hover:text-positive"><ArrowLeft size={13} /> Back to discovery</Link>
    <PageHeading eyebrow="Company intelligence" title={security.name} description={`${security.symbol} · ${security.exchange} · ${security.country}`} action={<TrackStockButton symbol={security.symbol} />} />
    <div className="mb-5 flex flex-wrap items-center gap-2"><DemoBadge>SYNTHETIC DEMO DATA</DemoBadge><span className="text-[10px] text-muted">No live provider or exchange data is connected.</span></div>

    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="panel p-4"><p className="metric-label">Demo price</p><p className="mt-2 text-[15px] font-bold text-ink">{money(security.price, security.currency)}</p></div>
      <div className="panel p-4"><p className="metric-label">Daily move · demo</p><p className={`mt-2 flex items-center text-[15px] font-bold ${positive ? "text-positive" : "text-negative"}`}>{positive ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}{positive ? "+" : ""}{security.changePercent.toFixed(2)}%</p></div>
      <div className="panel p-4"><p className="metric-label">Trading currency</p><p className="mt-2 text-[15px] font-bold text-ink">{security.currency}</p></div>
      <div className="panel p-4"><p className="metric-label">Sector</p><p className="mt-2 text-[13px] font-bold text-ink">{security.sector}</p></div>
    </section>

    <section className="panel panel-pad mt-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3"><SectionHeading title="Historical price illustration" detail="Synthetic weekday series · not historical exchange prices" action={<span className="eyebrow"><CalendarDays size={11} className="mr-1 inline" />Demo period</span>} /><div className="flex rounded-lg border border-line bg-surface-muted p-1" role="group" aria-label="Historical chart period">{(["1M", "3M", "6M", "1Y"] as const).map((value) => <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)} className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold ${period === value ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink"}`}>{value}</button>)}</div></div>
      <MarketChart data={chart} height={280} prefix={`${security.currency} `} />
      <p className="mt-2 text-[9px] text-muted">Prices use the {security.currency} local currency. No FX conversion or dividend adjustments are represented.</p>
    </section>

    <section className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,.8fr)]">
      <div className="panel panel-pad"><SectionHeading title="Company overview" detail="Synthetic company description" /><p className="text-[12px] leading-relaxed text-ink-soft">{security.description}</p><dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl bg-surface-muted p-3"><dt className="metric-label">Ticker</dt><dd className="mt-2 text-[12px] font-bold text-ink">{security.symbol}</dd></div><div className="rounded-xl bg-surface-muted p-3"><dt className="metric-label">Exchange</dt><dd className="mt-2 text-[12px] font-bold text-ink">{security.exchange}</dd></div><div className="rounded-xl bg-surface-muted p-3"><dt className="metric-label">Country</dt><dd className="mt-2 text-[12px] font-bold text-ink">{security.country}</dd></div><div className="rounded-xl bg-surface-muted p-3"><dt className="metric-label">Sector</dt><dd className="mt-2 text-[12px] font-bold text-ink">{security.sector}</dd></div></dl></div>
      <div className="panel panel-pad"><SectionHeading title="Fundamentals preview" detail="Synthetic values · not verified company data" /><div className="flex items-center justify-between border-b border-line py-3 text-[11px]"><span className="text-muted">Market capitalization</span><strong className="text-ink">{security.marketCap}</strong></div><div className="flex items-center justify-between py-3 text-[11px]"><span className="text-muted">Price-to-earnings</span><strong className="text-ink">{security.peRatio.toFixed(1)}×</strong></div><p className="mt-2 text-[9px] text-muted">Metrics are illustrative only and have not been sourced from a financial-data provider.</p></div>
    </section>

    <section className="mt-5"><CompanyNewsWorkspace securities={[security]} initialSymbol={security.symbol} /></section>
    <section className="panel panel-pad mt-5"><SectionHeading title="ESG preview" detail="Synthetic, non-comparable example" action={<Leaf size={15} className="text-positive" />} />{esg ? <div className="flex items-end justify-between"><div><p className="text-3xl font-bold text-ink">{esg.score}</p><p className="mt-1 text-[10px] text-muted">{esg.label} · {esg.coverage}</p></div><p className="text-right text-[9px] text-muted">{esg.source}<br />{esg.asOf}</p></div> : <p className="text-xs text-muted">No synthetic ESG example is available.</p>}<p className="mt-3 flex gap-2 text-[9px] leading-relaxed text-muted"><Info size={12} className="mt-0.5 shrink-0" />This is not a verified ESG rating or a comparable provider score.</p></section>
    <div className="mt-5 rounded-xl border border-line bg-surface-muted p-4"><h2 className="text-[11px] font-bold text-ink">Forecasting</h2><p className="mt-1 text-[10px] text-muted">Coming soon. Forecasts will be shown only after chronological out-of-sample validation and baseline comparison.</p></div>
  </>;
}
