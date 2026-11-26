"use client";

import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { useTrackedPortfolio } from "@/components/portfolio-provider";

export function TrackStockButton({ symbol, compact = false }: { symbol: string; compact?: boolean }) {
  const { isReady, isTracked, addSymbol, removeSymbol, announce } = useTrackedPortfolio();
  const [confirmation, setConfirmation] = useState("");
  const tracked = isTracked(symbol);

  function updateTracking() {
    if (!isReady) return;
    if (tracked) {
      removeSymbol(symbol);
      setConfirmation(`${symbol} removed · effective this interval`);
      announce(`${symbol} removed from tracked stocks`);
    } else {
      addSymbol(symbol);
      setConfirmation(`${symbol} added · effective next full interval`);
      announce(`${symbol} added · effective next full interval`);
    }
    window.setTimeout(() => setConfirmation(""), 2200);
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={updateTracking}
        disabled={!isReady}
        aria-pressed={isReady ? tracked : undefined}
        aria-label={!isReady ? `Loading tracking status for ${symbol}` : tracked ? `Remove ${symbol} from tracked stocks` : `Add ${symbol} to tracked stocks`}
        className={tracked ? "button-secondary !min-h-9 !px-3 text-[11px]" : "button-primary !min-h-9 !px-3 text-[11px]"}
      >
        {!isReady ? "Loading…" : tracked ? <><Check size={14} /> Tracked{!compact && " · Remove"}</> : <><Plus size={14} /> Track stock</>}
      </button>
      <span className="text-right text-[9px] text-positive" aria-live="polite">{confirmation}</span>
    </span>
  );
}

export function RemoveStockButton({ symbol }: { symbol: string }) {
  const { isReady, removeSymbol, announce } = useTrackedPortfolio();
  const [confirmation, setConfirmation] = useState("");
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" disabled={!isReady} onClick={() => { removeSymbol(symbol); setConfirmation(`${symbol} removed from tracked stocks`); announce(`${symbol} removed from tracked stocks`); }} className="button-secondary !min-h-8 !px-2.5 text-[10px]" aria-label={`Remove ${symbol} from tracked stocks`}>
        <Trash2 size={13} /> Remove
      </button>
      <span className="sr-only" aria-live="polite">{confirmation}</span>
    </span>
  );
}
