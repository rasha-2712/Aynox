import { describe, expect, it } from "vitest";
import { createResearchGenerationProvider } from "@/lib/research/ai/registry";
import { AIProviderError } from "@/lib/research/ai/errors";
import type { AIProviderConfiguration } from "@/lib/research/ai/config.server";
import type { ResearchGenerationProvider } from "@/types/research-ai";

const configuration: AIProviderConfiguration = {
  providerId: "fixture",
  modelId: "fixture-model",
  apiKey: "test-only-secret",
  timeoutMs: 1_000,
  maxRetries: 0
};

describe("provider-neutral research adapter contract", () => {
  it("accepts compatible fake providers behind one interface", () => {
    const first: ResearchGenerationProvider = {
      providerId: "fixture",
      modelId: "fixture-model",
      async generateStructuredReport() { return { schemaVersion: "1.0.0" }; }
    };
    const selected = createResearchGenerationProvider(configuration, { fixture: { supportedModelIds: ["fixture-model"], create: () => first } });
    expect(selected).toBe(first);
    expect(selected.providerId).toBe(configuration.providerId);
  });

  it("selects explicitly registered adapters and has no implicit fallback", () => {
    const one: ResearchGenerationProvider = {
      providerId: "fixture", modelId: "fixture-model", async generateStructuredReport() { return {}; }
    };
    const two: ResearchGenerationProvider = {
      providerId: "other", modelId: "other-model", async generateStructuredReport() { return {}; }
    };
    const otherConfig = { ...configuration, providerId: "other", modelId: "other-model" };
    expect(createResearchGenerationProvider(otherConfig, {
      fixture: { supportedModelIds: ["fixture-model"], create: () => one },
      other: { supportedModelIds: ["other-model"], create: () => two }
    })).toBe(two);
    expect(() => createResearchGenerationProvider(configuration, {})).toThrowError(AIProviderError);
  });

  it("rejects unknown models even when an adapter merely echoes the configured ID", () => {
    const echoing: ResearchGenerationProvider = {
      providerId: "fixture", modelId: configuration.modelId, async generateStructuredReport() { return {}; }
    };
    const registration = { supportedModelIds: ["known-model"], create: () => echoing };
    expect(() => createResearchGenerationProvider(configuration, { fixture: registration })).toThrowError(AIProviderError);
    expect(() => createResearchGenerationProvider({ ...configuration, providerId: "unknown" }, { fixture: registration })).toThrowError(AIProviderError);
    expect(() => createResearchGenerationProvider(configuration, { fixture: null } as never)).toThrowError(AIProviderError);
  });

  it("rejects adapter identity that differs from configured provider/model", () => {
    const wrong: ResearchGenerationProvider = {
      providerId: "different", modelId: "different-model", async generateStructuredReport() { return {}; }
    };
    expect(() => createResearchGenerationProvider(configuration, { fixture: { supportedModelIds: ["fixture-model"], create: () => wrong } })).toThrowError(AIProviderError);
  });
});
