import { describe, it, expect } from "vitest";
import { getChecklist, getAvailableGuidelines } from "./checklists";

describe("checklists", () => {
  it("returns all 5 guideline types", () => {
    const guidelines = getAvailableGuidelines();
    expect(guidelines).toEqual(["CONSORT", "STROBE", "PRISMA", "STARD", "CARE"]);
  });

  it("returns CONSORT checklist with 25 items", () => {
    const checklist = getChecklist("CONSORT");
    expect(checklist).toHaveLength(25);
  });

  it("returns STROBE checklist with 22 items", () => {
    const checklist = getChecklist("STROBE");
    expect(checklist).toHaveLength(22);
  });

  it("returns PRISMA checklist with 27 items", () => {
    const checklist = getChecklist("PRISMA");
    expect(checklist).toHaveLength(27);
  });

  it("returns STARD checklist with 30 items", () => {
    const checklist = getChecklist("STARD");
    expect(checklist).toHaveLength(30);
  });

  it("returns CARE checklist with 13 items", () => {
    const checklist = getChecklist("CARE");
    expect(checklist).toHaveLength(13);
  });

  it("every item has required fields", () => {
    for (const guideline of getAvailableGuidelines()) {
      const checklist = getChecklist(guideline);
      for (const item of checklist) {
        expect(item.id).toBeTruthy();
        expect(item.description).toBeTruthy();
        expect(item.section_phases).toBeInstanceOf(Array);
        expect(item.section_phases.length).toBeGreaterThan(0);
        expect(typeof item.required).toBe("boolean");
      }
    }
  });

  it("all section_phases are valid phase numbers (0-11)", () => {
    for (const guideline of getAvailableGuidelines()) {
      const checklist = getChecklist(guideline);
      for (const item of checklist) {
        for (const phase of item.section_phases) {
          expect(phase).toBeGreaterThanOrEqual(0);
          expect(phase).toBeLessThanOrEqual(11);
        }
      }
    }
  });

  it("all item IDs are unique within each checklist", () => {
    for (const guideline of getAvailableGuidelines()) {
      const checklist = getChecklist(guideline);
      const ids = checklist.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
