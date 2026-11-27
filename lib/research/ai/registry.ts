import { AIProviderError } from "@/lib/research/ai/errors";
import type { AIProviderConfiguration } from "@/lib/research/ai/config.server";
import type { ResearchGenerationProvider } from "@/types/research-ai";

export type ResearchGenerationProviderFactory = (configuration: AIProviderConfiguration) => ResearchGenerationProvider;
export interface ResearchGenerationProviderRegistration {
  readonly supportedModelIds: readonly string[];
  readonly create: ResearchGenerationProviderFactory;
}
export type ResearchGenerationProviderRegistry = Readonly<Record<string, ResearchGenerationProviderRegistration>>;

/** Selects only an explicitly registered provider; there is no implicit fallback adapter. */
export function createResearchGenerationProvider(
  configuration: AIProviderConfiguration,
  registry: ResearchGenerationProviderRegistry
): ResearchGenerationProvider {
  if (!Object.prototype.hasOwnProperty.call(registry, configuration.providerId)) throw new AIProviderError("unsupported_operation");
  const registration = registry[configuration.providerId];
  if (!registration || !Array.isArray(registration.supportedModelIds) || typeof registration.create !== "function") {
    throw new AIProviderError("invalid_configuration");
  }
  if (!registration.supportedModelIds.includes(configuration.modelId)) throw new AIProviderError("unsupported_operation");
  const provider = registration.create(configuration);
  if (!provider || provider.providerId !== configuration.providerId || provider.modelId !== configuration.modelId
      || typeof provider.generateStructuredReport !== "function") {
    throw new AIProviderError("invalid_configuration");
  }
  return provider;
}
