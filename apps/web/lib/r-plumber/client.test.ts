import { describe, it, expect, vi, beforeEach } from "vitest";
import { callRPlumber, RPlumberError, checkRPlumberHealth } from "./client";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("callRPlumber", () => {
  it("returns parsed JSON on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        summary: { mean: 42 },
        table_latex: "\\begin{table}...\\end{table}",
        figures: [],
        warnings: ["test warning"],
        r_script: "mean(data$x)",
      }),
    });

    const result = await callRPlumber("/descriptive", { data: [] }, 10_000);

    expect(result.data).toHaveProperty("summary");
    expect(result.warnings).toEqual(["test warning"]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8787/descriptive",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("throws RPlumberError on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    await expect(
      callRPlumber("/descriptive", {}, 10_000)
    ).rejects.toThrow(RPlumberError);
  });

  it("throws RPlumberError on R error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: "Column 'x' not found" }),
    });

    await expect(
      callRPlumber("/t-test", {}, 10_000)
    ).rejects.toThrow("R analysis error");
  });

  it("throws RPlumberError on timeout", async () => {
    mockFetch.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          // Listen for abort signal to reject with the correct error
          init.signal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"));
          });
        })
    );

    await expect(
      callRPlumber("/descriptive", {}, 100)
    ).rejects.toThrow("timed out");
  });

  it("throws RPlumberError on connection failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(
      callRPlumber("/descriptive", {}, 10_000)
    ).rejects.toThrow("Failed to connect");
  });
});

describe("checkRPlumberHealth", () => {
  it("returns true on healthy response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const result = await checkRPlumberHealth();
    expect(result).toBe(true);
  });

  it("returns false on error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await checkRPlumberHealth();
    expect(result).toBe(false);
  });
});
