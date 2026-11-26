export function DemoBadge({ children = "DEMO DATA" }: { children?: string }) {
  return <span className="demo-pill" aria-label="Demonstration data"><span className="demo-dot" />{children}</span>;
}
