import { describe, it, expect } from "vitest";
import { auditCitations } from "./audit";
import type { Section, Citation } from "@/lib/types/database";

// Helper to create minimal section objects
function makeSection(
  phaseNumber: number,
  citationKeys: string[]
): Section {
  return {
    id: `section-${phaseNumber}`,
    project_id: "project-1",
    phase_number: phaseNumber,
    phase_name: `phase_${phaseNumber}`,
    latex_content: "",
    rich_content_json: null,
    ai_generated_latex: null,
    streaming_content: "",
    word_count: 100,
    citation_keys: citationKeys,
    status: "approved",
    ai_conversation_id: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

function makeCitation(
  citeKey: string,
  tier: "A" | "B" | "C" | "D"
): Citation {
  return {
    id: `citation-${citeKey}`,
    project_id: "project-1",
    cite_key: citeKey,
    bibtex_entry: `@article{${citeKey}, title = {Test}}`,
    provenance_tier: tier,
    evidence_type: tier === "A" ? "doi" : null,
    evidence_value: null,
    source_doi: null,
    source_pmid: null,
    attested_by_user_id: null,
    attested_at: null,
    used_in_sections: [],
    serial_number: null,
    verified_at: null,
    created_at: "2024-01-01T00:00:00Z",
  };
}

describe("auditCitations", () => {
  it("should report perfect score when all citations match", () => {
    const sections = [
      makeSection(2, ["smith2024", "jones2023"]),
      makeSection(4, ["smith2024"]),
    ];
    const citations = [
      makeCitation("smith2024", "A"),
      makeCitation("jones2023", "A"),
    ];

    const result = auditCitations(sections, citations);
    expect(result.missingCitations).toHaveLength(0);
    expect(result.orphanedCitations).toHaveLength(0);
    expect(result.tierDBlocking).toHaveLength(0);
    expect(result.integrityScore).toBe(100);
  });

  it("should detect missing citations", () => {
    const sections = [makeSection(2, ["smith2024", "unknown2024"])];
    const citations = [makeCitation("smith2024", "A")];

    const result = auditCitations(sections, citations);
    expect(result.missingCitations).toHaveLength(1);
    expect(result.missingCitations[0].citeKey).toBe("unknown2024");
    expect(result.missingCitations[0].usedInPhases).toEqual([2]);
  });

  it("should detect orphaned citations", () => {
    const sections = [makeSection(2, ["smith2024"])];
    const citations = [
      makeCitation("smith2024", "A"),
      makeCitation("orphan2023", "B"),
    ];

    const result = auditCitations(sections, citations);
    expect(result.orphanedCitations).toHaveLength(1);
    expect(result.orphanedCitations[0].citeKey).toBe("orphan2023");
  });

  it("should flag Tier D blocking citations", () => {
    const sections = [makeSection(2, ["unverified2024"])];
    const citations = [makeCitation("unverified2024", "D")];

    const result = auditCitations(sections, citations);
    expect(result.tierDBlocking).toHaveLength(1);
    expect(result.tierDBlocking[0].citeKey).toBe("unverified2024");
    expect(result.tierDBlocking[0].usedInPhases).toEqual([2]);
  });

  it("should calculate correct integrity score", () => {
    const sections = [
      makeSection(2, ["good1", "good2", "bad1"]),
    ];
    const citations = [
      makeCitation("good1", "A"),
      makeCitation("good2", "B"),
      makeCitation("bad1", "D"),
    ];

    const result = auditCitations(sections, citations);
    // 2 out of 3 are A/B/C → score ≈ 67%
    expect(result.integrityScore).toBe(67);
  });

  it("should handle empty sections", () => {
    const result = auditCitations([], [makeCitation("orphan", "A")]);
    expect(result.missingCitations).toHaveLength(0);
    expect(result.orphanedCitations).toHaveLength(1);
    expect(result.integrityScore).toBe(100);
  });

  it("should handle empty citations", () => {
    const result = auditCitations(
      [makeSection(2, ["ref1"])],
      []
    );
    expect(result.missingCitations).toHaveLength(1);
    expect(result.orphanedCitations).toHaveLength(0);
    expect(result.integrityScore).toBe(0);
  });

  it("should handle sections with no citation keys", () => {
    const sections = [makeSection(2, [])];
    const citations = [makeCitation("orphan", "A")];

    const result = auditCitations(sections, citations);
    expect(result.totalCiteCommands).toBe(0);
    expect(result.orphanedCitations).toHaveLength(1);
    expect(result.integrityScore).toBe(100);
  });

  it("should track usedInPhases across multiple sections", () => {
    const sections = [
      makeSection(2, ["shared"]),
      makeSection(4, ["shared"]),
      makeSection(7, ["shared"]),
    ];
    const citations = [] as Citation[];

    const result = auditCitations(sections, citations);
    expect(result.missingCitations).toHaveLength(1);
    expect(result.missingCitations[0].usedInPhases).toEqual([2, 4, 7]);
  });

  it("should count total citations and cite commands", () => {
    const sections = [
      makeSection(2, ["a", "b"]),
      makeSection(4, ["a", "c"]),
    ];
    const citations = [
      makeCitation("a", "A"),
      makeCitation("b", "A"),
      makeCitation("c", "A"),
    ];

    const result = auditCitations(sections, citations);
    expect(result.totalCitations).toBe(3);
    expect(result.totalCiteCommands).toBe(4); // 2 + 2
  });
});
