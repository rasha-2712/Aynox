"use client";

import { useState, useSyncExternalStore } from "react";
import { Bell, Check, ChevronRight, CircleHelp, Database, Eye, Globe2, LockKeyhole, MonitorCog, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { DemoBadge } from "@/components/demo-badge";
import { PageHeading } from "@/components/page-heading";
import { LanguageSelector } from "@/components/language-selector";
import { useLocale } from "@/components/locale-provider";

function PreferenceRow({ icon: Icon, title, detail, enabled, onChange }: { icon: LucideIcon; title: string; detail: string; enabled: boolean; onChange: (enabled: boolean) => void }) {
  const { t } = useLocale();
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-4 last:border-0">
      <div className="flex min-w-0 items-start gap-3"><span className="stat-icon mt-0.5 shrink-0"><Icon size={15} /></span><div><p className="text-[12px] font-semibold text-ink">{t(title)}</p><p className="mt-1 text-[10px] leading-relaxed text-muted">{t(detail)}</p></div></div>
      <button type="button" role="switch" aria-checked={enabled} aria-label={t(title)} onClick={() => onChange(!enabled)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? "bg-positive" : "bg-[#d8e0de]"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${enabled ? "start-6" : "start-1"}`} /></button>
    </div>
  );
}

const PREFERENCE_STORAGE_KEY = "aynox-demo-preferences-v1";
const defaultPreferences = { methodologyNotes: true, marketAlerts: false, compactValues: true };
type Preferences = typeof defaultPreferences;
let cachedPreferences: Preferences = defaultPreferences;
let cachedPreferencesRaw: string | null = null;
let preferenceStorageUnavailable = false;

function getPreferencesSnapshot(): Preferences {
  if (preferenceStorageUnavailable) return cachedPreferences;
  try {
    const stored = window.localStorage.getItem(PREFERENCE_STORAGE_KEY);
    if (stored !== cachedPreferencesRaw) {
      cachedPreferencesRaw = stored;
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (typeof parsed === "object" && parsed !== null) {
          const values = parsed as Record<string, unknown>;
          cachedPreferences = {
            methodologyNotes: typeof values.methodologyNotes === "boolean" ? values.methodologyNotes : defaultPreferences.methodologyNotes,
            marketAlerts: typeof values.marketAlerts === "boolean" ? values.marketAlerts : defaultPreferences.marketAlerts,
            compactValues: typeof values.compactValues === "boolean" ? values.compactValues : defaultPreferences.compactValues
          };
        } else cachedPreferences = defaultPreferences;
      } else cachedPreferences = defaultPreferences;
    }
  } catch {
    preferenceStorageUnavailable = true;
    return cachedPreferences;
  }
  return cachedPreferences;
}

function subscribeToPreferenceChanges(callback: () => void) {
  const refresh = () => {
    getPreferencesSnapshot();
    callback();
  };
  window.addEventListener("storage", refresh);
  window.addEventListener("aynox-demo-preferences-changed", refresh);
  return () => {
    window.removeEventListener("storage", refresh);
    window.removeEventListener("aynox-demo-preferences-changed", refresh);
  };
}

export default function SettingsPage() {
  const { t } = useLocale();
  const preferences = useSyncExternalStore(subscribeToPreferenceChanges, getPreferencesSnapshot, () => defaultPreferences);
  const [saveMessage, setSaveMessage] = useState("");

  function updatePreference<Key extends keyof Preferences>(key: Key, value: Preferences[Key]) {
    const next = { ...getPreferencesSnapshot(), [key]: value };
    try {
      window.localStorage.setItem(PREFERENCE_STORAGE_KEY, JSON.stringify(next));
      cachedPreferencesRaw = JSON.stringify(next);
      preferenceStorageUnavailable = false;
      setSaveMessage(t("Saved in this browser."));
    } catch {
      preferenceStorageUnavailable = true;
      setSaveMessage(t("Browser storage is unavailable; this choice will last only for this page."));
    }
    cachedPreferences = next;
    window.dispatchEvent(new Event("aynox-demo-preferences-changed"));
  }

  return (
    <>
      <PageHeading eyebrow="Preferences" title="Settings" description="Manage demo display preferences and review how Aynox handles market and portfolio data." action={<DemoBadge>DEMO ACCOUNT</DemoBadge>} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,.75fr)]">
        <div className="space-y-4">
          <section className="panel panel-pad">
            <div className="mb-2 flex items-center gap-3"><span className="stat-icon"><UserRound size={16} /></span><div><h2 className="section-title">{t("Profile")}</h2><p className="mt-1 text-[10px] text-muted">{t("Account features are not connected.")}</p></div></div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-[10px] font-semibold text-muted">{t("Display name")}<input className="input-control mt-1.5" value={t("Demo Investor")} readOnly /></label>
              <label className="text-[10px] font-semibold text-muted">{t("Email")}<input className="input-control mt-1.5" value={t("Account coming soon")} readOnly /></label>
            </div>
            <div className="mt-3 rounded-lg bg-warning-soft p-3 text-[10px] text-warning">{t("Authentication, account creation, and profile management are coming soon.")}</div>
          </section>

          <section className="panel panel-pad">
            <div className="mb-1 flex items-center gap-3"><span className="stat-icon"><MonitorCog size={16} /></span><div><h2 className="section-title">{t("Display preferences")}</h2><p className="mt-1 text-[10px] text-muted">{t("Preferences are local to this demo session.")}</p></div></div>
            <div className="border-b border-line py-4"><LanguageSelector /></div>
            <PreferenceRow icon={Eye} title="Show methodology notes" detail="Demo preference only; methodology remains visible throughout the app." enabled={preferences.methodologyNotes} onChange={(methodologyNotes) => updatePreference("methodologyNotes", methodologyNotes)} />
            <PreferenceRow icon={Bell} title="Market alerts" detail="Saved for demo purposes only; no alerts are sent." enabled={preferences.marketAlerts} onChange={(marketAlerts) => updatePreference("marketAlerts", marketAlerts)} />
            <PreferenceRow icon={Globe2} title="Compact market values" detail="Demo preference only; number formatting is not connected yet." enabled={preferences.compactValues} onChange={(compactValues) => updatePreference("compactValues", compactValues)} />
            <p className="mt-4 text-[10px] text-muted" role="status" aria-live="polite">{saveMessage}</p>
          </section>

          <section className="panel panel-pad">
            <div className="mb-3 flex items-center gap-3"><span className="stat-icon"><Database size={16} /></span><div><h2 className="section-title">{t("Data and methodology")}</h2><p className="mt-1 text-[10px] text-muted">{t("What the current demonstration represents.")}</p></div></div>
            <ul className="space-y-2 text-[10px] leading-relaxed text-ink-soft">
              <li className="flex gap-2"><Check size={13} className="mt-0.5 shrink-0 text-positive" />{t("Market and company data is synthetic; no provider is connected.")}</li>
              <li className="flex gap-2"><Check size={13} className="mt-0.5 shrink-0 text-positive" />{t("Tracked stocks are manual research selections, not owned assets.")}</li>
              <li className="flex gap-2"><Check size={13} className="mt-0.5 shrink-0 text-positive" />{t("The index uses local-currency price returns and excludes FX and cash dividends.")}</li>
              <li className="flex gap-2"><Check size={13} className="mt-0.5 shrink-0 text-positive" />{t("No quantities, entry prices, costs, or personal return are modeled.")}</li>
            </ul>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="panel panel-pad">
            <div className="mb-3 flex items-center gap-3"><span className="stat-icon"><ShieldCheck size={16} /></span><h2 className="section-title">{t("Privacy and access")}</h2></div>
            <p className="text-[11px] leading-relaxed text-muted">{t("This app currently stores your tracked symbols in browser local storage. There is no sign-in, server-side user account, analytics profile, or brokerage connection.")}</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-semibold text-ink"><LockKeyhole size={14} className="text-positive" /> {t("Secure account controls")} <span className="ms-auto text-muted">{t("Coming soon")}</span></div>
              <div className="flex items-center gap-2 text-[10px] font-semibold text-ink"><Database size={14} className="text-positive" /> {t("Data export and deletion")} <span className="ms-auto text-muted">{t("Coming soon")}</span></div>
            </div>
          </section>
          <section className="panel panel-pad">
            <h2 className="section-title">{t("Need help?")}</h2><p className="mt-2 text-[10px] leading-relaxed text-muted">{t("Documentation, support, and legal notices will be added before external pilot access.")}</p>
            <button type="button" className="button-secondary mt-4 w-full justify-between"><span className="inline-flex items-center gap-2"><CircleHelp size={14} /> {t("Help center")}</span><ChevronRight className="directional-icon" size={14} /></button>
          </section>
          <div className="rounded-xl border border-line bg-white p-4 text-[9px] leading-relaxed text-muted">{t("Nothing in this demonstration constitutes investment advice. Synthetic metrics and examples are for interface evaluation only.")}</div>
        </aside>
      </div>
    </>
  );
}
