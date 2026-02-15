import { describe, it, expect } from "vitest";
import { extractPRISMACounts, generatePRISMAFlowMermaid } from "./prisma-flow";
import type { Section } from "@/lib/types/database";

const makeSection = (phase: number, content: string): Section =>
  ({
    id: `s-${phase}`,
    project_id: "p1",
    phase_number: phase,
    phase_name: `phase_${phase}`,
    latex_content: content,
    rich_content_json: null,
    ai_generated_latex: null,
    ai_conversation_id: null,
    word_count: content.split(/\s+/).length,
    citation_keys: [],
    status: "approved",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }) as Section;

describe("extractPRISMACounts", () => {
  it("extracts numbers from ROL section content", () => {
    const sections = [
      makeSection(
        4,
        "A total of 450 records were identified through database searching. " +
          "After removing 120 duplicates, 330 records were screened. " +
          "250 records excluded based on title and abstract screening. " +
          "80 full-text articles assessed for eligibility. " +
          "35 full-text articles were excluded. " +
          "45 studies were included in qualitative synthesis. " +
          "30 studies were included in meta-analysis."
      ),
    ];

    const counts = extractPRISMACounts(sections);
    expect(counts.identified).toBe(450);
    expect(counts.duplicatesRemoved).toBe(120);
    expect(counts.screened).toBe(330);
    expect(counts.excludedScreening).toBe(250);
    expect(counts.fullTextAssessed).toBe(80);
    expect(counts.excludedFullText).toBe(35);
    expect(counts.includedQualitative).toBe(45);
    expect(counts.includedQuantitative).toBe(30);
  });

  it("returns zeros for empty sections", () => {
    const counts = extractPRISMACounts([]);
    expect(counts.identified).toBe(0);
    expect(counts.includedQuantitative).toBe(0);
  });
});

describe("generatePRISMAFlowMermaid", () => {
  it("generates valid Mermaid syntax", () => {
    const sections = [
      makeSection(4, "200 articles were identified. 50 duplicates removed."),
    ];

    const mermaid = generatePRISMAFlowMermaid(sections);
    expect(mermaid).toContain("flowchart TD");
    expect(mermaid).toContain("200");
    expect(mermaid).toContain("database searching");
    expect(mermaid).toContain("qualitative synthesis");
    expect(mermaid).toContain("meta-analysis");
  });

  it("uses placeholder n for missing counts", () => {
    const mermaid = generatePRISMAFlowMermaid([]);
    expect(mermaid).toContain("(n = n)");
  });
});
