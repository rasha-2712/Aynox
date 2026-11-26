"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Info, Plus } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { DemoBadge } from "@/components/demo-badge";
import { MarketChart } from "@/components/market-chart";
import { PageHeading } from "@/components/page-heading";
import { RemoveStockButton } from "@/components/track-stock-button";
import { SectionHeading } from "@/components/section-heading";
import { TrackedNewsOverview } from "@/components/news/news-intelligence";
import { useTrackedPortfolio } from "@/components/portfolio-provider";
import { demoSecurities, demoSecuritySeries } from "@/lib/data/demo-data";
import { calculateEqualWeightedIndex } from "@/lib/portfolio/calculate-index";
import type { IndexPoint } from "@/types/market";

const COLORS = ["#17845f", "#397b8b", "#8f7a47", "#7697a5", "#9a6c70", "#7d8d5d"];
const money = (value: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
type Period = "1M" | "3M" | "6M" | "1Y";
const periodMonths: Record<Period, number> = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12 };

function filterPeriod(index: IndexPoint[], period: Period): IndexPoint[] {
  const lastDate = index.at(-1)?.date;
  if (!lastDate) return [];
  const cutoff = new Date(`${lastDate}T00:00:00.000Z`);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - periodMonths[period]);
  return index.filter((point) => new Date(`${point.date}T00:00:00.000Z`) >= cutoff);
}

export default function PortfolioPage() {
  const { isReady, symbols, events, membershipIntervals, addSymbol } = useTrackedPortfolio();
  const [addChoice, setAddChoice] = useState("");
  const [period, setPeriod] = useState<Period>("3M");
  const tracked = symbols.map((symbol) => demoSecurities.find((security) => security.symbol === symbol)).filter((item) => item !== undefined);
  const index = useMemo(() => calculateEqualWeightedIndex(Object.values(demoSecuritySeries), membershipIntervals), [membershipIntervals]);
  const chartData = filterPeriod(index, period).map(({ date, value }) => ({ date, value }));
  const latest = index.at(-1);
  const previous = index.at(-2);
  const dailyMove = latest?.value !== null && latest?.value !== undefined && previous?.value !== null && previous?.value !== undefined
    ? (latest.value / previous.value - 1) * 100
    : null;
  const coverage = latest && latest.total > 0 ? latest.eligible / latest.total * 100 : null;
  const available = demoSecurities.filter((security) => !symbols.includes(security.symbol));
  const sectorData = useMemo(() => {
    const counts = new Map<string, number>();
    tracked.forEach((security) => counts.set(security.sector, (counts.get(security.sector) ?? 0) + 1));
    const total = tracked.length || 1;
    return Array.from(counts, ([name, count]) => ({ name, value: count / total * 100 }));
  }, [tracked]);
  const recentEvents = [...events].sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt)).slice(0, 8);

  function addSelected() {
    if (!addChoice) return;
    addSymbol(addChoice);
    setAddChoice("");
  }

  return <>
    <PageHeading eyebrow="Manual tracking" title="Tracked portfolio" description="Analyze the stocks you choose to follow, individually and as a synthetic equal-weighted index." action={<DemoBadge>MOCK DATA</DemoBadge>} />
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-brand/10 bg-brand-light px-4 py-3 text-[11px] leading-relaxed text-ink-soft"><Info size={16} className="mt-0.5 shrink-0 text-brand" /><p><strong className="text-ink">Research set, not account holdings.</strong> The index starts at 100, averages eligible constituent daily price returns in each stock’s local currency, excludes FX and cash dividends, and is not actual personal investment performance.</p></div>

    {!isReady ? <div className="panel panel-pad text-sm text-muted" role="status">Restoring your tracked-stock list…</div> : <>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <div className="panel p-4"><p className="metric-label">Synthetic index level</p><p className="metric-value mt-2">{latest?.value === null || latest?.value === undefined ? "—" : latest.value.toFixed(2)}</p><p className="mt-2 text-[10px] text-muted">Base 100 · unitless · demo</p></div>
        <div className="panel p-4"><p className="metric-label">Daily index movement</p><p className={`metric-value mt-2 ${dailyMove === null ? "text-muted" : dailyMove >= 0 ? "text-positive" : "text-negative"}`}>{dailyMove === null ? "—" : `${dailyMove >= 0 ? "+" : ""}${dailyMove.toFixed(2)}%`}</p><p className="mt-2 text-[10px] text-muted">Price return · local currency</p></div>
        <div className="panel p-4"><p className="metric-label">Stocks tracked</p><p className="metric-value mt-2">{tracked.length}</p><p className="mt-2 text-[10px] text-muted">Manual selection</p></div>
        <div className="panel p-4"><p className="metric-label">Eligible constituents</p><p className="metric-value mt-2">{latest?.eligible ?? 0}<span className="ml-1 text-sm text-muted">/ {latest?.total ?? 0}</span></p><p className="mt-2 text-[10px] text-muted">Latest demo interval</p></div>
        <div className="panel p-4"><p className="metric-label">Price coverage</p><p className="metric-value mt-2">{coverage === null ? "—" : `${coverage.toFixed(0)}%`}</p><p className="mt-2 text-[10px] text-muted">Valid / active interval prices</p></div>
      </section>

      <section className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(270px,.7fr)]">
        <div className="panel panel-pad">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3"><SectionHeading title="Tracked-stock index history" detail="Synthetic price-return index · no FX conversion" action={<span className="eyebrow">DEMO SERIES</span>} /><div className="flex rounded-lg border border-line bg-surface-muted p-1" role="group" aria-label="Index chart period">{(["1M", "3M", "6M", "1Y"] as const).map((value) => <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)} className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold ${period === value ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink"}`}>{value}</button>)}</div></div>
          {tracked.length ? <MarketChart data={chartData} height={270} /> : <div className="grid h-[270px] place-items-center rounded-xl border border-dashed border-line bg-surface-muted text-center"><div><p className="text-sm font-semibold text-ink">Your tracked list is empty</p><p className="mt-1 text-xs text-muted">Discover a company to begin a research index.</p><Link className="button-primary mt-4" href="/discover">Discover stocks</Link></div></div>}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-3 text-[10px] text-muted"><span>{tracked.length} tracked · {latest?.eligible ?? 0} eligible at latest interval</span><span>Local-currency returns · FX excluded</span><span>Cash dividends excluded</span></div>
        </div>

        <div className="panel panel-pad"><SectionHeading title="Tracked mix" detail="Equal by tracked-stock count" />{tracked.length ? <><div className="relative mx-auto h-[205px] w-full max-w-[260px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={sectorData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={78} paddingAngle={3} stroke="none">{sectorData.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => [`${Number(value).toFixed(0)}%`, "Tracked-count share"]} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-xl font-bold text-ink">{tracked.length}</span><span className="text-[9px] font-semibold text-muted">STOCKS</span></div></div><div className="space-y-2 border-t border-line pt-3">{sectorData.map((item, index) => <div key={item.name} className="flex items-center justify-between text-[10px]"><span className="flex items-center gap-2 text-ink-soft"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />{item.name}</span><strong className="text-ink">{item.value.toFixed(0)}%</strong></div>)}</div></> : <div className="grid h-[205px] place-items-center text-xs text-muted">No tracked stocks yet.</div>}</div>
      </section>

            <section className="panel panel-pad mt-5"><SectionHeading title="News across tracked companies" detail="Synthetic coverage · article tone is descriptive only" /><TrackedNewsOverview securities={tracked} /></section>

      <section className="panel panel-pad mt-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><SectionHeading title="Tracked stocks" detail="Individual synthetic price movements · no ownership or quantities" /><div className="flex gap-2"><label className="sr-only" htmlFor="add-symbol">Choose a stock to track</label><select id="add-symbol" className="input-control !min-h-9 !w-auto !py-1 text-[11px]" value={addChoice} onChange={(event) => setAddChoice(event.target.value)}><option value="">Add a stock…</option>{available.map((security) => <option key={security.id} value={security.symbol}>{security.symbol} · {security.name}</option>)}</select><button className="button-primary !min-h-9 !px-3 text-[11px]" onClick={addSelected} disabled={!addChoice}><Plus size={13} /> Add</button></div></div>
        {tracked.length ? <div className="divide-y divide-line">{tracked.map((security) => <div key={security.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><Link href={`/discover/${security.symbol}`} className="text-[12px] font-semibold text-ink hover:text-positive">{security.name}<span className="ml-2 text-[10px] font-medium text-muted">{security.symbol}</span></Link><p className="mt-1 text-[10px] text-muted">{security.exchange} · {security.country} · {security.currency} · {security.sector}</p></div><div className="flex items-center gap-4"><div className="text-right"><p className="text-[11px] font-semibold text-ink">{money(security.price, security.currency)}</p><p className={`mt-0.5 text-[10px] font-bold ${security.changePercent >= 0 ? "text-positive" : "text-negative"}`}>{security.changePercent >= 0 ? <ArrowUpRight size={12} className="mr-1 inline" /> : <ArrowDownRight size={12} className="mr-1 inline" />}{security.changePercent >= 0 ? "+" : ""}{security.changePercent.toFixed(2)}% · demo</p></div><span className="hidden text-[10px] text-muted sm:inline">{tracked.length ? `${(100 / tracked.length).toFixed(1)}% count weight` : "—"}</span><RemoveStockButton symbol={security.symbol} /></div></div>)}</div> : <div className="rounded-xl border border-dashed border-line bg-surface-muted p-8 text-center"><p className="text-sm font-semibold text-ink">No stocks are tracked</p><p className="mt-1 text-xs text-muted">Choose a stock above or use discovery to add companies to your research list.</p><Link className="button-primary mt-4" href="/discover">Discover stocks</Link></div>}
      </section>

      <section className="panel panel-pad mt-5"><SectionHeading title="Membership history" detail="Effective add and remove events · retained for historical reconstruction" />{recentEvents.length ? <div className="divide-y divide-line">{recentEvents.map((event) => { const security = demoSecurities.find((item) => item.id === event.securityId); return <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[10px]"><span className="font-semibold text-ink">{event.type === "added" ? "Added" : "Removed"} · {security?.name ?? "Unknown security"} ({security?.symbol ?? event.securityId})</span><time className="text-muted" dateTime={event.effectiveAt}>{new Date(event.effectiveAt).toLocaleString()}</time></div>; })}</div> : <p className="text-xs text-muted">No membership events have been recorded.</p>}</section>

      <section className="mt-5 rounded-xl border border-line bg-surface-muted p-4"><h2 className="flex items-center gap-2 text-[11px] font-bold text-ink"><Info size={14} className="text-brand" /> Methodology and limitations</h2><p className="mt-2 text-[10px] leading-relaxed text-muted">Each index interval averages valid local-currency price returns of members active for that full interval, then compounds from a base of 100. FX and cash dividends are excluded. Missing or invalid prices are excluded, eligible constituents are equally reweighted, and valid/active counts disclose coverage. Add/remove events retain effective timestamps; additions start at the first full interval after their timestamp, while removal excludes the interval containing its timestamp. Historical membership and earlier index values are reconstructed from those events rather than today’s list. Demo observations use weekdays with date-only UTC end-of-day labels. Official exchange holidays, session close times, cross-exchange boundary alignment, and future price refresh are not implemented. This is not actual investment performance.</p></section>
    </>}
  </>;
}
