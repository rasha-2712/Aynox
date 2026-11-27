import type { AIProviderErrorCode } from "@/types/research-ai";

export interface AIProviderErrorMetadata {
  retryAfterMs?: number;
}

const SAFE_MESSAGES: Record<AIProviderErrorCode, string> = {
  missing_configuration: "AI provider configuration is incomplete.",
  invalid_configuration: "AI provider configuration is invalid.",
  authentication_failed: "The AI provider rejected its credentials.",
  rate_limited: "The AI provider rate limit was reached.",
  request_timeout: "The AI provider request timed out.",
  request_cancelled: "The AI provider request was cancelled.",
  provider_unavailable: "The AI provider is temporarily unavailable.",
  invalid_provider_response: "The AI provider returned an invalid response.",
  output_validation_failure: "The AI response failed research report validation.",
  unsupported_operation: "The requested AI provider operation is not supported."
};

function retryDelay(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER) : undefined;
}

export class AIProviderError extends Error {
  readonly code: AIProviderErrorCode;
  readonly retryAfterMs?: number;

  constructor(code: AIProviderErrorCode, metadata: AIProviderErrorMetadata = {}) {
    super(SAFE_MESSAGES[code]);
    this.name = "AIProviderError";
    this.code = code;
    this.retryAfterMs = retryDelay(metadata.retryAfterMs);
  }
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function retryAfterFrom(error: Record<string, unknown>): number | undefined {
  const direct = retryDelay(error.retryAfterMs);
  if (direct !== undefined) return direct;
  const headers = objectRecord(error.headers);
  const raw = typeof headers?.get === "function"
    ? (headers.get as (name: string) => unknown)("retry-after")
    : headers?.["retry-after"];
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Number.isFinite(seconds * 1000) ? retryDelay(seconds * 1000) : Number.MAX_SAFE_INTEGER;
  const date = Date.parse(raw);
  return Number.isFinite(date) ? retryDelay(Math.max(0, date - Date.now())) : undefined;
}

/** Maps provider errors to fixed safe messages and small sanitized metadata. */
export function mapAIProviderError(input: unknown): AIProviderError {
  if (input instanceof AIProviderError) return input;
  const error = objectRecord(input);
  if (!error) return new AIProviderError("invalid_provider_response");

  const status = typeof error.status === "number" ? error.status : undefined;
  const providerCode = typeof error.code === "string" ? error.code : "";
  const name = typeof error.name === "string" ? error.name : "";
  if (status === 401 || status === 403 || providerCode === "authentication_error" || providerCode === "invalid_api_key") {
    return new AIProviderError("authentication_failed");
  }
  if (status === 429 || providerCode === "rate_limit_exceeded") {
    return new AIProviderError("rate_limited", { retryAfterMs: retryAfterFrom(error) });
  }
  if (status === 408 || status === 504 || name === "AbortError" || name === "TimeoutError"
      || providerCode === "ETIMEDOUT" || providerCode === "ECONNABORTED") {
    return new AIProviderError("request_timeout");
  }
  if (status === 502 || status === 503 || providerCode === "service_unavailable" || providerCode === "overloaded_error") {
    return new AIProviderError("provider_unavailable");
  }
  return new AIProviderError("invalid_provider_response");
}
