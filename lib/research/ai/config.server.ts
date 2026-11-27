import "server-only";
import { AIProviderError } from "@/lib/research/ai/errors";

export interface AIProviderConfiguration {
  providerId: string;
  modelId: string;
  apiKey: string;
  timeoutMs: number;
  maxRetries: number;
}

export type AIProviderConfigurationResult =
  | { ok: true; config: AIProviderConfiguration }
  | { ok: false; errors: AIProviderError[] };

const DEFAULT_TIMEOUT_MS = 10_000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_RETRIES = 2;
const MAX_RETRIES = 3;
const PROVIDER_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function requiredValue(
  env: Record<string, string | undefined>,
  key: string,
  errors: AIProviderError[]
): string | null {
  const value = env[key]?.trim();
  if (!value) {
    errors.push(new AIProviderError("missing_configuration"));
    return null;
  }
  return value;
}

function integerSetting(
  env: Record<string, string | undefined>,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
  errors: AIProviderError[]
): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === "") return fallback;
  if (!/^(0|[1-9]\d*)$/.test(raw.trim())) {
    errors.push(new AIProviderError("invalid_configuration"));
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    errors.push(new AIProviderError("invalid_configuration"));
    return fallback;
  }
  return value;
}

/** Pure parser for explicit server environment settings. It never supplies provider/model/key fallbacks. */
export function parseAIProviderConfiguration(
  env: Record<string, string | undefined>
): AIProviderConfigurationResult {
  const errors: AIProviderError[] = [];
  const providerId = requiredValue(env, "AYNOX_AI_PROVIDER", errors);
  const modelId = requiredValue(env, "AYNOX_AI_MODEL", errors);
  const apiKey = requiredValue(env, "AYNOX_AI_API_KEY", errors);
  const timeoutMs = integerSetting(env, "AYNOX_AI_TIMEOUT_MS", DEFAULT_TIMEOUT_MS, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS, errors);
  const maxRetries = integerSetting(env, "AYNOX_AI_MAX_RETRIES", DEFAULT_MAX_RETRIES, 0, MAX_RETRIES, errors);

  if (providerId && !PROVIDER_ID.test(providerId)) errors.push(new AIProviderError("invalid_configuration"));
  if (modelId && !MODEL_ID.test(modelId)) errors.push(new AIProviderError("invalid_configuration"));
  if (errors.length || !providerId || !modelId || !apiKey) return { ok: false, errors };
  return { ok: true, config: { providerId, modelId, apiKey, timeoutMs, maxRetries } };
}

/**
 * Server-only entry point. The runtime guard prevents accidental browser use;
 * keep this module out of client component imports.
 */
export function getAIProviderConfiguration(): AIProviderConfigurationResult {
  if (typeof window !== "undefined") {
    return { ok: false, errors: [new AIProviderError("unsupported_operation")] };
  }
  return parseAIProviderConfiguration({
    AYNOX_AI_PROVIDER: process.env.AYNOX_AI_PROVIDER,
    AYNOX_AI_MODEL: process.env.AYNOX_AI_MODEL,
    AYNOX_AI_API_KEY: process.env.AYNOX_AI_API_KEY,
    AYNOX_AI_TIMEOUT_MS: process.env.AYNOX_AI_TIMEOUT_MS,
    AYNOX_AI_MAX_RETRIES: process.env.AYNOX_AI_MAX_RETRIES
  });
}
