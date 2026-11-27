import type { ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";

export function SectionHeading({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  const { t } = useLocale();
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h2 className="section-title">{t(title)}</h2>
        {detail && <p className="mt-1 text-[11px] text-muted">{t(detail)}</p>}
      </div>
      {action}
    </div>
  );
}
