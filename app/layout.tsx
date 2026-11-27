import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "@/app/globals.css";
import { AppShell } from "@/components/app-shell";
import { LocaleProvider } from "@/components/locale-provider";
import { NewsIntelligenceProvider } from "@/components/news-provider";
import { PortfolioProvider } from "@/components/portfolio-provider";
import { getNewsArticles } from "@/lib/news/service";
import { localeAttributes, localeCookieName, localeFromCookieValue, translate } from "@/lib/i18n/messages";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get(localeCookieName)?.value;
  const locale = localeFromCookieValue(rawLocale);
  return {
    title: { default: translate(locale, "Aynox — Investment Intelligence"), template: `%s · Aynox` },
    description: translate(locale, "Aynox investment research and portfolio intelligence demo.")
  };
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get(localeCookieName)?.value;
  const locale = localeFromCookieValue(rawLocale);
  const attributes = localeAttributes(locale);
  const newsArticles = await getNewsArticles();
  return (
    <html lang={attributes.lang} dir={attributes.dir}>
      <body>
        <LocaleProvider initialLocale={locale}>
          <a href="#main-content" className="skip-link">{translate(locale, "Skip to content")}</a>
          <NewsIntelligenceProvider articles={newsArticles}>
            <PortfolioProvider><AppShell>{children}</AppShell></PortfolioProvider>
          </NewsIntelligenceProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
