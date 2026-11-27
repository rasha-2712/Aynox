"use client";

import { useState } from "react";
import { Languages } from "lucide-react";
import { useLocale } from "@/components/locale-provider";

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();
  const [feedback, setFeedback] = useState("");
  return <label className={`inline-flex items-center gap-2 text-xs font-semibold text-muted ${compact ? "" : "w-full"}`}>
    <Languages size={15} aria-hidden="true" />
    {!compact && <span>{t("Language")}</span>}
    <select aria-label={t("Language")} className="input-control !min-h-9 !w-auto !py-1 text-xs" value={locale} onChange={(event) => {
      const value = event.target.value;
      if (value === "en" || value === "ar") {
        setLocale(value);
        setFeedback(translateFeedback(value));
      }
    }}>
      <option value="en">English</option>
      <option value="ar">العربية</option>
    </select>
    <span className="sr-only" role="status" aria-live="polite">{feedback}</span>
  </label>;
}

function translateFeedback(locale: "en" | "ar") {
  return locale === "ar" ? "تم حفظ تفضيل اللغة في هذا المتصفح." : "Language preference saved in this browser.";
}
