"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { NewsArticle } from "@/types/news";

const NewsContext = createContext<NewsArticle[]>([]);
export function NewsIntelligenceProvider({ articles, children }: { articles: NewsArticle[]; children: ReactNode }) {
  return <NewsContext.Provider value={articles}>{children}</NewsContext.Provider>;
}
export function useNewsArticles() { return useContext(NewsContext); }

