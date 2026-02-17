import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimit, resetRateLimit, clearAllRateLimits } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    clearAllRateLimits();
    vi.restoreAllMocks();
  });

  it("should allow the first request", async () => {
    const result = await checkRateLimit("user-1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("should allow up to 10 requests", async () => {
    for (let i = 0; i < 10; i++) {
      const result = await checkRateLimit("user-2");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9 - i);
    }
  });

  it("should deny the 11th request within the window", async () => {
    for (let i = 0; i < 10; i++) {
      await checkRateLimit("user-3");
    }
    const result = await checkRateLimit("user-3");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("should track users independently", async () => {
    for (let i = 0; i < 10; i++) {
      await checkRateLimit("user-4");
    }
    const result = await checkRateLimit("user-5");
    expect(result.allowed).toBe(true);
  });

  it("should allow requests after the window expires", async () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    for (let i = 0; i < 10; i++) {
      await checkRateLimit("user-6");
    }

    // Advance time past the 1-hour window
    vi.spyOn(Date, "now").mockReturnValue(now + 3601000);

    const result = await checkRateLimit("user-6");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("should reset rate limit for a user", async () => {
    for (let i = 0; i < 10; i++) {
      await checkRateLimit("user-7");
    }
    resetRateLimit("user-7");
    const result = await checkRateLimit("user-7");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });
});
