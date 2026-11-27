import { afterEach, describe, expect, it, vi } from "vitest";
import { AIProviderError } from "@/lib/research/ai/errors";
import { executeAIProviderRequest } from "@/lib/research/ai/execute";

afterEach(() => vi.useRealTimers());

const policy = {
  timeoutMs: 1_000,
  maxRetries: 2,
  sleep: async () => undefined
};

describe("bounded AI provider execution", () => {
  it("returns a successful provider result without retrying", async () => {
    const operation = vi.fn(async () => "ok");
    await expect(executeAIProviderRequest(operation, policy)).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("retries transient provider failures only up to the configured limit", async () => {
    let calls = 0;
    const operation = async () => {
      calls += 1;
      if (calls < 3) throw new AIProviderError("provider_unavailable");
      return "recovered";
    };
    const delays: number[] = [];
    await expect(executeAIProviderRequest(operation, { ...policy, maxRetries: 2, sleep: async (delay) => { delays.push(delay); } })).resolves.toBe("recovered");
    expect(calls).toBe(3);
    expect(delays).toEqual([250, 500]);
  });

  it("does not retry authentication, malformed output or other permanent failures", async () => {
    const operation = vi.fn(async () => { throw new AIProviderError("authentication_failed"); });
    await expect(executeAIProviderRequest(operation, policy)).rejects.toMatchObject({ code: "authentication_failed" });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("respects retry-after and declines a retry beyond the bounded delay", async () => {
    const operation = vi.fn(async () => { throw new AIProviderError("rate_limited", { retryAfterMs: 2_000 }); });
    const sleep = vi.fn(async () => undefined);
    await expect(executeAIProviderRequest(operation, { ...policy, maxRetryDelayMs: 1_000, sleep })).rejects.toMatchObject({ code: "rate_limited" });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("uses valid Retry-After header guidance when retrying", async () => {
    let calls = 0;
    const operation = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw { status: 429, headers: { "retry-after": "0.75" } };
      return "recovered";
    });
    const sleep = vi.fn(async () => undefined);
    await expect(executeAIProviderRequest(operation, { ...policy, sleep })).resolves.toBe("recovered");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenLastCalledWith(750);
  });

  it("falls back for invalid Retry-After and rejects excessive guidance without retrying", async () => {
    let invalidHeaderCalls = 0;
    const invalidHeaderOperation = vi.fn(async () => {
      invalidHeaderCalls += 1;
      if (invalidHeaderCalls === 1) throw { status: 429, headers: { "retry-after": "later" } };
      return "recovered";
    });
    const invalidHeaderSleep = vi.fn(async () => undefined);
    await expect(executeAIProviderRequest(invalidHeaderOperation, { ...policy, sleep: invalidHeaderSleep })).resolves.toBe("recovered");
    expect(invalidHeaderOperation).toHaveBeenCalledTimes(2);
    expect(invalidHeaderSleep).toHaveBeenCalledTimes(1);
    expect(invalidHeaderSleep).toHaveBeenLastCalledWith(250);

    const excessiveHeaderOperation = vi.fn(async () => { throw { status: 429, headers: { "retry-after": "2" } }; });
    const excessiveHeaderSleep = vi.fn(async () => undefined);
    await expect(executeAIProviderRequest(excessiveHeaderOperation, {
      ...policy, maxRetryDelayMs: 1_000, sleep: excessiveHeaderSleep
    })).rejects.toMatchObject({ code: "rate_limited" });
    expect(excessiveHeaderOperation).toHaveBeenCalledTimes(1);
    expect(excessiveHeaderSleep).not.toHaveBeenCalled();
  });

  it("cancels during retry delay without starting another attempt", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const operation = vi.fn(async () => { throw new AIProviderError("provider_unavailable"); });
    const result = executeAIProviderRequest(operation, { timeoutMs: policy.timeoutMs, maxRetries: policy.maxRetries, signal: controller.signal });
    await vi.advanceTimersByTimeAsync(0);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);

    controller.abort();
    await expect(result).rejects.toMatchObject({ code: "request_cancelled" });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts a timed-out request and returns a typed timeout error", async () => {
    vi.useFakeTimers();
    let observedSignal: AbortSignal | undefined;
    const operation = vi.fn((signal: AbortSignal) => {
      observedSignal = signal;
      return new Promise<string>(() => undefined);
    });
    const result = executeAIProviderRequest(operation, { timeoutMs: 100, maxRetries: 2, sleep: async () => undefined });
    const assertion = expect(result).rejects.toMatchObject({ code: "request_timeout" });
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(observedSignal?.aborted).toBe(true);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("does not retry or overlap a provider operation that ignores cancellation", async () => {
    vi.useFakeTimers();
    let observedSignal: AbortSignal | undefined;
    const operation = vi.fn((signal: AbortSignal) => {
      observedSignal = signal;
      return new Promise<string>(() => undefined);
    });
    const result = executeAIProviderRequest(operation, { timeoutMs: 100, maxRetries: 3, sleep: async () => undefined });
    const assertion = expect(result).rejects.toMatchObject({ code: "request_timeout" });
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(observedSignal?.aborted).toBe(true);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("propagates caller cancellation and never retries", async () => {
    const controller = new AbortController();
    let observedSignal: AbortSignal | undefined;
    const operation = vi.fn((signal: AbortSignal) => {
      observedSignal = signal;
      return new Promise<string>(() => undefined);
    });
    const result = executeAIProviderRequest(operation, { ...policy, signal: controller.signal });
    await Promise.resolve();
    controller.abort();
    await expect(result).rejects.toMatchObject({ code: "request_cancelled" });
    expect(observedSignal?.aborted).toBe(true);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("does not retry permanent HTTP 500 or 501 responses", async () => {
    for (const status of [500, 501]) {
      const operation = vi.fn(async () => { throw { status, code: "vendor-private-code" }; });
      await expect(executeAIProviderRequest(operation, policy)).rejects.toMatchObject({ code: "invalid_provider_response" });
      expect(operation).toHaveBeenCalledTimes(1);
    }
  });

  it("does not retry or overlap a request whose adapter ignores timeout cancellation", async () => {
    vi.useFakeTimers();
    let calls = 0;
    let inFlight = 0;
    let peakInFlight = 0;
    let observedSignal: AbortSignal | undefined;
    const operation = (signal: AbortSignal) => {
      calls += 1;
      inFlight += 1;
      peakInFlight = Math.max(peakInFlight, inFlight);
      observedSignal = signal;
      // Deliberately ignores abort and remains active forever.
      return new Promise<string>(() => undefined);
    };
    const result = executeAIProviderRequest(operation, { timeoutMs: 100, maxRetries: 3 });
    const assertion = expect(result).rejects.toMatchObject({ code: "request_timeout" });
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(observedSignal?.aborted).toBe(true);
    expect(calls).toBe(1);
    expect(peakInFlight).toBe(1);
    expect(inFlight).toBe(1);
  });

  it("propagates caller cancellation and never starts a retry", async () => {
    const controller = new AbortController();
    let calls = 0;
    let observedSignal: AbortSignal | undefined;
    const operation = (signal: AbortSignal) => {
      calls += 1;
      observedSignal = signal;
      return new Promise<string>(() => undefined);
    };
    const result = executeAIProviderRequest(operation, { ...policy, signal: controller.signal });
    await Promise.resolve();
    controller.abort();
    await expect(result).rejects.toMatchObject({ code: "request_cancelled" });
    expect(observedSignal?.aborted).toBe(true);
    expect(calls).toBe(1);
  });

  it("does not retry permanent HTTP server errors", async () => {
    const operation = vi.fn(async () => { throw { status: 500, message: "private provider body" }; });
    await expect(executeAIProviderRequest(operation, policy)).rejects.toMatchObject({ code: "invalid_provider_response" });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("rejects unbounded or invalid execution policy values", async () => {
    await expect(executeAIProviderRequest(async () => "unused", { timeoutMs: 1_000, maxRetries: 100 })).rejects.toMatchObject({
      code: "invalid_configuration"
    });
  });
});
