import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the admin Supabase client before importing the module
const mockSelect = vi.fn();
const mockFrom = vi.fn(() => ({
  select: mockSelect,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({
    from: mockFrom,
  }),
}));

// Import after mocking
import { checkVelocity } from "@/lib/payments/velocity-check";

describe("Velocity Check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows when under the limit", async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi
          .fn()
          .mockResolvedValue({ count: 2, error: null }),
      }),
    });

    const result = await checkVelocity("user-123");
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(2);
    expect(result.limit).toBe(5);
  });

  it("blocks when at the limit", async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi
          .fn()
          .mockResolvedValue({ count: 5, error: null }),
      }),
    });

    const result = await checkVelocity("user-456");
    expect(result.allowed).toBe(false);
    expect(result.count).toBe(5);
  });

  it("blocks when over the limit", async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi
          .fn()
          .mockResolvedValue({ count: 7, error: null }),
      }),
    });

    const result = await checkVelocity("user-789");
    expect(result.allowed).toBe(false);
    expect(result.count).toBe(7);
  });

  it("fails open on DB error", async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi
          .fn()
          .mockResolvedValue({ count: null, error: { message: "DB error" } }),
      }),
    });

    const result = await checkVelocity("user-error");
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(0);
  });

  it("fails open on thrown exception", async () => {
    mockSelect.mockImplementation(() => {
      throw new Error("Connection refused");
    });

    const result = await checkVelocity("user-crash");
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(0);
  });
});
