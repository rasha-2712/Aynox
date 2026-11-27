import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

function cssColor(name: string): string {
  const match = stylesheet.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`Missing CSS color token ${name}`);
  return match[1];
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe("application text contrast tokens", () => {
  it("keeps muted, positive, negative, and warning text above 4.5:1 on their common surfaces", () => {
    const surface = cssColor("--color-surface");
    const canvas = cssColor("--color-canvas");
    expect(contrast(cssColor("--color-muted"), surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(cssColor("--color-muted"), canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(cssColor("--color-positive"), surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(cssColor("--color-positive"), cssColor("--color-positive-soft"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(cssColor("--color-negative"), surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(cssColor("--color-negative"), cssColor("--color-negative-soft"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(cssColor("--color-warning"), surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(cssColor("--color-warning"), cssColor("--color-warning-soft"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(cssColor("--color-control-border"), surface)).toBeGreaterThanOrEqual(3);
    expect(stylesheet).toContain(".input-control:focus-visible { outline: 3px solid #145c49;");
  });
});
