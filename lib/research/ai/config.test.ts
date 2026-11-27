import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getAIProviderConfiguration, parseAIProviderConfiguration } from "@/lib/research/ai/config.server";

const validEnvironment = {
  AYNOX_AI_PROVIDER: "fixture-provider",
  AYNOX_AI_MODEL: "fixture-model-v1",
  AYNOX_AI_API_KEY: "unit-test-secret-not-a-real-key"
};

describe("AI provider configuration", () => {
  it("requires explicit provider, model and server credential without fallback selection", () => {
    const result = parseAIProviderConfiguration({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((error) => error.code)).toEqual([
      "missing_configuration", "missing_configuration", "missing_configuration"
    ]);
  });

  it("accepts explicit settings and applies bounded operational defaults", () => {
    const result = parseAIProviderConfiguration(validEnvironment);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.config).toMatchObject({
      providerId: "fixture-provider", modelId: "fixture-model-v1", apiKey: validEnvironment.AYNOX_AI_API_KEY,
      timeoutMs: 10_000, maxRetries: 2
    });
  });

  it("rejects malformed IDs and out-of-range timeout/retry settings", () => {
    const result = parseAIProviderConfiguration({
      ...validEnvironment,
      AYNOX_AI_PROVIDER: "provider with spaces",
      AYNOX_AI_TIMEOUT_MS: "999999",
      AYNOX_AI_MAX_RETRIES: "99"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((error) => error.code)).toEqual(expect.arrayContaining([
      "invalid_configuration", "invalid_configuration", "invalid_configuration"
    ]));
  });

  it("does not include credential contents in configuration errors", () => {
    const result = parseAIProviderConfiguration({ ...validEnvironment, AYNOX_AI_MODEL: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(JSON.stringify(result.errors)).not.toContain(validEnvironment.AYNOX_AI_API_KEY);
  });

  it("refuses to read server configuration in a browser runtime", () => {
    const prior = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
    try {
      const result = getAIProviderConfiguration();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors[0].code).toBe("unsupported_operation");
    } finally {
      if (prior) Object.defineProperty(globalThis, "window", prior);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });

  it("keeps the server config out of client entry points and public env names", () => {
    const configPath = resolve(process.cwd(), "lib/research/ai/config.server.ts");
    const configSource = readFileSync(configPath, "utf8");
    expect(configSource).toContain('typeof window !== "undefined"');
    expect(configSource).toContain('import "server-only"');
    expect(configSource).not.toContain("NEXT_PUBLIC_");

    for (const file of ["app/page.tsx", "app/discover/page.tsx", "components/app-shell.tsx"]) {
      expect(readFileSync(resolve(process.cwd(), file), "utf8")).not.toContain("config.server");
    }
  });
});
