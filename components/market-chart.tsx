"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";


export function MarketChart({ data, color = "#17845f", height = 250, prefix = "" }: {
  data: Array<{ date: string; value: number | null }>;
  color?: string;
  height?: number;
  prefix?: string;
}) {
  if (data.length === 0) {
    return <div className="grid place-items-center rounded-xl border border-dashed border-line bg-surface-muted text-xs text-muted" style={{ height }}>No demo price history available.</div>;
  }

  return (
    <div style={{ width: "100%", height }} role="img" aria-label="Synthetic demonstration price history chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="marketFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.18} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#edf1ef" vertical={false} />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#89969a", fontSize: 10 }} minTickGap={22} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#89969a", fontSize: 10 }} width={48} tickFormatter={(value: number) => `${prefix}${value.toLocaleString()}`} domain={["dataMin - 2", "dataMax + 2"]} />
          <Tooltip
            contentStyle={{ border: "1px solid #e5ecea", borderRadius: 10, boxShadow: "0 8px 24px rgba(22,45,52,.1)", fontSize: 11 }}
            formatter={(value) => [`${prefix}${Number(value).toLocaleString()}`, "DEMO value"]}
            labelStyle={{ color: "#78888e", marginBottom: 3 }}
          />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.2} fill="url(#marketFill)" connectNulls={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
