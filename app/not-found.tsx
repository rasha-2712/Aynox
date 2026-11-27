"use client";

import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { useLocale } from "@/components/locale-provider";

export default function NotFound() {
  const { t } = useLocale();
  return (
    <div className="mx-auto flex min-h-[65vh] max-w-lg flex-col items-center justify-center text-center">
      <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-brand-light text-brand"><Compass size={24} /></div>
      <p className="eyebrow mb-2">{t("404 · PAGE NOT FOUND")}</p>
      <h1 className="page-title">{t("This page is off the map.")}</h1>
      <p className="page-subtitle mt-3">{t("The address may have changed, or this page is not part of the current demo.")}</p>
      <Link href="/" className="button-primary mt-6"><ArrowLeft className="directional-icon" size={15} /> {t("Back to dashboard")}</Link>
    </div>
  );
}
