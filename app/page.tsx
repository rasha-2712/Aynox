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
import { useLocale } from "@/components/locale-provider";

export default function DashboardPage() {
  const { t, formatCurrency, formatDate, formatNumber } = useLocale();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const updateClock = () => setNow(new Date());
    updateClock();
    const interval = window.setInterval(updateClock, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const qatarDate = now
    ? formatDate(now, { timeZone: "Asia/Qatar", weekday: "long", day: "numeric", month: "short", year: "numeric" })
    : null;
  const qatarTime = now
    ? formatDate(now, { timeZone: "Asia/Qatar", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    : null;
  const qatarHour = now
    ? Number(new Intl.DateTimeFormat("en-GB-u-nu-latn", { timeZone: "Asia/Qatar", hour: "2-digit", hourCycle: "h23" }).format(now))
    : null;
  const greeting = t(qatarHour === null ? "Welcome, investor." : qatarHour < 12 ? "Good morning, investor." : qatarHour < 18 ? "Good afternoon, investor." : "Good evening, investor.");
  const workspaceHeading = qatarDate && qatarTime ? `${qatarDate} · ${qatarTime} AST · ${t("Research workspace")}` : t("Research workspace");

  const { isReady, symbols, membershipIntervals } = useTrackedPortfolio();
  const newsArticles = useNewsArticles();
  const tracked = isReady ? symbols.map((symbol) => demoSecurities.find((security) => security.symbol === symbol)).filter((item) => item !== undefined) : [];
  const trackedNewsCount = newsArticles.filter((article) => tracked.some((security) => security.id === article.securityId)).length;
  const index = calculateEqualWeightedIndex(Object.values(demoSecuritySeries), membershipIntervals);
  const latestIndexPoint = [...index].reverse().find((point) => point.value !== null);
  const last = latestIndexPoint?.value ?? null;
  const change = last === null ? null : last - 100;
  const indexStatus = change === null
    ? !isReady ? t("Restoring tracked list") : tracked.length ? t("No history for current selection") : t("Add stocks to build index")
    : (change >= 0 ? "+" : "") + formatNumber(change, { maximumFractionDigits: 2 }) + "% · " + t("from base · as of {date}", { date: latestIndexPoint?.date ?? "—" });

  return (
    <>
      <PageHeading eyebrow={workspaceHeading} title={greeting} description="A clear view of your market research, tracked stocks, and the signals worth a closer look." action={<Link href="/discover" className="button-primary"><Search size={15} /> {t("Discover stocks")}</Link>} />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <DemoBadge>DEMO DATA · SYNTHETIC</DemoBadge>
        <span className="text-[11px] text-muted">{t("Illustrative values only · not live market data")}</span>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={t("Tracked-stock index")} value={last === null ? "—" : `${formatNumber(last, { maximumFractionDigits: 2 })} ${t("pts")}`} change={indexStatus} tone={change === null ? "neutral" : change >= 0 ? "positive" : "negative"} icon={<BriefcaseBusiness size={17} />} />
        <MetricCard label={t("Stocks tracked")} value={isReady ? formatNumber(tracked.length, { minimumIntegerDigits: 2 }) : "—"} change={isReady ? t("Manual selection") : t("Restoring list…")} tone="neutral" icon={<WalletCards size={17} />} />
        <MetricCard label={t("News coverage")} value={formatNumber(trackedNewsCount, { minimumIntegerDigits: 2 })} change={t("Illustrative items")} tone="neutral" icon={<Globe2 size={17} />} />
        <MetricCard label={t("Research readiness")} value={t("Demo mode")} change={t("Live quotes unavailable in this demo")} tone="neutral" icon={<Sparkles size={17} />} />
      </section>

      <section className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.85fr)]">
        <div className="panel panel-pad">
          <SectionHeading title="Market overview" detail="Indexed synthetic history · base 100" action={<button type="button" className="button-secondary !min-h-8 !px-2.5 text-[10px]"><CalendarDays size={13} /> {t("3M view")}</button>} />
          <div className="mb-1 flex items-end gap-3">
            <span className="metric-value financial-value">{formatNumber(102.8, { maximumFractionDigits: 1 })}</span><span className="mb-1 text-[11px] font-semibold text-positive financial-value">+{formatNumber(2.8, { maximumFractionDigits: 1 })}% {t("demo period")}</span>
          </div>
          <MarketChart data={demoMarketHistory} height={255} accessibleLabel={t("Dashboard market overview chart")} accessibleDescription={t("Synthetic indexed market series with a base value of 100; not exchange data.")} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[10px] text-muted">
            <span>{t("Sample composite · synthetic series · no exchange source")}</span><span>{t("Currency conversion not represented")}</span>
          </div>
        </div>

        <div className="panel panel-pad">
          <SectionHeading title="Market snapshots" detail="Illustrative index levels" action={<span className="text-[10px] font-semibold text-positive">{t("DEMO")}</span>} />
          <div className="space-y-1">
            {marketIndices.map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-3 rounded-xl px-2 py-3 hover:bg-surface-muted">
                <div><p className="text-[12px] font-semibold text-ink financial-value" dir="ltr">{item.name}</p><p className="mt-1 text-[10px] text-muted">{t(item.venue)}</p></div>
                <div className="text-end"><p className="text-[12px] font-semibold text-ink financial-value" dir="ltr">{item.value}</p><p className={`mt-1 inline-flex items-center gap-0.5 text-[10px] font-semibold financial-value ${item.positive ? "text-positive" : "text-negative"}`} dir="ltr">{item.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{item.change}</p></div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-brand-light p-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-brand"><CircleDollarSign size={14} /> {t("Data availability")}</div>
            <p className="mt-1 text-[10px] leading-relaxed text-ink-soft">{t("This preview uses synthetic values. Production quotes depend on provider coverage and data rights.")}</p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
        <div className="panel panel-pad">
          <SectionHeading title="Your tracked stocks" detail="A research list, not a record of owned holdings" action={<Link href="/portfolio" className="inline-flex items-center gap-1 text-[11px] font-bold text-positive">{t("View portfolio")} <ChevronRight size={14} /></Link>} />
          {!isReady ? <div className="rounded-xl border border-dashed border-line bg-surface-muted p-7 text-center text-xs text-muted" role="status">{t("Restoring your tracked-stock list…")}</div> : tracked.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-surface-muted p-7 text-center"><p className="text-sm font-semibold text-ink">{t("Your demo list is empty")}</p><p className="mt-1 text-xs text-muted">{t("Add a stock to see its research snapshot here.")}</p><Link className="button-primary mt-4" href="/discover">{t("Browse stocks")}</Link></div>
          ) : (
            <div className="divide-y divide-line">
              {tracked.slice(0, 5).map((security) => (
                <Link href={`/discover/${security.symbol}`} key={security.id} className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1">
                  <div className="flex min-w-0 items-center gap-3"><span className="financial-value grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-light text-[10px] font-bold text-brand" dir="ltr">{security.symbol.slice(0, 2)}</span><div className="min-w-0"><p className="truncate text-[12px] font-semibold text-ink">{security.name}</p><p className="mt-0.5 text-[10px] text-muted"><bdi>{security.symbol}</bdi> · {t(security.exchange)}</p></div></div>
                  <div className="shrink-0 text-end"><p className="text-[12px] font-semibold text-ink financial-value" dir="ltr">{formatCurrency(security.price, security.currency)}</p><p className={`mt-0.5 text-[10px] font-semibold financial-value ${security.changePercent >= 0 ? "text-positive" : "text-negative"}`} dir="ltr">{security.changePercent >= 0 ? "+" : ""}{formatNumber(security.changePercent, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% · {t("demo")}</p></div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="panel panel-pad"><CompanyNewsWorkspace securities={tracked} compact /></div>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl bg-[#153847] p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-xl"><p className="eyebrow !text-[#9ab4bb]">{t("Portfolio intelligence preview")}</p><h2 className="mt-2 text-lg font-semibold tracking-tight">{t("More context for the stocks you follow.")}</h2><p className="mt-2 text-xs leading-relaxed text-[#c3d2d4]">{t("See local-currency price movement, equal-weighted performance, sector mix, news coverage and ESG context—without implying personal investment returns.")}</p></div>
          <Link href="/portfolio" className="button-primary !bg-[#8ce0ba] !text-[#123a36] hover:!bg-[#a6e9cb]">{t("Open tracked portfolio")} <ArrowRight className="directional-icon" size={15} /></Link>
        </div>
      </section>
    </>
  );
}
