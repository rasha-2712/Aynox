"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { formatLocaleCurrency, formatLocaleDate, formatLocaleNumber, localeAttributes, localeCookieString, translate, type Locale } from "@/lib/i18n/messages";

interface LocaleContextValue {
  locale: Locale;
  direction: "ltr" | "rtl";
  t: (key: string, values?: Record<string, string | number>) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (value: number, currency: string) => string;
  formatDate: (value: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState(initialLocale);
  const setLocale = useCallback((nextLocale: Locale) => {
    const attributes = localeAttributes(nextLocale);
    document.documentElement.lang = attributes.lang;
    document.documentElement.dir = attributes.dir;
    document.cookie = localeCookieString(nextLocale);
    setLocaleState(nextLocale);
  }, []);
  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    direction: locale === "ar" ? "rtl" : "ltr",
    t: (key, values) => translate(locale, key, values),
    formatNumber: (number, options) => formatLocaleNumber(locale, number, options),
    formatCurrency: (number, currency) => formatLocaleCurrency(locale, number, currency),
    formatDate: (date, options) => formatLocaleDate(locale, date, options),
    setLocale
  }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside LocaleProvider");
  return value;
}
