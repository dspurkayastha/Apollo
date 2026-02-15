import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAnalysis } from "./analysis-runner";
import type { Analysis } from "@/lib/types/database";

// Mock dependencies
vi.mock("./client", () => ({
  callRPlumber: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({
    from: () => ({
      insert: () => ({
        select: () => ({ single: () => ({ data: { id: "fig-1" }, error: null }) }),
      }),
    }),
  }),
}));

import { callRPlumber } from "./client";
const mockCallRPlumber = vi.mocked(callRPlumber);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runAnalysis", () => {
  const mockAnalysis: Analysis = {
    id: "analysis-1",
    project_id: "project-1",
    dataset_id: "dataset-1",
    analysis_type: "descriptive",
    parameters_json: { outcome: "bmi", group: "sex", confidence_level: 0.95 },
    results_json: {},
    figures_urls: [],
    r_script: null,
    status: "pending",
    created_at: new Date().toISOString(),
  };

  it("dispatches to correct R endpoint based on analysis type", async () => {
    mockCallRPlumber.mockResolvedValueOnce({
      data: {
        summary: { n: 100 },
        table_latex: "\\begin{table}...\\end{table}",
        figures: [],
        warnings: [],
        r_script: "tbl_summary(data)",
      },
      warnings: [],
    });

    const result = await runAnalysis(mockAnalysis, [
      { bmi: 25, sex: "M" },
      { bmi: 22, sex: "F" },
    ]);

    expect(mockCallRPlumber).toHaveBeenCalledWith(
      "/descriptive",
      expect.objectContaining({
        data: expect.any(Array),
        outcome: "bmi",
        group: "sex",
      }),
      15000 // descriptive timeout
    );

    expect(result.results_json).toHaveProperty("summary");
    expect(result.r_script).toBe("tbl_summary(data)");
  });

  it("handles figures from R response", async () => {
    mockCallRPlumber.mockResolvedValueOnce({
      data: {
        summary: {},
        table_latex: "",
        figures: [
          { filename: "plot.pdf", base64: "dGVzdA==" },
        ],
        warnings: [],
        r_script: "",
      },
      warnings: [],
    });

    const result = await runAnalysis(mockAnalysis, []);

    expect(result.figures_urls).toHaveLength(1);
    expect(result.figures_urls[0]).toContain("figures/");
  });

  it("throws for unknown analysis type", async () => {
    const badAnalysis = { ...mockAnalysis, analysis_type: "nonexistent" };
    await expect(runAnalysis(badAnalysis, [])).rejects.toThrow(
      "Unknown analysis type"
    );
  });
});
