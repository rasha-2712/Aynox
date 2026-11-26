"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, RotateCcw, Search } from "lucide-react";
import { DemoBadge } from "@/components/demo-badge";
import { PageHeading } from "@/components/page-heading";
import { TrackStockButton } from "@/components/track-stock-button";
import { demoSecurities } from "@/lib/data/demo-data";
import { hasActiveFilters, searchSecurities, type DiscoveryFilters } from "@/lib/discovery/search-securities";

const money = (value: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
const initialFilters: DiscoveryFilters = { query: "", exchange: "All exchanges", sector: "All sectors", country: "All countries" };

export default function DiscoverPage() {
  const [filters, setFilters] = useState(initialFilters);
  const exchanges = ["All exchanges", ...Array.from(new Set(demoSecurities.map((item) => item.exchange))).sort()];
  const sectors = ["All sectors", ...Array.from(new Set(demoSecurities.map((item) => item.sector))).sort()];
  const countries = ["All countries", ...Array.from(new Set(demoSecurities.map((item) => item.country))).sort()];
  const filtered = useMemo(() => searchSecurities(demoSecurities, filters), [filters]);

  function setFilter(key: keyof DiscoveryFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <PageHeading eyebrow="Explore markets" title="Discover stocks" description="Search the illustrative security universe and add companies to your manual research list." action={<DemoBadge>DEMO UNIVERSE</DemoBadge>} />
      <div className="mb-5 rounded-xl border border-warning/20 bg-warning-soft px-4 py-3 text-[11px] leading-relaxed text-[#755c2c]">Demo data only: prices and daily changes are simulated, not current market quotes. This preview is not investment advice.</div>

      <section className="panel panel-pad">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="relative sm:col-span-2 xl:col-span-1"><span className="sr-only">Search company, ticker, or exchange</span><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input-control input-control-with-icon" value={filters.query} onChange={(event) => setFilter("query", event.target.value)} placeholder="Company, ticker or exchange" /></label>
          <label><span className="sr-only">Filter by exchange</span><select className="input-control" value={filters.exchange} onChange={(event) => setFilter("exchange", event.target.value)}>{exchanges.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span className="sr-only">Filter by sector</span><select className="input-control" value={filters.sector} onChange={(event) => setFilter("sector", event.target.value)}>{sectors.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span className="sr-only">Filter by country</span><select className="input-control" value={filters.country} onChange={(event) => setFilter("country", event.target.value)}>{countries.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
          <div><h2 className="section-title">Supported demo securities</h2><p className="mt-1 text-[10px] text-muted">{filtered.length} illustrative listings · coverage is not global</p></div>
          <div className="flex items-center gap-3"><span className="eyebrow">Provider: mock</span>{hasActiveFilters(filters) && <button className="inline-flex items-center gap-1 text-[10px] font-bold text-brand" onClick={() => setFilters(initialFilters)}><RotateCcw size={12} /> Clear filters</button>}</div>
        </div>

        {filtered.length ? <ul className="divide-y divide-line">
          {filtered.map((security) => {
            const positive = security.changePercent >= 0;
            return <li key={security.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-light text-[10px] font-bold text-brand">{security.symbol.slice(0, 2)}</span>
                <div className="min-w-0"><Link href={`/discover/${security.symbol}`} className="block truncate text-[12px] font-semibold text-ink hover:text-positive">{security.name}</Link><p className="mt-0.5 text-[10px] text-muted">{security.symbol} · {security.exchange} · {security.country}</p><p className="mt-1 text-[10px] text-muted">{security.sector} · {security.currency}</p></div>
              </div>
              <div className="flex items-center justify-between gap-4 pl-[52px] sm:justify-end sm:pl-0">
                <div className="text-right"><p className="text-[12px] font-semibold text-ink">{money(security.price, security.currency)}</p><p className={`mt-1 text-[10px] font-bold ${positive ? "text-positive" : "text-negative"}`}>{positive ? <ArrowUpRight size={12} className="mr-0.5 inline" /> : <ArrowDownRight size={12} className="mr-0.5 inline" />}{positive ? "+" : ""}{security.changePercent.toFixed(2)}% <span className="font-medium text-muted">· demo</span></p></div>
                <TrackStockButton symbol={security.symbol} compact />
              </div>
            </li>;
          })}
        </ul> : <div className="py-12 text-center"><p className="text-sm font-semibold text-ink">No matching demo securities</p><p className="mt-1 text-xs text-muted">Try another search or clear your filters.</p></div>}
      </section>
      <p className="mt-4 text-[10px] leading-relaxed text-muted">Aynox tracks selected symbols for research only. This demo does not record ownership, quantities, purchase prices, cost basis, or actual gains and losses.</p>
    </>
  );
}
