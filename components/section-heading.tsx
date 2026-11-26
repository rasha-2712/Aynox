import type { ReactNode } from "react";

export function SectionHeading({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h2 className="section-title">{title}</h2>
        {detail && <p className="mt-1 text-[11px] text-muted">{detail}</p>}
      </div>
      {action}
    </div>
  );
}
