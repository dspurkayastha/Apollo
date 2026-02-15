import { describe, it, expect } from "vitest";
import { generateAbbreviationsLatex } from "./abbreviations";
import type { Abbreviation } from "@/lib/types/database";

function makeAbbr(short_form: string, long_form: string): Abbreviation {
  return {
    id: "test-id",
    project_id: "proj-id",
    short_form,
    long_form,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe("generateAbbreviationsLatex", () => {
  it("should return empty string for no abbreviations", () => {
    expect(generateAbbreviationsLatex([])).toBe("");
  });

  it("should generate a single abbreviation row", () => {
    const result = generateAbbreviationsLatex([makeAbbr("WHO", "World Health Organisation")]);
    expect(result).toContain("\\begin{abbreviations}");
    expect(result).toContain("WHO & World Health Organisation");
    expect(result).toContain("\\end{abbreviations}");
  });

  it("should sort abbreviations alphabetically", () => {
    const abbrs = [
      makeAbbr("WHO", "World Health Organisation"),
      makeAbbr("BMI", "Body Mass Index"),
      makeAbbr("CT", "Computed Tomography"),
    ];
    const result = generateAbbreviationsLatex(abbrs);
    const bmiPos = result.indexOf("BMI");
    const ctPos = result.indexOf("CT");
    const whoPos = result.indexOf("WHO");
    expect(bmiPos).toBeLessThan(ctPos);
    expect(ctPos).toBeLessThan(whoPos);
  });

  it("should escape special LaTeX characters", () => {
    const result = generateAbbreviationsLatex([makeAbbr("R&D", "Research & Development")]);
    expect(result).toContain("R\\&D");
    expect(result).toContain("Research \\& Development");
  });
});
