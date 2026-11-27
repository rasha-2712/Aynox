import { useLocale } from "@/components/locale-provider";

export function DemoBadge({ children = "DEMO DATA" }: { children?: string }) {
  const { t } = useLocale();
  return <span className="demo-pill" aria-label={t("Demonstration data")}><span className="demo-dot" />{t(children)}</span>;
}
