/**
 * E2E Citation Pipeline Integration Test
 *
 * Exercises the full citation provenance pipeline:
 *   AI-generated LaTeX → splitBibtex → resolveAllEntries → auditCitations
 *
 * Tests:
 * - BibTeX extraction from AI output
 * - Citation resolution (DOI, PMID, title search, unresolvable)
 * - Bidirectional audit integrity checks
 * - Auto-resolve skip logic for verified citations
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { splitBibtex } from "@/lib/latex/assemble";
import {
  parseBibtexEntries,
  extractHints,
  resolveEntry,
  resolveAllEntries,
} from "@/lib/citations/resolve";
import { auditCitations } from "@/lib/citations/audit";
import type { Section, Citation } from "@/lib/types/database";

// Mock external HTTP calls
vi.mock("@/lib/citations/crossref", () => ({
  lookupDOI: vi.fn(),
  searchCrossRef: vi.fn(),
  crossRefWorkToBibtex: vi.fn(
    (_work: unknown, citeKey: string) =>
      `@article{${citeKey},\n  title = {Fallback}\n}`
  ),
  stripDoiField: vi.fn((s: string) =>
    s.replace(/^\s*doi\s*=\s*\{[^}]*\},?\s*$/gm, "").trim()
  ),
}));

vi.mock("@/lib/citations/pubmed", () => ({
  lookupPMID: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Realistic AI-generated content with BibTeX trailer ──────────────────────

const AI_OUTPUT_WITH_CITATIONS = `\\section{Introduction}

Ventral hernias represent a significant global surgical challenge\\cite{Sanders2013}.
Studies indicate ventral hernias constitute 4--6\\% of surgical admissions\\cite{Jaykar2022}.

\\subsection{Clinical Significance}

Emergency surgical mortality of 6--10\\%\\cite{Thompson2023}.

---BIBTEX---
@article{Sanders2013,
  author = {Sanders, David L and Kingsnorth, Andrew N},
  title = {The modern management of incisional hernias},
  journal = {BMJ},
  year = {2013},
  volume = {344},
  doi = {10.1136/bmj.e2843}
}

@article{Jaykar2022,
  author = {Jaykar, R D and Baviskar, P K},
  title = {Clinical study of ventral hernia},
  journal = {Indian Journal of Surgery},
  year = {2022},
  note = {PMID: 35123456}
}

@article{Thompson2023,
  author = {Thompson, J S},
  title = {Review of abdominal wall hernias},
  journal = {Surgical Clinics},
  year = {2023}
}`;

describe("Citation E2E Pipeline", () => {
  describe("Step 1: BibTeX extraction from AI output", () => {
    it("should split AI output into body and BibTeX", () => {
      const { body, bib } = splitBibtex(AI_OUTPUT_WITH_CITATIONS);

      expect(body).toContain("\\section{Introduction}");
      expect(body).toContain("\\cite{Sanders2013}");
      expect(body).not.toContain("@article{");

      expect(bib).toContain("@article{Sanders2013,");
      expect(bib).toContain("@article{Jaykar2022,");
      expect(bib).toContain("@article{Thompson2023,");
    });

    it("should parse individual BibTeX entries", () => {
      const { bib } = splitBibtex(AI_OUTPUT_WITH_CITATIONS);
      const entries = parseBibtexEntries(bib);

      expect(entries.size).toBe(3);
      expect(entries.has("Sanders2013")).toBe(true);
      expect(entries.has("Jaykar2022")).toBe(true);
      expect(entries.has("Thompson2023")).toBe(true);
    });

    it("should extract DOI and PMID hints", () => {
      const { bib } = splitBibtex(AI_OUTPUT_WITH_CITATIONS);
      const entries = parseBibtexEntries(bib);

      const sandersHints = extractHints(entries.get("Sanders2013")!);
      expect(sandersHints.doi).toBe("10.1136/bmj.e2843");
      expect(sandersHints.pmid).toBeNull();

      const jaykarHints = extractHints(entries.get("Jaykar2022")!);
      expect(jaykarHints.pmid).toBe("35123456");

      const thompsonHints = extractHints(entries.get("Thompson2023")!);
      expect(thompsonHints.doi).toBeNull();
      expect(thompsonHints.pmid).toBeNull();
    });
  });

  describe("Step 2: Citation resolution", () => {
    it("should resolve DOI → Tier A", async () => {
      const { lookupDOI } = await import("@/lib/citations/crossref");
      (lookupDOI as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        bibtex: `@article{verified, title = {Modern management of incisional hernias}}`,
        work: { doi: "10.1136/bmj.e2843" },
      });

      const { bib } = splitBibtex(AI_OUTPUT_WITH_CITATIONS);
      const entries = parseBibtexEntries(bib);
      const result = await resolveEntry("Sanders2013", entries.get("Sanders2013")!);

      expect(result.provenanceTier).toBe("A");
      expect(result.evidenceType).toBe("doi");
      expect(result.sourceDoi).toBe("10.1136/bmj.e2843");
    });

    it("should resolve PMID → Tier A", async () => {
      const { lookupDOI } = await import("@/lib/citations/crossref");
      const { lookupPMID } = await import("@/lib/citations/pubmed");

      // No DOI in Jaykar2022 entry (no DOI hint extracted)
      (lookupPMID as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        pmid: "35123456",
        title: "Clinical study of ventral hernia",
        authors: ["Jaykar R D", "Baviskar P K"],
        journal: "Indian Journal of Surgery",
        year: 2022,
        volume: null,
        issue: null,
        pages: null,
        doi: null,
      });

      const { bib } = splitBibtex(AI_OUTPUT_WITH_CITATIONS);
      const entries = parseBibtexEntries(bib);
      const result = await resolveEntry("Jaykar2022", entries.get("Jaykar2022")!);

      expect(result.provenanceTier).toBe("A");
      expect(result.evidenceType).toBe("pmid");
      expect(result.sourcePmid).toBe("35123456");
    });

    it("should fall to Tier D when unresolvable", async () => {
      const { lookupDOI, searchCrossRef } = await import(
        "@/lib/citations/crossref"
      );

      (lookupDOI as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (searchCrossRef as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        items: [],
        totalResults: 0,
      });

      const { bib } = splitBibtex(AI_OUTPUT_WITH_CITATIONS);
      const entries = parseBibtexEntries(bib);
      const result = await resolveEntry(
        "Thompson2023",
        entries.get("Thompson2023")!
      );

      expect(result.provenanceTier).toBe("D");
      expect(result.evidenceType).toBeNull();
    });
  });

  describe("Step 3: Batch resolution", () => {
    it("should resolve all entries with mixed results", async () => {
      const { lookupDOI, searchCrossRef } = await import(
        "@/lib/citations/crossref"
      );
      const { lookupPMID } = await import("@/lib/citations/pubmed");

      // Sanders2013: DOI → Tier A
      (lookupDOI as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        bibtex: `@article{verified, title = {Verified}}`,
        work: { doi: "10.1136/bmj.e2843" },
      });

      // Jaykar2022: PMID → Tier A
      (lookupPMID as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        pmid: "35123456",
        title: "Clinical study",
        authors: ["Jaykar R D"],
        journal: "IJS",
        year: 2022,
        volume: null,
        issue: null,
        pages: null,
        doi: null,
      });

      // Thompson2023: all fail → Tier D
      (lookupDOI as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      (searchCrossRef as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        items: [],
        totalResults: 0,
      });

      const { bib } = splitBibtex(AI_OUTPUT_WITH_CITATIONS);
      const result = await resolveAllEntries(bib);

      expect(result.resolved).toHaveLength(3);
      expect(result.errors).toHaveLength(0);

      const tiers = result.resolved.map((r) => r.provenanceTier).sort();
      expect(tiers).toContain("A");
      expect(tiers).toContain("D");
    });
  });

  describe("Step 4: Bidirectional audit", () => {
    const makeSection = (
      phase: number,
      keys: string[]
    ): Section => ({
      id: `s-${phase}`,
      project_id: "p1",
      phase_number: phase,
      phase_name: `phase_${phase}`,
      latex_content: "",
      rich_content_json: null,
      ai_generated_latex: null,
      streaming_content: "",
      word_count: 100,
      citation_keys: keys,
      status: "approved",
      ai_conversation_id: null,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    });

    const makeCitation = (
      key: string,
      tier: "A" | "B" | "C" | "D"
    ): Citation => ({
      id: `c-${key}`,
      project_id: "p1",
      cite_key: key,
      bibtex_entry: `@article{${key}, title = {Test}}`,
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
    });

    it("should produce clean audit when all citations match", () => {
      const sections = [
        makeSection(2, ["Sanders2013", "Jaykar2022", "Thompson2023"]),
      ];
      const citations = [
        makeCitation("Sanders2013", "A"),
        makeCitation("Jaykar2022", "A"),
        makeCitation("Thompson2023", "A"),
      ];

      const audit = auditCitations(sections, citations);

      expect(audit.missingCitations).toHaveLength(0);
      expect(audit.orphanedCitations).toHaveLength(0);
      expect(audit.tierDBlocking).toHaveLength(0);
      expect(audit.integrityScore).toBe(100);
    });

    it("should detect missing + orphaned + Tier D blocking", () => {
      const sections = [
        makeSection(2, ["Sanders2013", "Missing2024"]),
        makeSection(4, ["Thompson2023"]),
      ];
      const citations = [
        makeCitation("Sanders2013", "A"),
        makeCitation("Thompson2023", "D"),
        makeCitation("Orphan2020", "B"),
      ];

      const audit = auditCitations(sections, citations);

      expect(audit.missingCitations).toHaveLength(1);
      expect(audit.missingCitations[0].citeKey).toBe("Missing2024");

      expect(audit.orphanedCitations).toHaveLength(1);
      expect(audit.orphanedCitations[0].citeKey).toBe("Orphan2020");

      expect(audit.tierDBlocking).toHaveLength(1);
      expect(audit.tierDBlocking[0].citeKey).toBe("Thompson2023");

      // Sanders2013 (A) matches, Thompson2023 (D) doesn't count, Missing2024 not in DB
      // 1 good match out of 3 unique key-phase pairs = 33%
      expect(audit.integrityScore).toBe(33);
    });

    it("should handle student attestation flow (D → C)", () => {
      // After student attests, Tier D becomes C → no longer blocking
      const sections = [makeSection(2, ["attested2024"])];
      const citations = [makeCitation("attested2024", "C")];

      const audit = auditCitations(sections, citations);
      expect(audit.tierDBlocking).toHaveLength(0);
      expect(audit.integrityScore).toBe(100);
    });
  });
});
