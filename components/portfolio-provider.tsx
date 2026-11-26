"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { demoHistoryStart, demoSecurities, trackedDefaults } from "@/lib/data/demo-data";
import { getMembershipIntervals, getTrackedSecurityIds, isTrackedSecurity, loadTrackingState, recordMembershipEvent, saveTrackingState, type TrackingState } from "@/lib/portfolio/membership";

interface PortfolioContextValue {
  isReady: boolean;
  symbols: string[];
  events: TrackingState["events"];
  membershipIntervals: ReturnType<typeof getMembershipIntervals>;
  announce: (message: string) => void;
  isTracked: (symbol: string) => boolean;
  addSymbol: (symbol: string) => void;
  removeSymbol: (symbol: string) => void;
  toggleSymbol: (symbol: string) => void;
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);
const STORAGE_KEY = "aynox-demo-membership-history-v2";
const LEGACY_STORAGE_KEY = "aynox-demo-tracked-symbols";

function eventId() {
  return globalThis.crypto?.randomUUID?.() ?? `event-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [tracking, setTracking] = useState<TrackingState>({ version: 2, events: [] });
  const [isReady, setIsReady] = useState(false);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<number | null>(null);

  const announce = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2400);
  }, []);

  useEffect(() => () => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
  }, []);

  useEffect(() => {
    let restored: TrackingState;
    try {
      restored = loadTrackingState(
        window.localStorage,
        STORAGE_KEY,
        LEGACY_STORAGE_KEY,
        demoSecurities,
        trackedDefaults,
        `${demoHistoryStart}T00:00:00.000Z`,
        new Date().toISOString()
      );
    } catch {
      restored = loadTrackingState(
        { getItem: () => null, setItem: () => undefined },
        STORAGE_KEY,
        LEGACY_STORAGE_KEY,
        demoSecurities,
        trackedDefaults,
        `${demoHistoryStart}T00:00:00.000Z`,
        new Date().toISOString()
      );
    }
    window.requestAnimationFrame(() => {
      setTracking(restored);
      setIsReady(true);
    });

    function restoreFromAnotherTab(event: StorageEvent) {
      if (event.key !== STORAGE_KEY && event.key !== LEGACY_STORAGE_KEY) return;
      try {
        const next = loadTrackingState(
          window.localStorage,
          STORAGE_KEY,
          LEGACY_STORAGE_KEY,
          demoSecurities,
          trackedDefaults,
          `${demoHistoryStart}T00:00:00.000Z`,
          new Date().toISOString()
        );
        window.requestAnimationFrame(() => setTracking(next));
      } catch {
        // Keep the last in-memory state if browser storage becomes unavailable.
      }
    }
    window.addEventListener("storage", restoreFromAnotherTab);
    return () => window.removeEventListener("storage", restoreFromAnotherTab);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    try {
      saveTrackingState(window.localStorage, STORAGE_KEY, tracking);
    } catch {
      // Tracking still works for this tab if browser storage is blocked or full.
    }
  }, [isReady, tracking]);

  const addSymbol = useCallback((symbol: string) => {
    const security = demoSecurities.find((item) => item.symbol === symbol);
    if (!security) return;
    setTracking((current) => recordMembershipEvent(current, security.id, "added", new Date().toISOString(), eventId()));
  }, []);

  const removeSymbol = useCallback((symbol: string) => {
    const security = demoSecurities.find((item) => item.symbol === symbol);
    if (!security) return;
    setTracking((current) => recordMembershipEvent(current, security.id, "removed", new Date().toISOString(), eventId()));
  }, []);

  const toggleSymbol = useCallback((symbol: string) => {
    const security = demoSecurities.find((item) => item.symbol === symbol);
    if (!security) return;
    setTracking((current) => recordMembershipEvent(
      current,
      security.id,
      isTrackedSecurity(current.events, security.id) ? "removed" : "added",
      new Date().toISOString(),
      eventId()
    ));
  }, []);

  const value = useMemo<PortfolioContextValue>(() => {
    const ids = getTrackedSecurityIds(tracking.events);
    const securityIds = new Set(ids);
    return {
      isReady,
      symbols: demoSecurities.filter((security) => securityIds.has(security.id)).map((security) => security.symbol),
      events: tracking.events,
      membershipIntervals: getMembershipIntervals(tracking.events),
      announce,
      isTracked: (symbol) => {
        const security = demoSecurities.find((item) => item.symbol === symbol);
        return security ? securityIds.has(security.id) : false;
      },
      addSymbol,
      removeSymbol,
      toggleSymbol
    };
  }, [addSymbol, announce, isReady, removeSymbol, toggleSymbol, tracking.events]);

  return <PortfolioContext.Provider value={value}>{children}<div className="fixed bottom-24 right-4 z-50 rounded-xl border border-line bg-white px-4 py-3 text-[11px] font-semibold text-ink shadow-lg md:bottom-5" role="status" aria-live="polite" hidden={!notice}>{notice}</div></PortfolioContext.Provider>;
}

export function useTrackedPortfolio() {
  const value = useContext(PortfolioContext);
  if (!value) throw new Error("useTrackedPortfolio must be used inside PortfolioProvider");
  return value;
}
