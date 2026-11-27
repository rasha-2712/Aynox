"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { DemoBadge } from "@/components/demo-badge";
import { useNewsArticles } from "@/components/news-provider";
import { aggregateTrackedCompanyNews, calculateSentimentDistribution, emptyNewsFilters, filterNewsArticles } from "@/lib/news/query";
import { generateCompanyNewsReport } from "@/lib/news/report";
import { formatIllustrativeConfidence } from "@/lib/news/format-confidence";
import { NEWS_CATEGORIES } from "@/types/news";
import type { NewsFilters } from "@/types/news";
import type { Security } from "@/types/market";
import { useLocale } from "@/components/locale-provider";
import { localizeNewsArticle } from "@/lib/i18n/demo-content";

function SentimentBar({ counts }: { counts: ReturnType<typeof calculateSentimentDistribution> }) {
  const { t, formatNumber } = useLocale();
  const total = counts.total || 1;
  return <div><div className="flex h-2 overflow-hidden rounded-full bg-surface-muted" role="img" aria-label={t("{positive} positive, {negative} negative, {neutral} neutral, {ambiguous} ambiguous, {insufficient} insufficient demo articles", Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, formatNumber(value)])))}><span className="bg-positive" style={{ width: `${counts.positive / total * 100}%` }} /><span className="bg-negative" style={{ width: `${counts.negative / total * 100}%` }} /><span className="bg-muted" style={{ width: `${counts.neutral / total * 100}%` }} /><span className="bg-warning" style={{ width: `${counts.ambiguous / total * 100}%` }} /><span className="bg-line" style={{ width: `${counts.insufficient / total * 100}%` }} /></div><p className="mt-2 text-[10px] text-muted">{formatNumber(counts.positive)} {t("positive")} · {formatNumber(counts.negative)} {t("negative")} · {formatNumber(counts.neutral)} {t("neutral")} · {formatNumber(counts.ambiguous)} {t("ambiguous")} · {formatNumber(counts.insufficient)} {t("insufficient")}</p></div>;
}

function ArticleCard({ article }: { article: ReturnType<typeof filterNewsArticles>[number] }) {
  const { t, formatDate, formatNumber } = useLocale();
  const tone = article.sentiment.status === "ambiguous" ? "text-warning bg-warning-soft" : article.sentiment.status === "insufficient-content" ? "text-muted bg-surface-muted" : article.sentiment.label === "Positive" ? "text-positive bg-positive-soft" : article.sentiment.label === "Negative" ? "text-negative bg-negative-soft" : "text-muted bg-surface-muted";
  return <article className="rounded-xl border border-line p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] font-bold text-muted"><bdi>{t(article.sourceName)}</bdi> · <bdi>{article.symbol}</bdi> · {t(article.category)}</span><time dateTime={article.publishedAt} className="text-[10px] text-muted">{formatDate(article.publishedAt, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</time></div>
    <h3 className="mt-2 text-[13px] font-semibold leading-relaxed text-ink">{t(article.headline)}</h3><p className="mt-1 text-[11px] leading-relaxed text-ink-soft">{t(article.summary)}</p>
    <div className="mt-3 flex flex-wrap items-center gap-2"><span className={`rounded-md px-2 py-1 text-[9px] font-bold ${tone}`}>{t(article.sentiment.status === "ambiguous" ? "Ambiguous" : article.sentiment.status === "insufficient-content" ? "Insufficient content" : article.sentiment.label)} · {t("heuristic demo")}</span><span className="rounded-md bg-warning-soft px-2 py-1 text-[9px] font-bold text-warning">{t("FICTIONAL DEMO")}</span><span className="text-[9px] text-muted">{t("Illustrative confidence:")} {formatIllustrativeConfidence(article.sentiment.heuristicConfidence)} · {t("not calibrated")}</span></div>
    <p className="mt-2 text-[10px] leading-relaxed text-muted">{t(article.sentiment.explanation)}</p>{article.duplicateCount > 1 && <p className="mt-1 text-[9px] text-muted">{t("{count} near-duplicate reports represented by this canonical story.", { count: formatNumber(article.duplicateCount) })}</p>}
  </article>;
}

function translateReportRisk(text: string, t: (key: string, values?: Record<string, string | number>) => string) {
  const excluded = text.match(/^(\d+) articles? (?:was|were) excluded because the identifier was missing or malformed\.$/);
  if (excluded) {
    const count = Number(excluded[1]);
    return count === 1 ? t("1 article was excluded because the identifier was missing or malformed.") : t("{count} articles were excluded because the identifier was missing or malformed.", { count });
  }
  return t(text);
}

function CompanyReport({ security, articles }: { security: Security; articles: ReturnType<typeof filterNewsArticles> }) {
  const { t, formatDate, formatNumber } = useLocale();
  const report = generateCompanyNewsReport(security, articles);
  const localizedSummary = report.status === "insufficient-coverage"
    ? t("Insufficient {source} coverage to summarize {company} reliably. {count} articles are available.", { source: t(report.coverage.articleCount ? "synthetic demonstration feed" : "available news data"), company: security.name, count: formatNumber(report.coverage.articleCount) })
    : t("Available from the synthetic demonstration feed: {count} articles for {company} from {from} through {to}.", { count: formatNumber(report.coverage.articleCount), company: security.name, from: report.coverage.from ? formatDate(report.coverage.from, { dateStyle: "short", timeZone: "UTC" }) : "—", to: report.coverage.to ? formatDate(report.coverage.to, { dateStyle: "short", timeZone: "UTC" }) : "—" });
  return <section className="rounded-xl border border-brand/20 bg-brand-light/40 p-4" aria-labelledby="news-report-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">{t("STRUCTURED COMPANY REPORT · DEMONSTRATION ONLY")}</p><h3 id="news-report-title" className="mt-1 text-[14px] font-bold text-ink">{t("news brief")} <bdi>{security.name}</bdi></h3></div><span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-bold text-brand">{t("{count} articles · synthetic", { count: formatNumber(report.coverage.articleCount) })}</span></div>
    <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">{localizedSummary}</p><p className="mt-1 text-[9px] text-muted">{t("Coverage:")} {report.coverage.from ? formatDate(report.coverage.from, { dateStyle: "short", timeZone: "UTC" }) : "—"} {t("to")} {report.coverage.to ? formatDate(report.coverage.to, { dateStyle: "short", timeZone: "UTC" }) : "—"}</p><div className="mt-3"><SentimentBar counts={report.sentimentDistribution} /></div>
    {report.status === "insufficient-coverage" ? <p className="mt-3 rounded-lg bg-white p-3 text-[10px] text-muted">{t("Coverage is too limited for a reliable summary. Check back when more articles are available.")}</p> : <div className="mt-4 grid gap-4 sm:grid-cols-2"><div><h4 className="text-[10px] font-bold uppercase tracking-wide text-ink">{t("Developments in provided stories")}</h4><ul className="mt-2 space-y-2">{report.mostRelevantDevelopments.map((item) => <li key={item.articleId} className="text-[10px] leading-relaxed text-ink-soft"><span className="font-semibold">{t(item.status === "ambiguous" ? "Ambiguous" : item.status === "insufficient-content" ? "Insufficient" : item.sentiment)} · {t(item.category)}:</span> {t(item.scenarioStatement)}</li>)}</ul></div><div><h4 className="text-[10px] font-bold uppercase tracking-wide text-ink">{t("Possible implications · not reported facts")}</h4><ul className="mt-2 space-y-2">{report.possibleImplications.map((item) => <li key={item.articleId} className="text-[10px] leading-relaxed text-ink-soft">{t(item.text)}</li>)}</ul><h4 className="mt-3 text-[10px] font-bold uppercase tracking-wide text-ink">{t("Recurring topics")}</h4><p className="mt-1 text-[10px] text-ink-soft">{report.mainTopics.map((theme) => t(theme.category)).join(" · ") || t("None")}</p></div></div>}
    <p className="mt-3 border-t border-brand/10 pt-3 text-[9px] leading-relaxed text-muted">{report.risksAndUncertainties.map((item) => translateReportRisk(item, t)).join(" ")} {t("Sentiment is informational and is not an investment recommendation or performance prediction.")}</p>
  </section>;
}

export function CompanyNewsWorkspace({ securities, initialSymbol, compact = false }: { securities: Security[]; initialSymbol?: string; compact?: boolean }) {
  const { t, locale } = useLocale();
  const allArticles = useNewsArticles();
  const localizedArticles = useMemo(() => allArticles.map((article) => localizeNewsArticle(article, locale)), [allArticles, locale]);
  const [symbol, setSymbol] = useState(initialSymbol ?? securities[0]?.symbol ?? "");
  const [filters, setFilters] = useState<NewsFilters>(emptyNewsFilters);
  const security = securities.find((item) => item.symbol === symbol) ?? securities[0];
  const companyArticles = useMemo(() => compact ? localizedArticles.filter((article) => securities.some((item) => item.id === article.securityId)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)) : filterNewsArticles(localizedArticles, { ...filters, companySecurityId: security?.id }), [localizedArticles, filters, security, compact, securities]);
  const distribution = calculateSentimentDistribution(companyArticles);
  if (!security && compact) return <div className="rounded-xl border border-dashed border-line p-6 text-center"><p className="text-[12px] font-semibold text-ink">{t("No tracked companies yet")}</p><p className="mt-1 text-[10px] text-muted">{t("Track a company to see its synthetic news here.")}</p><Link href="/discover" className="mt-3 inline-flex text-[10px] font-bold text-positive">{t("Discover companies")} <ArrowRight className="directional-icon ms-1" size={12} /></Link></div>;
  if (!security) return <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">{t("No company is available for news research.")}</p>;
  return <section className="space-y-4" aria-label={t("Company news intelligence")}>
    {!compact && <div className="panel panel-pad"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">{t("COMPANY NEWS INTELLIGENCE")}</p><h2 className="mt-1 text-[16px] font-bold text-ink">{t("News for")} {security.name}</h2></div><DemoBadge>FICTIONAL ARTICLES</DemoBadge></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-[10px] font-semibold text-muted">{t("Company")}<select className="input-control mt-1" value={security.symbol} onChange={(event) => { setSymbol(event.target.value); setFilters(emptyNewsFilters); }}>{securities.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol} · {item.name}</option>)}</select></label>
      <label className="text-[10px] font-semibold text-muted">{t("Topic")}<select className="input-control mt-1" value={filters.category ?? "All topics"} onChange={(event) => setFilters((old) => ({ ...old, category: event.target.value as NewsFilters["category"] }))}><option>All topics</option>{NEWS_CATEGORIES.map((category) => <option key={category} value={category}>{t(category)}</option>)}</select></label>
      <label className="text-[10px] font-semibold text-muted">{t("From date")}<input className="input-control mt-1" type="date" value={filters.dateFrom ?? ""} onChange={(event) => setFilters((old) => ({ ...old, dateFrom: event.target.value }))} /></label>
      <label className="text-[10px] font-semibold text-muted">{t("To date")}<input className="input-control mt-1" type="date" value={filters.dateTo ?? ""} onChange={(event) => setFilters((old) => ({ ...old, dateTo: event.target.value }))} /></label>
    </div><div className="mt-3 flex flex-wrap items-center gap-3"><label className="relative min-w-[220px] flex-1"><span className="sr-only">{t("Search article headlines and summaries")}</span><Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input-control input-control-with-icon" type="search" placeholder={t("Search headlines and summaries")} value={filters.search ?? ""} onChange={(event) => setFilters((old) => ({ ...old, search: event.target.value }))} /></label><label className="text-[10px] font-semibold text-muted">{t("Sort")} <select className="input-control !w-auto" value={filters.sort ?? "newest"} onChange={(event) => setFilters((old) => ({ ...old, sort: event.target.value as NewsFilters["sort"] }))}><option value="newest">{t("Newest")}</option><option value="relevance">{t("Relevance")}</option></select></label><button type="button" className="button-secondary !min-h-9" onClick={() => setFilters(emptyNewsFilters)}>{t("Clear filters")}</button></div></div>}
    <div className={compact ? "space-y-3" : "grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"}><div className="space-y-3">{compact ? <div className="flex items-center justify-between"><h2 className="section-title">{t("Recent tracked-company news")}</h2><Link href="/research" className="inline-flex items-center gap-1 text-[10px] font-bold text-positive">{t("Full research")} <ArrowRight className="directional-icon" size={12} /></Link></div> : <div className="flex items-center justify-between"><h3 className="section-title">{t("Company news feed")}</h3><span className="text-[10px] text-muted">{t("{count} results", { count: companyArticles.length })}</span></div>}
      {companyArticles.length ? companyArticles.slice(0, compact ? 4 : undefined).map((article) => compact ? <Link key={article.id} href={`/discover/${article.symbol}`} className="block"><ArticleCard article={article} /></Link> : <ArticleCard key={article.id} article={article} />) : <div className="rounded-xl border border-dashed border-line bg-surface-muted p-6 text-center"><p className="text-[12px] font-semibold text-ink">{t("No matching demo articles")}</p><p className="mt-1 text-[10px] text-muted">{t("Try clearing filters or selecting another company. The synthetic sample is intentionally limited.")}</p></div>}
    </div>{!compact && <aside className="space-y-3"><div className="panel panel-pad"><h3 className="section-title">{t("Sentiment overview")}</h3><p className="mb-3 mt-1 text-[9px] text-muted">{t("Counts reflect visible deduplicated stories · heuristic only")}</p><SentimentBar counts={distribution} /></div><CompanyReport security={security} articles={localizedArticles} /></aside>}</div>
  </section>;
}

export function TrackedNewsOverview({ securities }: { securities: Security[] }) {
  const { t, formatNumber, locale } = useLocale();
  const articles = useNewsArticles();
  const localizedArticles = useMemo(() => articles.map((article) => localizeNewsArticle(article, locale)), [articles, locale]);
  const summary = aggregateTrackedCompanyNews(securities, localizedArticles);
  if (!securities.length) return <div className="rounded-xl border border-dashed border-line bg-surface-muted p-6 text-center"><p className="text-[12px] font-semibold text-ink">{t("No tracked companies yet")}</p><p className="mt-1 text-[10px] text-muted">{t("Add companies to your tracked list to see their synthetic news coverage.")}</p></div>;
  return <div className="grid gap-3 md:grid-cols-2">{summary.map((item) => <article key={item.symbol} className="rounded-xl border border-line p-4"><div className="flex items-start justify-between gap-2"><div><Link href={`/discover/${item.symbol}`} className="text-[12px] font-bold text-ink hover:text-positive">{item.companyName} · {item.symbol}</Link><p className="mt-1 text-[10px] text-muted">{t("{count} synthetic articles", { count: formatNumber(item.articleCount) })}</p></div><Link href={`/discover/${item.symbol}`} aria-label={t("Open {symbol} company news", { symbol: item.symbol })} className="text-positive"><ArrowRight className="directional-icon" size={15} /></Link></div><div className="mt-3"><SentimentBar counts={item.sentiment} /></div><div className="mt-3 flex flex-wrap gap-2">{item.positiveThemes.map((theme) => <span key={`p-${theme.category}`} className="rounded-md bg-positive-soft px-2 py-1 text-[9px] text-positive">{t("Positive theme:")} {t(theme.category)}</span>)}{item.negativeThemes.map((theme) => <span key={`n-${theme.category}`} className="rounded-md bg-negative-soft px-2 py-1 text-[9px] text-negative">{t("Negative theme:")} {t(theme.category)}</span>)}</div><p className="mt-2 text-[9px] text-muted">{t("Article tone themes are descriptive only and do not imply materiality or performance.")}</p></article>)}</div>;
}

