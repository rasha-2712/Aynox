import { describe, expect, it } from "vitest";
import { AIProviderError, mapAIProviderError } from "@/lib/research/ai/errors";

describe("AI provider error mapping", () => {
  it.each([
    [{ status: 401, message: "secret key leaked in vendor text" }, "authentication_failed"],
    [{ status: 429, code: "rate_limit_exceeded", retryAfterMs: 1500 }, "rate_limited"],
    [{ status: 504 }, "request_timeout"],
    [{ status: 503, message: "private payload" }, "provider_unavailable"],
    [{ status: 400, message: "raw response body" }, "invalid_provider_response"]
  ])("maps provider conditions to safe errors", (input, expectedCode) => {
    const result = mapAIProviderError(input);
    expect(result.code).toBe(expectedCode);
    expect(result.message).not.toContain("secret");
    expect(result.message).not.toContain("private payload");
    expect(result.message).not.toContain("raw response body");
  });

  it("preserves only sanitized retry metadata and safe application text", () => {
    const result = mapAIProviderError({ status: 429, code: "rate_limit_exceeded", retryAfterMs: 500, message: "sensitive response" });
    expect(result.retryAfterMs).toBe(500);
    expect(JSON.stringify(result)).not.toContain("rate_limit_exceeded");
    expect(result.message).not.toContain("sensitive response");
  });

  it("maps raw strings and unknown objects without exposing their content", () => {
    expect(mapAIProviderError("secret provider response").code).toBe("invalid_provider_response");
    expect(mapAIProviderError({ message: "raw secret body" }).message).not.toContain("raw secret body");
  });

  it("never serializes secret-like provider codes, credentials, headers, or raw bodies", () => {
    const secret = "sk-test-super-secret-value";
    const error = mapAIProviderError({
      status: 400,
      code: secret,
      message: `Authorization: Bearer ${secret}`,
      headers: { authorization: `Bearer ${secret}` },
      body: `raw response ${secret}`
    });
    const serialized = JSON.stringify(error);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("Authorization");
    expect(serialized).not.toContain("raw response");
  });

  it("retains safe domain errors unchanged", () => {
    const error = new AIProviderError("unsupported_operation");
    expect(mapAIProviderError(error)).toBe(error);
    expect(error.message).toBe("The requested AI provider operation is not supported.");
  });

  it("does not serialize credential-like provider codes or raw metadata", () => {
    const secret = "sk_test_secret_123456789";
    const result = mapAIProviderError({ status: 400, code: secret, message: secret, headers: { authorization: secret }, body: secret });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain("authorization");
  });

  it("classifies permanent server errors separately from transient ones", () => {
    expect(mapAIProviderError({ status: 501 }).code).toBe("invalid_provider_response");
    expect(mapAIProviderError({ status: 500 }).code).toBe("invalid_provider_response");
    expect(mapAIProviderError({ status: 502 }).code).toBe("provider_unavailable");
    expect(mapAIProviderError({ status: 503 }).code).toBe("provider_unavailable");
  });
});
