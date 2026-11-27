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
import { useLocale } from "@/components/locale-provider";

export default function ResearchPage() {
  const { t, formatCurrency, formatNumber } = useLocale();
  const [symbol, setSymbol] = useState("NVDA");
  const security = useMemo(() => demoSecurities.find((item) => item.symbol === symbol) ?? demoSecurities[0], [symbol]);
  const esg = demoESG[security.symbol];
  const chart = demoSecuritySeries[security.symbol]?.points.map(({ date, price }) => ({ date, value: price })) ?? [];
  const articles = filterNewsArticles(useNewsArticles(), { companySecurityId: security.id });
  const sentiment = calculateSentimentDistribution(articles);
  const sentimentLabel = t(sentiment.ambiguous ? "Ambiguous evidence" : sentiment.insufficient ? "Insufficient evidence" : sentiment.positive && sentiment.negative ? "Mixed" : sentiment.positive ? "Positive" : sentiment.negative ? "Negative" : "Neutral");

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
        <div className="flex items-center gap-3"><span className="financial-value grid h-10 w-10 place-items-center rounded-xl bg-brand-light text-xs font-bold text-brand" dir="ltr">{security.symbol.slice(0, 2)}</span><div><p className="text-[13px] font-bold text-ink">{security.name}</p><p className="mt-1 text-[10px] text-muted"><bdi>{security.symbol}</bdi> · {t(security.exchange)} · <bdi>{security.currency}</bdi></p></div></div>
        <label className="flex items-center gap-2 text-[10px] font-semibold text-muted">{t("Select company")} <span className="relative"><select className="input-control !w-64 max-w-[55vw] appearance-none pe-8" value={symbol} onChange={(event) => setSymbol(event.target.value)}>{demoSecurities.map((item) => <option value={item.symbol} key={item.symbol}>{item.symbol} · {item.name}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2" /></span></label>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(275px,.72fr)]">
        <div className="panel panel-pad">
          <SectionHeading title="Company overview" detail="Illustrative company profile · not verified company data" />
          <p className="text-[12px] leading-relaxed text-ink-soft">{t(security.description)} {t("This profile is synthetic demo content and has not been reviewed as investment research.")}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-surface-muted p-3"><p className="metric-label">{t("Demo price")}</p><p className="financial-value mt-2 text-[14px] font-bold text-ink" dir="ltr">{formatCurrency(security.price, security.currency)}</p></div>
            <div className="rounded-xl bg-surface-muted p-3"><p className="metric-label">{t("Daily move")}</p><p className={`financial-value mt-2 flex items-center text-[14px] font-bold ${security.changePercent >= 0 ? "text-positive" : "text-negative"}`} dir="ltr">{security.changePercent >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{security.changePercent >= 0 ? "+" : ""}{formatNumber(security.changePercent, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</p></div>
            <div className="rounded-xl bg-surface-muted p-3"><p className="metric-label">{t("Market cap")}</p><p className="financial-value mt-2 text-[14px] font-bold text-ink" dir="ltr">{security.marketCap}</p></div>
            <div className="rounded-xl bg-surface-muted p-3"><p className="metric-label">{t("P/E · demo")}</p><p className="financial-value mt-2 text-[14px] font-bold text-ink" dir="ltr">{formatNumber(security.peRatio)}</p></div>
          </div>
          <div className="mt-5 flex items-center justify-between"><h3 className="section-title">{t("Price history")}</h3><span className="eyebrow"><CalendarDays size={11} className="me-1 inline" />{t("Illustrative series")}</span></div>
          <div className="mt-3"><MarketChart data={chart} height={225} prefix={security.currency + " "} accessibleLabel={t("{company} historical price chart in {currency}", { company: security.name, currency: security.currency })} accessibleDescription={t("Synthetic company prices in {currency}; illustrative values, not historical exchange prices.", { currency: security.currency })} /></div>
          <p className="mt-2 text-[9px] text-muted">{t("Synthetic historical series · local currency · no provider or exchange data")}</p>
        </div>

        <div className="panel panel-pad">
          <SectionHeading title="Research summary" detail="Descriptive only · demo" />
          <div className="rounded-xl bg-positive-soft p-4">
            <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-positive">{t("Synthetic sentiment")}</span><Sparkles size={15} className="text-positive" /></div>
            <p className="mt-3 text-2xl font-bold text-ink">{sentimentLabel}</p>
            <p className="mt-1 text-[10px] text-muted">{t("Illustrative article tone · not a price signal")}</p>
            <div aria-hidden="true" className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-white"><span className="bg-positive" style={{ width: `${sentiment.total ? sentiment.positive / sentiment.total * 100 : 0}%` }} /><span className="bg-negative" style={{ width: `${sentiment.total ? sentiment.negative / sentiment.total * 100 : 0}%` }} /><span className="bg-muted" style={{ width: `${sentiment.total ? sentiment.neutral / sentiment.total * 100 : 0}%` }} /><span className="bg-warning" style={{ width: `${sentiment.total ? sentiment.ambiguous / sentiment.total * 100 : 0}%` }} /><span className="bg-line" style={{ width: `${sentiment.total ? sentiment.insufficient / sentiment.total * 100 : 0}%` }} /></div>
            <div className="mt-2 flex flex-wrap justify-between gap-1 text-[9px] text-muted"><span>{formatNumber(sentiment.positive)} {t("positive")} · {formatNumber(sentiment.negative)} {t("negative")} · {formatNumber(sentiment.neutral)} {t("neutral")} · {formatNumber(sentiment.ambiguous)} {t("ambiguous")} · {formatNumber(sentiment.insufficient)} {t("insufficient")}</span><span>{t("{count} canonical demo stories", { count: formatNumber(sentiment.total) })}</span></div>
          </div>
          <div className="mt-3 rounded-xl border border-line p-4">
            <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-muted">{t("ESG preview")}</span><Leaf size={15} className="text-positive" /></div>
            <div className="mt-3 flex items-end justify-between"><span className="financial-value text-3xl font-bold text-ink" dir="ltr">{esg?.score ?? "—"}</span><span className="text-[10px] font-semibold text-muted">{esg ? t(esg.label) : t("No demo score")}</span></div>
            <p className="mt-2 text-[10px] text-muted">{esg ? t(esg.source) : ""} · {esg ? t(esg.coverage) : ""} · {esg ? t(esg.asOf) : ""}</p>
            <p className="mt-2 text-[9px] leading-relaxed text-muted">{t("Illustrative values do not represent a verified ESG rating or comparable provider score.")}</p>
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
            <p className="mt-3 text-[13px] font-bold text-ink">{t("Forecasting coming soon")}</p>
            <p className="mt-2 max-w-xs text-[10px] leading-relaxed text-muted">{t("Forecasts will appear only after chronological out-of-sample evaluation, baseline comparison, uncertainty reporting, and an approved release gate.")}</p>
            <span className="mt-4 rounded-full border border-line bg-white px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-muted">{t("Not available in demo")}</span>
          </div>
          <Link href="/portfolio" className="mt-4 inline-flex items-center gap-1 text-[10px] font-bold text-positive">{t("See tracked-stock methodology")} <ArrowRight className="directional-icon" size={12} /></Link>
        </div>
      </section>
    </>
  );
}
