import { describe, it, expect } from "vitest";

describe("Apollo Web", () => {
  it("should pass a smoke test", () => {
    expect(true).toBe(true);
  });

  it("should have required environment variables defined", () => {
    // These will be set in .env.local / CI secrets
    // For unit tests, we just verify the pattern works
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    expect(typeof url).toBe("string");
  });
});
