import { describe, it, expect } from "vitest";
import { checkNBEMS } from "./nbems";
import type { Section } from "@/lib/types/database";

function makeSection(phase: number, wordCount: number, content = ""): Section {
  return {
    id: `section-${phase}`,
    project_id: "project-1",
    phase_number: phase,
    phase_name: `Phase ${phase}`,
    latex_content: content,
    rich_content_json: null,
    ai_generated_latex: null,
    word_count: wordCount,
    citation_keys: [],
    status: "approved",
    ai_conversation_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe("checkNBEMS", () => {
  it("calculates page count from phases 2-8", () => {
    const sections = [
      makeSection(1, 200), // excluded from page count
      makeSection(2, 500),
      makeSection(4, 2500),
      makeSection(5, 1500),
      makeSection(7, 2000),
      makeSection(8, 500),
    ];

    const result = checkNBEMS(sections);
    // Total words: 500 + 2500 + 1500 + 2000 + 500 = 7000
    // Pages: ceil(7000 / 250) = 28
    expect(result.page_count).toBe(28);
    expect(result.page_within_limit).toBe(true);
  });

  it("detects page count exceeding 80 pages", () => {
    const sections = [
      makeSection(2, 5000),
      makeSection(4, 5000),
      makeSection(5, 5000),
      makeSection(7, 5000),
      makeSection(8, 1000),
    ];

    const result = checkNBEMS(sections);
    // Total: 21000 words → ceil(21000/250) = 84 pages
    expect(result.page_count).toBe(84);
    expect(result.page_within_limit).toBe(false);
  });

  it("extracts abstract word count from phase 1", () => {
    const content =
      "\\section*{Abstract}\nBackground: This is a test abstract with exactly twenty words for counting purposes testing the word counter function in the NBEMS checker module now.";

    const sections = [makeSection(1, 0, content)];
    const result = checkNBEMS(sections);

    expect(result.abstract_word_count).toBeGreaterThan(0);
    expect(result.abstract_within_limit).toBe(true);
  });

  it("detects abstract exceeding 300 words", () => {
    const longAbstract =
      "\\section*{Abstract}\n" +
      Array.from({ length: 350 }, () => "word").join(" ");

    const sections = [makeSection(1, 0, longAbstract)];
    const result = checkNBEMS(sections);

    expect(result.abstract_word_count).toBeGreaterThan(300);
    expect(result.abstract_within_limit).toBe(false);
  });

  it("detects PICO elements in introduction", () => {
    const intro =
      "This study enrolled patients with hypertension. " +
      "The intervention was a novel drug regimen. " +
      "Compared to standard care, the outcome was blood pressure reduction.";

    const sections = [makeSection(2, 100, intro)];
    const result = checkNBEMS(sections);

    expect(result.pico_elements.patient).toBe(true);
    expect(result.pico_elements.intervention).toBe(true);
    expect(result.pico_elements.comparison).toBe(true);
    expect(result.pico_elements.outcome).toBe(true);
    expect(result.pico_score).toBe(4);
  });

  it("handles missing sections gracefully", () => {
    const result = checkNBEMS([]);

    expect(result.page_count).toBe(0);
    expect(result.page_within_limit).toBe(true);
    expect(result.abstract_word_count).toBe(0);
    expect(result.pico_score).toBe(0);
  });
});
