"use client";

import { Check, Plus, Trash2 } from "lucide-react";
import { useTrackedPortfolio } from "@/components/portfolio-provider";
import { useLocale } from "@/components/locale-provider";

export function TrackStockButton({ symbol, compact = false }: { symbol: string; compact?: boolean }) {
  const { isReady, isTracked, addSymbol, removeSymbol, announce } = useTrackedPortfolio();
  const { t } = useLocale();
  const tracked = isTracked(symbol);

  function updateTracking() {
    if (!isReady) return;
    if (tracked) {
      removeSymbol(symbol);
      announce(t("{symbol} removed · effective this interval", { symbol }));
    } else {
      addSymbol(symbol);
      announce(t("{symbol} added · effective next full interval", { symbol }));
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={updateTracking}
        disabled={!isReady}
        aria-pressed={isReady ? tracked : undefined}
        aria-label={!isReady ? t("Loading tracking status for {symbol}", { symbol }) : tracked ? t("Remove {symbol} from tracked stocks", { symbol }) : t("Add {symbol} to tracked stocks", { symbol })}
        className={tracked ? "button-secondary !min-h-9 !px-3 text-[11px]" : "button-primary !min-h-9 !px-3 text-[11px]"}
      >
        {!isReady ? t("Loading…") : tracked ? <><Check size={14} /> {t("Tracked")}{!compact && ` · ${t("Remove")}`}</> : <><Plus size={14} /> {t("Track stock")}</>}
      </button>
    </span>
  );
}

export function RemoveStockButton({ symbol }: { symbol: string }) {
  const { isReady, removeSymbol, announce } = useTrackedPortfolio();
  const { t } = useLocale();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" disabled={!isReady} onClick={() => { removeSymbol(symbol); announce(t("{symbol} removed · effective this interval", { symbol })); }} className="button-secondary !min-h-8 !px-2.5 text-[10px]" aria-label={t("Remove {symbol} from tracked stocks", { symbol })}>
        <Trash2 size={13} /> {t("Remove")}
      </button>
    </span>
  );
}
