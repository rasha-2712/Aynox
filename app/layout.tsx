import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/app/globals.css";
import { AppShell } from "@/components/app-shell";
import { NewsIntelligenceProvider } from "@/components/news-provider";
import { PortfolioProvider } from "@/components/portfolio-provider";
import { getNewsArticles } from "@/lib/news/service";

export const metadata: Metadata = {
  title: { default: "Aynox — Investment Intelligence", template: "%s · Aynox" },
  description: "Aynox investment research and portfolio intelligence demo."
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const newsArticles = await getNewsArticles();
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-3">Skip to content</a>
        <NewsIntelligenceProvider articles={newsArticles}>
          <PortfolioProvider><AppShell>{children}</AppShell></PortfolioProvider>
        </NewsIntelligenceProvider>
      </body>
    </html>
  );
}
