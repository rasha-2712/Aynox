import type { ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";

export function PageHeading({ eyebrow, title, description, action }: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const { t } = useLocale();
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow mb-2">{t(eyebrow)}</p>
        <h1 className="page-title">{t(title)}</h1>
        <p className="page-subtitle mt-2 max-w-2xl">{t(description)}</p>
      </div>
      {action}
    </div>
  );
}
