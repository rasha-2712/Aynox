"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useLocale } from "@/components/locale-provider";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useLocale();
  useEffect(() => {
    // Keep error details out of the UI; production logging will be configured later.
    console.error("Aynox page error", error.digest ?? "unclassified");
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[55vh] max-w-lg flex-col items-center justify-center text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-negative-soft text-negative"><AlertTriangle size={20} /></span>
      <h1 className="mt-4 text-xl font-bold text-ink">{t("We could not load this view")}</h1>
      <p className="mt-2 text-xs leading-relaxed text-muted">{t("Try again. Demo data should remain available even when a database is not configured.")}</p>
      <button type="button" className="button-primary mt-5" onClick={() => reset()}><RotateCcw size={14} /> {t("Try again")}</button>
    </div>
  );
}
