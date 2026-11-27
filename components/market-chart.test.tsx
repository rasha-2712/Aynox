import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/components/locale-provider";
import { MarketChart } from "@/components/market-chart";

describe("MarketChart accessibility", () => {
  it("provides an accessible chart name, description, and data-table alternative", () => {
    const html = renderToStaticMarkup(
      <LocaleProvider initialLocale="ar">
        <MarketChart
          data={[{ date: "2026-01-01", value: 100 }, { date: "2026-01-02", value: 101 }]}
          prefix="USD "
          accessibleLabel="ACME synthetic price chart in USD"
          accessibleDescription="Illustrative values only."
        />
      </LocaleProvider>
    );

    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="ACME synthetic price chart in USD"');
    expect(html).toContain("Illustrative values only.");
    expect(html).toContain('aria-describedby=');
    expect(html).toContain("جدول بيانات الرسم");
    expect(html).toContain("<caption class=\"sr-only\">ACME synthetic price chart in USD</caption>");
    expect(html).toContain("USD 100");
  });
});
