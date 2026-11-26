import type { ReactNode } from "react";

export function MetricCard({ label, value, change, tone = "positive", icon }: {
  label: string;
  value: string;
  change?: string;
  tone?: "positive" | "negative" | "neutral";
  icon: ReactNode;
}) {
  return (
    <section className="panel p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="metric-label">{label}</p>
          <p className="metric-value mt-3 truncate">{value}</p>
          {change && <p className={`mt-2 text-[11px] font-semibold ${tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "text-muted"}`}>{change}</p>}
        </div>
        <div className="stat-icon shrink-0">{icon}</div>
      </div>
    </section>
  );
}
