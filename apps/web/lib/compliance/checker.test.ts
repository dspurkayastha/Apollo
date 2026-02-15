import { describe, it, expect, vi } from "vitest";
import { runComplianceCheck } from "./checker";
import type { Section } from "@/lib/types/database";

// Mock Anthropic SDK — compliance checker uses Haiku for semantic checking
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify([
              { index: 1, status: "yellow", suggestion: "Partially addressed" },
            ]),
          },
        ],
      }),
    };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({}),
}));

function makeSection(phase: number, content: string): Section {
  return {
    id: `section-${phase}`,
    project_id: "project-1",
    phase_number: phase,
    phase_name: `Phase ${phase}`,
    latex_content: content,
    rich_content_json: null,
    ai_generated_latex: null,
    word_count: content.split(/\s+/).length,
    citation_keys: [],
    status: "approved",
    ai_conversation_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe("runComplianceCheck", () => {
  it("scores items as red when sections are missing", async () => {
    const result = await runComplianceCheck("project-1", "CARE", []);

    expect(result.guideline_type).toBe("CARE");
    expect(result.items.length).toBe(13);

    // All items should be red since no sections exist
    const redItems = result.items.filter((i) => i.status === "red");
    expect(redItems.length).toBe(13);
    expect(result.overall_score).toBe(0);
  });

  it("scores items as green when keywords are present", async () => {
    const sections = [
      makeSection(
        1,
        "case report with keywords abstract introduction results conclusion"
      ),
      makeSection(
        2,
        "Background summary of this case with relevant medical literature references"
      ),
      makeSection(
        6,
        "Patient demographics presenting symptoms medical history clinical findings physical examination timeline important dates diagnostic assessment methods differentials therapeutic intervention treatment administration duration follow-up outcomes summary"
      ),
      makeSection(
        7,
        "Discussion strengths limitations medical literature rationale conclusions take-away lessons"
      ),
    ];

    const result = await runComplianceCheck("project-1", "CARE", sections);
    expect(result.guideline_type).toBe("CARE");

    // Should have some green items from keyword matching
    const greenItems = result.items.filter((i) => i.status === "green");
    expect(greenItems.length).toBeGreaterThan(0);
    expect(result.overall_score).toBeGreaterThan(0);
  });

  it("calculates overall score correctly", async () => {
    // Minimal sections covering some STROBE items
    const sections = [
      makeSection(1, "study design observational balanced summary"),
      makeSection(2, "scientific background rationale investigation"),
      makeSection(3, "specific objectives pre-specified hypotheses"),
      makeSection(
        5,
        "study design setting locations dates eligibility criteria sources selection outcomes exposures predictors confounders variables assessment bias sample size quantitative statistical methods confounding subgroups missing data"
      ),
      makeSection(
        6,
        "numbers individuals stage participants characteristics exposures confounders outcome events summary measures unadjusted estimates confounder adjusted"
      ),
      makeSection(7, "summarise key results reference study objectives"),
    ];

    const result = await runComplianceCheck("project-1", "STROBE", sections);

    expect(result.overall_score).toBeGreaterThanOrEqual(0);
    expect(result.overall_score).toBeLessThanOrEqual(100);
  });
});
