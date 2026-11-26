"use client";

import { useState } from "react";
import { Bell, Check, ChevronRight, CircleHelp, Database, Eye, Globe2, LockKeyhole, MonitorCog, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { DemoBadge } from "@/components/demo-badge";
import { PageHeading } from "@/components/page-heading";

function PreferenceRow({ icon: Icon, title, detail, defaultOn = false }: { icon: LucideIcon; title: string; detail: string; defaultOn?: boolean }) {
  const [enabled, setEnabled] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-4 last:border-0">
      <div className="flex min-w-0 items-start gap-3"><span className="stat-icon mt-0.5 shrink-0"><Icon size={15} /></span><div><p className="text-[12px] font-semibold text-ink">{title}</p><p className="mt-1 text-[10px] leading-relaxed text-muted">{detail}</p></div></div>
      <button type="button" role="switch" aria-checked={enabled} aria-label={title} onClick={() => setEnabled(!enabled)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? "bg-positive" : "bg-[#d8e0de]"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${enabled ? "left-6" : "left-1"}`} /></button>
    </div>
  );
}

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);

  return (
    <>
      <PageHeading eyebrow="Preferences" title="Settings" description="Manage demo display preferences and review how Aynox handles market and portfolio data." action={<DemoBadge>DEMO ACCOUNT</DemoBadge>} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,.75fr)]">
        <div className="space-y-4">
          <section className="panel panel-pad">
            <div className="mb-2 flex items-center gap-3"><span className="stat-icon"><UserRound size={16} /></span><div><h2 className="section-title">Profile</h2><p className="mt-1 text-[10px] text-muted">Account features are not connected.</p></div></div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-[10px] font-semibold text-muted">Display name<input className="input-control mt-1.5" value="Demo Investor" readOnly /></label>
              <label className="text-[10px] font-semibold text-muted">Email<input className="input-control mt-1.5" value="Account coming soon" readOnly /></label>
            </div>
            <div className="mt-3 rounded-lg bg-warning-soft p-3 text-[10px] text-warning">Authentication, account creation, and profile management are coming soon.</div>
          </section>

          <section className="panel panel-pad">
            <div className="mb-1 flex items-center gap-3"><span className="stat-icon"><MonitorCog size={16} /></span><div><h2 className="section-title">Display preferences</h2><p className="mt-1 text-[10px] text-muted">Preferences are local to this demo session.</p></div></div>
            <PreferenceRow icon={Eye} title="Show methodology notes" detail="Keep return and source limitations visible on research pages." defaultOn />
            <PreferenceRow icon={Bell} title="Market alerts" detail="Notification controls are visual only and do not send alerts." />
            <PreferenceRow icon={Globe2} title="Compact market values" detail="Use a concise presentation for large numeric values." defaultOn />
            <button className="button-primary mt-4" onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 1800); }}>{saved ? <><Check size={14} /> Saved locally</> : "Save demo preferences"}</button>
          </section>

          <section className="panel panel-pad">
            <div className="mb-3 flex items-center gap-3"><span className="stat-icon"><Database size={16} /></span><div><h2 className="section-title">Data and methodology</h2><p className="mt-1 text-[10px] text-muted">What the current demonstration represents.</p></div></div>
            <ul className="space-y-2 text-[10px] leading-relaxed text-ink-soft">
              <li className="flex gap-2"><Check size={13} className="mt-0.5 shrink-0 text-positive" />Market and company data is synthetic; no provider is connected.</li>
              <li className="flex gap-2"><Check size={13} className="mt-0.5 shrink-0 text-positive" />Tracked stocks are manual research selections, not owned assets.</li>
              <li className="flex gap-2"><Check size={13} className="mt-0.5 shrink-0 text-positive" />The index uses local-currency price returns and excludes FX and cash dividends.</li>
              <li className="flex gap-2"><Check size={13} className="mt-0.5 shrink-0 text-positive" />No quantities, entry prices, costs, or personal return are modeled.</li>
            </ul>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="panel panel-pad">
            <div className="mb-3 flex items-center gap-3"><span className="stat-icon"><ShieldCheck size={16} /></span><h2 className="section-title">Privacy and access</h2></div>
            <p className="text-[11px] leading-relaxed text-muted">This app currently stores your tracked symbols in browser local storage. There is no sign-in, server-side user account, analytics profile, or brokerage connection.</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-semibold text-ink"><LockKeyhole size={14} className="text-positive" /> Secure account controls <span className="ml-auto text-muted">Coming soon</span></div>
              <div className="flex items-center gap-2 text-[10px] font-semibold text-ink"><Database size={14} className="text-positive" /> Data export and deletion <span className="ml-auto text-muted">Coming soon</span></div>
            </div>
          </section>
          <section className="panel panel-pad">
            <h2 className="section-title">Need help?</h2><p className="mt-2 text-[10px] leading-relaxed text-muted">Documentation, support, and legal notices will be added before external pilot access.</p>
            <button className="button-secondary mt-4 w-full justify-between"><span className="inline-flex items-center gap-2"><CircleHelp size={14} /> Help center</span><ChevronRight size={14} /></button>
          </section>
          <div className="rounded-xl border border-line bg-white p-4 text-[9px] leading-relaxed text-muted">Nothing in this demonstration constitutes investment advice. Synthetic metrics and examples are for interface evaluation only.</div>
        </aside>
      </div>
    </>
  );
}
