"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useId } from "react";
import { useLocale } from "@/components/locale-provider";


export function MarketChart({ data, color = "#11704f", height = 250, prefix = "", accessibleLabel, accessibleDescription }: {
  data: Array<{ date: string; value: number | null }>;
  color?: string;
  height?: number;
  prefix?: string;
  accessibleLabel?: string;
  accessibleDescription?: string;
}) {
  const { t, formatNumber, formatDate } = useLocale();
  const chartId = useId().replace(/:/g, "");
  if (data.length === 0) {
    return <div className="grid place-items-center rounded-xl border border-dashed border-line bg-surface-muted text-xs text-muted" style={{ height }} role="status">{t("No demo price history available.")}</div>;
  }

  return (
    <div>
      <div dir="ltr" style={{ width: "100%", height }} role="img" aria-label={accessibleLabel ?? t("Synthetic demonstration price history chart")} aria-describedby={`${chartId}-summary`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={`${chartId}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.18} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#edf1ef" vertical={false} />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#89969a", fontSize: 10 }} minTickGap={22} tickFormatter={(value: string) => formatDate(value, { month: "short", day: "numeric", timeZone: "UTC" })} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#89969a", fontSize: 10 }} width={48} tickFormatter={(value: number) => `${prefix}${formatNumber(value)}`} domain={["dataMin - 2", "dataMax + 2"]} />
          <Tooltip
            contentStyle={{ border: "1px solid #e5ecea", borderRadius: 10, boxShadow: "0 8px 24px rgba(22,45,52,.1)", fontSize: 11 }}
            formatter={(value) => [`${prefix}${formatNumber(Number(value))}`, t("DEMO value")]}
            labelStyle={{ color: "#78888e", marginBottom: 3 }}
          />
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.2} fill={`url(#${chartId}-fill)`} connectNulls={false} activeDot={{ r: 4, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p id={`${chartId}-summary`} className="sr-only">{accessibleDescription ? `${accessibleDescription} ` : ""}{t("{count} synthetic observations, from {start} to {end}. Values are shown in the labelled unit where provided.", { count: data.length, start: formatDate(data[0].date), end: formatDate(data[data.length - 1].date) })}</p>
      <details className="mt-2 text-xs text-muted">
        <summary className="w-fit cursor-pointer rounded-sm font-semibold text-brand hover:underline">{t("View chart data table")}</summary>
        <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-line">
          <table className="w-full text-start text-xs">
          <caption className="sr-only">{accessibleLabel ?? t("Synthetic chart values by date")}</caption>
            <thead className="sticky top-0 bg-surface-muted text-ink"><tr><th scope="col" className="px-3 py-2">{t("Date")}</th><th scope="col" className="px-3 py-2 text-end">{t("Value")}</th></tr></thead>
            <tbody>{data.map((point) => <tr key={point.date} className="table-row"><th scope="row" className="px-3 py-2 font-medium">{formatDate(point.date)}</th><td className="px-3 py-2 text-end">{point.value === null ? t("Unavailable") : `${prefix}${formatNumber(point.value)}`}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
