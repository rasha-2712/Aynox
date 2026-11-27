"use client";

import { useLocale } from "@/components/locale-provider";

export default function Loading() {
  const { t } = useLocale();
  return (
    <div className="animate-pulse space-y-5" aria-label={t("Loading Aynox")} role="status" aria-live="polite">
      <div className="h-3 w-32 rounded bg-line" />
      <div className="h-8 w-72 max-w-full rounded bg-line" />
      <div className="h-4 w-96 max-w-full rounded bg-line" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="panel h-28 bg-white" />)}</div>
      <div className="grid gap-4 xl:grid-cols-2"><div className="panel h-72 bg-white" /><div className="panel h-72 bg-white" /></div>
    </div>
  );
}
