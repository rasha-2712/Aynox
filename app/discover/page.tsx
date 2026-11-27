"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, RotateCcw, Search } from "lucide-react";
import { DemoBadge } from "@/components/demo-badge";
import { PageHeading } from "@/components/page-heading";
import { TrackStockButton } from "@/components/track-stock-button";
import { demoSecurities } from "@/lib/data/demo-data";
import { hasActiveFilters, searchSecurities, type DiscoveryFilters } from "@/lib/discovery/search-securities";
import { buildDiscoverHref, buildSecurityHref, discoveryFiltersFromParams } from "@/lib/discovery/routes";
import { useLocale } from "@/components/locale-provider";

export default function DiscoverPage() {
  return <Suspense fallback={<DiscoveryFallback />}><DiscoverContent /></Suspense>;
}

function DiscoveryFallback() {
  const { t } = useLocale();
  return <div className="panel panel-pad text-sm text-muted" role="status">{t("Loading discovery…")}</div>;
}

function DiscoverContent() {
  const { t, formatCurrency, formatNumber } = useLocale();
  const searchParams = useSearchParams();
  const filters = discoveryFiltersFromParams(new URLSearchParams(searchParams.toString()));
  const exchanges = ["All exchanges", ...Array.from(new Set(demoSecurities.map((item) => item.exchange))).sort()];
  const sectors = ["All sectors", ...Array.from(new Set(demoSecurities.map((item) => item.sector))).sort()];
  const countries = ["All countries", ...Array.from(new Set(demoSecurities.map((item) => item.country))).sort()];
  const filtered = useMemo(() => searchSecurities(demoSecurities, filters), [filters]);

  function setFilter(key: keyof DiscoveryFilters, value: string) {
    const next = { ...filters, [key]: value };
    window.history.replaceState(null, "", buildDiscoverHref(next));
  }

  return (
    <>
      <PageHeading eyebrow="Explore markets" title="Discover stocks" description="Search the illustrative security universe and add companies to your manual research list." action={<DemoBadge>DEMO UNIVERSE</DemoBadge>} />
      <div className="mb-5 rounded-xl border border-warning/20 bg-warning-soft px-4 py-3 text-[11px] leading-relaxed text-[#755c2c]">{t("Demo data only: prices and daily changes are simulated, not current market quotes. This preview is not investment advice.")}</div>

      <section className="panel panel-pad">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="relative sm:col-span-2 xl:col-span-1"><span className="sr-only">{t("Search company, ticker, or exchange")}</span><Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input-control input-control-with-icon" value={filters.query} onChange={(event) => setFilter("query", event.target.value)} placeholder={t("Company, ticker or exchange")} /></label>
          <label><span className="sr-only">{t("Filter by exchange")}</span><select className="input-control" value={filters.exchange} onChange={(event) => setFilter("exchange", event.target.value)}>{exchanges.map((item) => <option key={item} value={item}>{t(item)}</option>)}</select></label>
          <label><span className="sr-only">{t("Filter by sector")}</span><select className="input-control" value={filters.sector} onChange={(event) => setFilter("sector", event.target.value)}>{sectors.map((item) => <option key={item} value={item}>{t(item)}</option>)}</select></label>
          <label><span className="sr-only">{t("Filter by country")}</span><select className="input-control" value={filters.country} onChange={(event) => setFilter("country", event.target.value)}>{countries.map((item) => <option key={item} value={item}>{t(item)}</option>)}</select></label>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
          <div><h2 className="section-title">{t("Supported demo securities")}</h2><p className="mt-1 text-[10px] text-muted" aria-live="polite" aria-atomic="true">{t("{count} illustrative listings · coverage is not global", { count: formatNumber(filtered.length) })}</p></div>
          <div className="flex items-center gap-3"><span className="eyebrow">{t("Provider: mock")}</span>{hasActiveFilters(filters) && <button type="button" className="inline-flex items-center gap-1 text-[10px] font-bold text-brand" onClick={() => window.history.replaceState(null, "", buildDiscoverHref())}><RotateCcw size={12} /> {t("Clear filters")}</button>}</div>
        </div>

        {filtered.length ? <ul className="divide-y divide-line">
          {filtered.map((security) => {
            const positive = security.changePercent >= 0;
            return <li key={security.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-light text-[10px] font-bold text-brand">{security.symbol.slice(0, 2)}</span>
                <div className="min-w-0"><Link href={buildSecurityHref(security.symbol, filters)} className="block truncate text-[12px] font-semibold text-ink hover:text-positive">{security.name}</Link><p className="mt-0.5 text-[10px] text-muted"><bdi>{security.symbol}</bdi> · {t(security.exchange)} · {t(security.country)}</p><p className="mt-1 text-[10px] text-muted">{t(security.sector)} · <bdi>{security.currency}</bdi></p></div>
              </div>
              <div className="flex items-center justify-between gap-4 ps-[52px] sm:justify-end sm:ps-0">
                <div className="text-end"><p className="text-[12px] font-semibold text-ink financial-value" dir="ltr">{formatCurrency(security.price, security.currency)}</p><p className={`mt-1 text-[10px] font-bold ${positive ? "text-positive" : "text-negative"}`}><span className="financial-value" dir="ltr">{positive ? <ArrowUpRight size={12} className="me-0.5 inline" /> : <ArrowDownRight size={12} className="me-0.5 inline" />}{positive ? "+" : ""}{formatNumber(security.changePercent, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span> <span className="font-medium text-muted">· {t("demo")}</span></p></div>
                <TrackStockButton symbol={security.symbol} compact />
              </div>
            </li>;
          })}
        </ul> : <div className="py-12 text-center" role="status" aria-live="polite"><p className="text-sm font-semibold text-ink">{t("No matching demo securities")}</p><p className="mt-1 text-xs text-muted">{t("Try another search or clear your filters.")}</p></div>}
      </section>
      <p className="mt-4 text-[10px] leading-relaxed text-muted">{t("Aynox tracks selected symbols for research only. This demo does not record ownership, quantities, purchase prices, cost basis, or actual gains and losses.")}</p>
    </>
  );
}
