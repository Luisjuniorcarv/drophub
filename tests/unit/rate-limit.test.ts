import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  resetRateLimitStore,
  getRateLimitHeaders,
  createRateLimitResponse,
} from "@/lib/rate-limit";

describe("ETAPA 13 — Rate Limiting Unit Tests", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("1. should allow requests within the rate limit", () => {
    const options = { limit: 3, windowMs: 1000 };
    const key = "test-ip-1";

    const res1 = checkRateLimit(key, options);
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(2);

    const res2 = checkRateLimit(key, options);
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = checkRateLimit(key, options);
    expect(res3.success).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it("2. should block requests exceeding the rate limit and calculate retryAfter", () => {
    const options = { limit: 2, windowMs: 5000 };
    const key = "test-ip-2";

    checkRateLimit(key, options);
    checkRateLimit(key, options);

    const blocked = checkRateLimit(key, options);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.retryAfter).toBeLessThanOrEqual(5);
  });

  it("3. should generate correct HTTP rate limit headers", () => {
    const options = { limit: 5, windowMs: 60000 };
    const key = "test-ip-3";

    const result = checkRateLimit(key, options);
    const headers = getRateLimitHeaders(result);

    expect(headers["X-RateLimit-Limit"]).toBe("5");
    expect(headers["X-RateLimit-Remaining"]).toBe("4");
    expect(headers["X-RateLimit-Reset"]).toBeDefined();
    expect(headers["Retry-After"]).toBeUndefined();

    // Quando bloqueado
    const blockedResult = {
      success: false,
      limit: 5,
      remaining: 0,
      reset: Math.ceil(Date.now() / 1000) + 60,
      retryAfter: 45,
    };
    const blockedHeaders = getRateLimitHeaders(blockedResult);
    expect(blockedHeaders["Retry-After"]).toBe("45");
  });

  it("4. should create standard HTTP 429 response with json error and headers", async () => {
    const blockedResult = {
      success: false,
      limit: 10,
      remaining: 0,
      reset: Math.ceil(Date.now() / 1000) + 30,
      retryAfter: 30,
    };

    const response = createRateLimitResponse(blockedResult, "Limite excedido.");
    expect(response.status).toBe(429);

    const data = await response.json();
    expect(data.error).toBe("Limite excedido.");
    expect(data.retryAfter).toBe(30);
    expect(response.headers.get("x-ratelimit-limit")).toBe("10");
  });
});
