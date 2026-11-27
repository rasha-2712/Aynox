"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ArrowUpRight, BarChart3, Home, Layers3, Search, Settings2, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { DemoBadge } from "@/components/demo-badge";
import { useLocale } from "@/components/locale-provider";
import { LanguageSelector } from "@/components/language-selector";

const links = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/discover", label: "Discover", icon: Search },
  { href: "/portfolio", label: "Tracked Portfolio", icon: Layers3 },
  { href: "/research", label: "Company Research", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings2 }
];

function Brand() {
  const { t } = useLocale();
  return (
    <Link href="/" className="mb-10 flex items-center gap-3 px-2" aria-label={t("Aynox dashboard")}>
      <span className="brand-mark"><Activity size={19} strokeWidth={2.6} /></span>
      <span><span className="block text-[19px] font-bold tracking-[-.04em]">aynox</span><span className="block text-[9px] font-semibold tracking-[.15em] text-[#90a8ae]">{t("INVESTMENT INTELLIGENCE")}</span></span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useLocale();
  const activeLabel = t(links.find((item) => item.href === pathname || (item.href !== "/" && pathname.startsWith(item.href)))?.label ?? "Aynox");

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label={t("Primary navigation")}>
        <Brand />
        <p className="nav-label mb-2">{t("WORKSPACE")}</p>
        <nav className="flex flex-col gap-1" aria-label={t("Main")}>
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return <Link key={href} href={href} className={`nav-link ${active ? "nav-link-active" : ""}`} aria-current={active ? "page" : undefined}><Icon size={17} strokeWidth={1.8} /><span>{t(label)}</span>{active && <span className="ms-auto h-1.5 w-1.5 rounded-full bg-[#8ce0ba]" />}</Link>;
          })}
        </nav>
        <div className="mt-auto rounded-xl border border-white/10 bg-white/[.04] p-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-[#d9e6e4]"><Sparkles size={14} className="text-[#8ce0ba]" /> {t("Research workspace")}</div>
          <p className="text-[10px] leading-relaxed text-[#91a6ad]">{t("Your tracked list is a research set, not a record of owned holdings.")}</p>
          <Link href="/portfolio" className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-[#9be2c0]">{t("View portfolio")} <ArrowUpRight className="directional-icon" size={12} /></Link>
        </div>
        <div className="mt-4 border-t border-white/10 px-2 pt-4 text-[10px] text-[#8da2a8]">{t("Aynox Demo · v0.1")}</div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark !h-8 !w-8"><Activity size={17} /></span><span className="text-[17px] tracking-[-.04em]">aynox</span><span className="ms-1 text-[10px] text-muted">/ {activeLabel}</span></div>
          <div className="hidden items-center gap-2 text-[12px] text-muted md:flex"><span className="h-1.5 w-1.5 rounded-full bg-positive" /> {t("Research workspace")} <span className="text-line">/</span> {activeLabel}</div>
          <div className="ms-auto flex items-center gap-3"><LanguageSelector compact /><DemoBadge /><span className="hidden h-8 w-8 place-items-center rounded-full bg-brand-light text-[11px] font-bold text-brand sm:grid">AY</span></div>
        </header>
        <main id="main-content" className="page-wrap">{children}</main>
        <footer className="mx-auto max-w-[1480px] px-5 pb-24 text-center text-[10px] text-muted md:px-9 md:pb-7">{t("Synthetic demonstration data · Not investment advice or actual portfolio performance")}</footer>
      </div>

      <nav className="mobile-nav" aria-label={t("Mobile navigation")}>
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          const short = label === "Tracked Portfolio" ? "Portfolio" : label === "Company Research" ? "Research" : label;
          return <Link key={href} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}><Icon size={18} strokeWidth={active ? 2.3 : 1.8} /><span>{t(short)}</span></Link>;
        })}
      </nav>
    </div>
  );
}
