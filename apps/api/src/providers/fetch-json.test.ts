import { describe, expect, it, vi } from "vitest";
import { CircuitBreaker, fetchJsonWithRetry } from "./fetch-json";

describe("fetchJsonWithRetry", () => {
  it("retries twice after the initial failed request", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("one"))
      .mockRejectedValueOnce(new Error("two"))
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const result = await fetchJsonWithRetry("https://example.test/data", {
      fetcher,
      retries: 2,
      timeoutMs: 100,
      retryDelayMs: 0
    });
    expect(result).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

describe("CircuitBreaker", () => {
  it("opens for fifteen minutes after three consecutive failures", () => {
    let now = 1_000;
    const breaker = new CircuitBreaker({ threshold: 3, cooldownMs: 900_000, now: () => now });
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.canRequest()).toBe(true);
    breaker.recordFailure();
    expect(breaker.canRequest()).toBe(false);
    now += 900_000;
    expect(breaker.canRequest()).toBe(true);
  });

  it("closes after a successful request", () => {
    const breaker = new CircuitBreaker({ threshold: 1, cooldownMs: 900_000 });
    breaker.recordFailure();
    breaker.recordSuccess();
    expect(breaker.canRequest()).toBe(true);
  });
});
