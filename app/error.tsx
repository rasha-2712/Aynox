"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep error details out of the UI; production logging will be configured later.
    console.error("Aynox page error", error.digest ?? "unclassified");
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[55vh] max-w-lg flex-col items-center justify-center text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-negative-soft text-negative"><AlertTriangle size={20} /></span>
      <h1 className="mt-4 text-xl font-bold text-ink">We could not load this view</h1>
      <p className="mt-2 text-xs leading-relaxed text-muted">Try again. Demo data should remain available even when a database is not configured.</p>
      <button className="button-primary mt-5" onClick={() => reset()}><RotateCcw size={14} /> Try again</button>
    </div>
  );
}
