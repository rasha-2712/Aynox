import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageSelector } from "@/components/language-selector";
import { LocaleProvider } from "@/components/locale-provider";
import { demoNewsArticles } from "@/lib/news/demo-news";
import { analyzeNewsArticle } from "@/lib/news/service";
import { formatLocaleCurrency, formatLocaleDate, formatLocaleNumber, isLocale, localeAttributes, localeCookieString, localeFromCookieValue, translate } from "@/lib/i18n/messages";
import { localizeNewsArticle } from "@/lib/i18n/demo-content";

describe("Aynox localization", () => {
  it("defaults invalid or absent locale values to English", () => {
    expect(localeFromCookieValue(undefined)).toBe("en");
    expect(localeFromCookieValue("fr")).toBe("en");
    expect(isLocale("ar")).toBe(true);
    expect(isLocale("English")).toBe(false);
  });

  it("sets document language and direction for both supported locales", () => {
    expect(localeAttributes("en")).toEqual({ lang: "en", dir: "ltr" });
    expect(localeAttributes("ar")).toEqual({ lang: "ar", dir: "rtl" });
  });

  it("provides localized names and descriptions for financial charts", () => {
    expect(translate("ar", "{company} historical price chart in {currency}", { company: "Aynox", currency: "USD" })).toContain("USD");
    expect(translate("ar", "Tracked portfolio index chart")).toContain("مؤشر");
    expect(translate("ar", "Synthetic tracked-stock return index, unitless, base 100; not personal performance.")).toContain("100");
  });

  it("persists only the selected supported locale in a same-site preference cookie", () => {
    expect(localeCookieString("ar")).toBe("aynox_locale=ar; Max-Age=31536000; Path=/; SameSite=Lax");
    expect(localeCookieString("en")).toContain("aynox_locale=en;");
  });

  it("keeps English as the default and translates shared interface copy to Arabic", () => {
    expect(translate("en", "Discover stocks")).toBe("Discover stocks");
    expect(translate("ar", "Discover stocks")).toBe("استكشف الأسهم");
    expect(translate("ar", "Remove {symbol} from tracked stocks", { symbol: "NVDA" })).toContain("NVDA");
    expect(translate("ar", "Your tracked stocks")).toBe("الأسهم التي تتابعها");
    expect(translate("ar", "Markets")).toBe("الأسواق");
    expect(translate("ar", "All stories and classifications are synthetic interface demonstrations, not reporting about real events.")).toContain("عروض توضيحية اصطناعية");
    expect(translate("ar", "Discover")).toBe("استكشاف");
    expect(translate("ar", "Tracked Portfolio")).toBe("قائمة المتابعة");
    expect(translate("ar", "This browser’s demo list may start with sample stocks. Add or remove symbols to shape your research set; changes are saved in this browser only.")).toContain("في هذا المتصفح فقط");
  });

  it("renders the selector from the server-provided initial locale", () => {
    const html = renderToStaticMarkup(<LocaleProvider initialLocale="ar"><LanguageSelector /></LocaleProvider>);
    expect(html).toContain('value="ar"');
    expect(html).toContain("اللغة");
    expect(html).toContain("العربية");
  });

  it("formats dates and currencies per locale without changing the currency code", () => {
    const date = "2026-11-24T14:20:00.000Z";
    expect(formatLocaleDate("en", date)).not.toBe(formatLocaleDate("ar", date));
    expect(formatLocaleCurrency("en", 1234.5, "USD")).toContain("USD");
    expect(formatLocaleCurrency("ar", 1234.5, "EUR")).toContain("EUR");
    expect(formatLocaleNumber("ar", 142.8, { minimumFractionDigits: 2 })).toContain("142");
  });

  it("provides translated synthetic article content while preserving ticker and source identity", () => {
    const input = demoNewsArticles.find((article) => article.id === "scenario-nvda-001");
    if (!input) throw new Error("Expected synthetic news fixture.");
    const analyzed = analyzeNewsArticle(input);
    const translated = localizeNewsArticle(analyzed, "ar");
    expect(translated.headline).toContain("سيناريو تجريبي");
    expect(translated.symbol).toBe("NVDA");
    expect(translated.sourceName).toBe(analyzed.sourceName);
    expect(translated.sentiment.explanation).toContain("تجريبي");
  });
});
