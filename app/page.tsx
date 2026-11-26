"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BriefcaseBusiness, CalendarDays, ChevronRight, CircleDollarSign, Globe2, Search, Sparkles, WalletCards } from "lucide-react";
import { DemoBadge } from "@/components/demo-badge";
import { MarketChart } from "@/components/market-chart";
import { MetricCard } from "@/components/metric-card";
import { PageHeading } from "@/components/page-heading";
import { SectionHeading } from "@/components/section-heading";
import { CompanyNewsWorkspace } from "@/components/news/news-intelligence";
import { useNewsArticles } from "@/components/news-provider";
import { useTrackedPortfolio } from "@/components/portfolio-provider";
import { demoMarketHistory, demoSecurities, demoSecuritySeries, marketIndices } from "@/lib/data/demo-data";
import { calculateEqualWeightedIndex } from "@/lib/portfolio/calculate-index";

const money = (value: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

export default function DashboardPage() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const updateClock = () => setNow(new Date());
    updateClock();
    const interval = window.setInterval(updateClock, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const qatarDate = now
    ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Qatar", weekday: "long", day: "numeric", month: "short", year: "numeric" }).format(now)
    : null;
  const qatarTime = now
    ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Qatar", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now)
    : null;
  const qatarHour = now
    ? Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Qatar", hour: "2-digit", hourCycle: "h23" }).format(now))
    : null;
  const greeting = qatarHour === null ? "Welcome, investor." : qatarHour < 12 ? "Good morning, investor." : qatarHour < 18 ? "Good afternoon, investor." : "Good evening, investor.";

  const { isReady, symbols, membershipIntervals } = useTrackedPortfolio();
  const newsArticles = useNewsArticles();
  const tracked = isReady ? symbols.map((symbol) => demoSecurities.find((security) => security.symbol === symbol)).filter((item) => item !== undefined) : [];
  const trackedNewsCount = newsArticles.filter((article) => tracked.some((security) => security.id === article.securityId)).length;
  const index = calculateEqualWeightedIndex(Object.values(demoSecuritySeries), membershipIntervals);
  const latestIndexPoint = [...index].reverse().find((point) => point.value !== null);
  const last = latestIndexPoint?.value ?? null;
  const change = last === null ? null : last - 100;
  const indexStatus = change === null
    ? !isReady ? "Restoring tracked list" : tracked.length ? "No history for current selection" : "Add stocks to build index"
    : (change >= 0 ? "+" : "") + change.toFixed(2) + "% · from base · as of " + (latestIndexPoint?.date ?? "—");

  return (
    <>
      <PageHeading eyebrow={qatarDate && qatarTime ? qatarDate + " · " + qatarTime + " AST · Research workspace" : "Research workspace"} title={greeting} description="A clear view of your market research, tracked stocks, and the signals worth a closer look." action={<Link href="/discover" className="button-primary"><Search size={15} /> Discover stocks</Link>} />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <DemoBadge>DEMO DATA · SYNTHETIC</DemoBadge>
        <span className="text-[11px] text-muted">Illustrative values only · not live market data</span>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tracked-stock index" value={last === null ? "—" : last.toFixed(2) + " pts"} change={indexStatus} tone={change === null ? "neutral" : change >= 0 ? "positive" : "negative"} icon={<BriefcaseBusiness size={17} />} />
        <MetricCard label="Stocks tracked" value={isReady ? String(tracked.length).padStart(2, "0") : "—"} change={isReady ? "Manual selection" : "Restoring list…"} tone="neutral" icon={<WalletCards size={17} />} />
        <MetricCard label="News coverage" value={String(trackedNewsCount).padStart(2, "0")} change="Illustrative items" tone="neutral" icon={<Globe2 size={17} />} />
        <MetricCard label="Research readiness" value="Demo mode" change="Live quotes unavailable in this demo" tone="neutral" icon={<Sparkles size={17} />} />
      </section>

      <section className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.85fr)]">
        <div className="panel panel-pad">
          <SectionHeading title="Market overview" detail="Indexed synthetic history · base 100" action={<button className="button-secondary !min-h-8 !px-2.5 text-[10px]"><CalendarDays size={13} /> 3M view</button>} />
          <div className="mb-1 flex items-end gap-3">
            <span className="metric-value">102.8</span><span className="mb-1 text-[11px] font-semibold text-positive">+2.8% demo period</span>
          </div>
          <MarketChart data={demoMarketHistory} height={255} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[10px] text-muted">
            <span>Sample composite · synthetic series · no exchange source</span><span>Currency conversion not represented</span>
          </div>
        </div>

        <div className="panel panel-pad">
          <SectionHeading title="Market snapshots" detail="Illustrative index levels" action={<span className="text-[10px] font-semibold text-positive">DEMO</span>} />
          <div className="space-y-1">
            {marketIndices.map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-3 rounded-xl px-2 py-3 hover:bg-surface-muted">
                <div><p className="text-[12px] font-semibold text-ink">{item.name}</p><p className="mt-1 text-[10px] text-muted">{item.venue}</p></div>
                <div className="text-right"><p className="text-[12px] font-semibold text-ink">{item.value}</p><p className={`mt-1 inline-flex items-center gap-0.5 text-[10px] font-semibold ${item.positive ? "text-positive" : "text-negative"}`}>{item.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{item.change}</p></div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-brand-light p-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-brand"><CircleDollarSign size={14} /> Data availability</div>
            <p className="mt-1 text-[10px] leading-relaxed text-ink-soft">This preview uses synthetic values. Production quotes depend on provider coverage and data rights.</p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
        <div className="panel panel-pad">
          <SectionHeading title="Your tracked stocks" detail="A research list, not a record of owned holdings" action={<Link href="/portfolio" className="inline-flex items-center gap-1 text-[11px] font-bold text-positive">View portfolio <ChevronRight size={14} /></Link>} />
          {!isReady ? <div className="rounded-xl border border-dashed border-line bg-surface-muted p-7 text-center text-xs text-muted" role="status">Restoring your tracked-stock list…</div> : tracked.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-surface-muted p-7 text-center"><p className="text-sm font-semibold text-ink">Your demo list is empty</p><p className="mt-1 text-xs text-muted">Add a stock to see its research snapshot here.</p><Link className="button-primary mt-4" href="/discover">Browse stocks</Link></div>
          ) : (
            <div className="divide-y divide-line">
              {tracked.slice(0, 5).map((security) => (
                <Link href={`/discover/${security.symbol}`} key={security.id} className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1">
                  <div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-light text-[10px] font-bold text-brand">{security.symbol.slice(0, 2)}</span><div className="min-w-0"><p className="truncate text-[12px] font-semibold text-ink">{security.name}</p><p className="mt-0.5 text-[10px] text-muted">{security.symbol} · {security.exchange}</p></div></div>
                  <div className="shrink-0 text-right"><p className="text-[12px] font-semibold text-ink">{money(security.price, security.currency)}</p><p className={`mt-0.5 text-[10px] font-semibold ${security.changePercent >= 0 ? "text-positive" : "text-negative"}`}>{security.changePercent >= 0 ? "+" : ""}{security.changePercent.toFixed(2)}% · demo</p></div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="panel panel-pad"><CompanyNewsWorkspace securities={tracked} compact /></div>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl bg-[#153847] p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-xl"><p className="eyebrow !text-[#9ab4bb]">Portfolio intelligence preview</p><h2 className="mt-2 text-lg font-semibold tracking-tight">More context for the stocks you follow.</h2><p className="mt-2 text-xs leading-relaxed text-[#c3d2d4]">See local-currency price movement, equal-weighted performance, sector mix, news coverage and ESG context—without implying personal investment returns.</p></div>
          <Link href="/portfolio" className="button-primary !bg-[#8ce0ba] !text-[#123a36] hover:!bg-[#a6e9cb]">Open tracked portfolio <ArrowRight size={15} /></Link>
        </div>
      </section>
    </>
  );
}
