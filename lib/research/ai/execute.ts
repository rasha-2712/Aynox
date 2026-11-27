import { AIProviderError, mapAIProviderError } from "@/lib/research/ai/errors";

export interface AIProviderExecutionPolicy {
  timeoutMs: number;
  maxRetries: number;
  signal?: AbortSignal;
  baseRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

const DEFAULT_BASE_DELAY_MS = 250;
const DEFAULT_MAX_DELAY_MS = 30_000;
const MAX_RETRIES = 3;

function validatePolicy(policy: AIProviderExecutionPolicy): void {
  const baseDelay = policy.baseRetryDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelay = policy.maxRetryDelayMs ?? DEFAULT_MAX_DELAY_MS;
  if (!Number.isSafeInteger(policy.timeoutMs) || policy.timeoutMs < 100 || policy.timeoutMs > 120_000
      || !Number.isSafeInteger(policy.maxRetries) || policy.maxRetries < 0 || policy.maxRetries > MAX_RETRIES
      || !Number.isSafeInteger(baseDelay) || baseDelay < 0
      || !Number.isSafeInteger(maxDelay) || maxDelay < baseDelay || maxDelay > 120_000) {
    throw new AIProviderError("invalid_configuration");
  }
}

function retryable(error: AIProviderError): boolean {
  // Timeout/cancellation cannot prove the remote operation stopped; never retry it.
  return error.code === "rate_limited" || error.code === "provider_unavailable";
}

function retryDelay(error: AIProviderError, attempt: number, policy: AIProviderExecutionPolicy): number | null {
  const base = policy.baseRetryDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maximum = policy.maxRetryDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const exponential = Math.min(maximum, base * (2 ** attempt));
  if (error.retryAfterMs === undefined) return exponential;
  return error.retryAfterMs <= maximum ? Math.max(exponential, error.retryAfterMs) : null;
}

async function runOnce<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  callerSignal?: AbortSignal
): Promise<T> {
  if (callerSignal?.aborted) throw new AIProviderError("request_cancelled");
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  let cancelled = false;
  let onAbort: (() => void) | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new AIProviderError("request_timeout"));
    }, timeoutMs);
  });
  const cancellation = new Promise<never>((_, reject) => {
    if (!callerSignal) return;
    onAbort = () => {
      cancelled = true;
      controller.abort();
      reject(new AIProviderError("request_cancelled"));
    };
    if (callerSignal.aborted) onAbort();
    else callerSignal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), timeout, cancellation]);
  } catch (error) {
    if (cancelled || callerSignal?.aborted) throw new AIProviderError("request_cancelled");
    if (timedOut) throw new AIProviderError("request_timeout");
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    callerSignal?.removeEventListener("abort", abortFromCaller);
    if (onAbort) callerSignal?.removeEventListener("abort", onAbort);
  }
}

function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new AIProviderError("request_cancelled"));
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, milliseconds);
    const onAbort = () => { clearTimeout(timer); reject(new AIProviderError("request_cancelled")); };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Executes one operation with a per-attempt timeout and bounded transient-only retries. */
export async function executeAIProviderRequest<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  policy: AIProviderExecutionPolicy
): Promise<T> {
  validatePolicy(policy);
  const sleep = policy.sleep ?? ((milliseconds: number) => delay(milliseconds, policy.signal));
  for (let attempt = 0; ; attempt += 1) {
    if (policy.signal?.aborted) throw new AIProviderError("request_cancelled");
    try {
      return await runOnce(operation, policy.timeoutMs, policy.signal);
    } catch (rawError) {
      const error = mapAIProviderError(rawError);
      if (policy.signal?.aborted) throw new AIProviderError("request_cancelled");
      if (!retryable(error) || attempt >= policy.maxRetries) throw error;
      const delay = retryDelay(error, attempt, policy);
      if (delay === null) throw error;
      await sleep(delay);
    }
  }
}
