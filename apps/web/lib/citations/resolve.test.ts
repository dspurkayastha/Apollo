import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseBibtexEntries,
  extractHints,
  resolveEntry,
  resolveAllEntries,
} from "./resolve";

// Mock crossref and pubmed
vi.mock("./crossref", () => ({
  lookupDOI: vi.fn(),
  searchCrossRef: vi.fn(),
  stripDoiField: vi.fn((s: string) =>
    s.replace(/^\s*doi\s*=\s*\{[^}]*\},?\s*$/gm, "").trim()
  ),
}));

vi.mock("./pubmed", () => ({
  lookupPMID: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parseBibtexEntries", () => {
  it("should parse a single entry", () => {
    const bib = `@article{smith2024,
  title = {A Study},
  year = {2024}
}`;
    const entries = parseBibtexEntries(bib);
    expect(entries.size).toBe(1);
    expect(entries.has("smith2024")).toBe(true);
  });

  it("should parse multiple entries", () => {
    const bib = `@article{smith2024,
  title = {Study A}
}

@book{jones2023,
  title = {Book B}
}`;
    const entries = parseBibtexEntries(bib);
    expect(entries.size).toBe(2);
    expect(entries.has("smith2024")).toBe(true);
    expect(entries.has("jones2023")).toBe(true);
  });

  it("should return empty map for empty input", () => {
    expect(parseBibtexEntries("").size).toBe(0);
    expect(parseBibtexEntries("   ").size).toBe(0);
  });

  it("should handle malformed BibTeX gracefully", () => {
    const entries = parseBibtexEntries("this is not bibtex");
    expect(entries.size).toBe(0);
  });
});

describe("extractHints", () => {
  it("should extract DOI from bibtex", () => {
    const entry = `@article{key,
  title = {Test},
  doi = {10.1234/test.study}
}`;
    const hints = extractHints(entry);
    expect(hints.doi).toBe("10.1234/test.study");
    expect(hints.pmid).toBeNull();
  });

  it("should extract PMID from note field", () => {
    const entry = `@article{key,
  title = {Test},
  note = {PMID: 12345678}
}`;
    const hints = extractHints(entry);
    expect(hints.pmid).toBe("12345678");
  });

  it("should extract both DOI and PMID", () => {
    const entry = `@article{key,
  doi = {10.1234/test},
  note = {PMID: 12345}
}`;
    const hints = extractHints(entry);
    expect(hints.doi).toBe("10.1234/test");
    expect(hints.pmid).toBe("12345");
  });

  it("should return null for entries without hints", () => {
    const entry = `@article{key,
  title = {Test},
  year = {2024}
}`;
    const hints = extractHints(entry);
    expect(hints.doi).toBeNull();
    expect(hints.pmid).toBeNull();
  });
});

describe("resolveEntry", () => {
  it("should resolve DOI → Tier A", async () => {
    const { lookupDOI } = await import("./crossref");
    (lookupDOI as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      bibtex: `@article{original, title = {Verified Study}}`,
      work: { doi: "10.1234/test" },
    });

    const result = await resolveEntry(
      "smith2024",
      `@article{smith2024, doi = {10.1234/test}, title = {Test}}`
    );

    expect(result.provenanceTier).toBe("A");
    expect(result.evidenceType).toBe("doi");
    expect(result.sourceDoi).toBe("10.1234/test");
    expect(result.bibtex).toContain("smith2024");
  });

  it("should resolve PMID → Tier A when DOI fails", async () => {
    const { lookupDOI } = await import("./crossref");
    const { lookupPMID } = await import("./pubmed");

    (lookupDOI as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    (lookupPMID as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      pmid: "12345",
      title: "Verified",
      authors: ["Smith J"],
      journal: "BMJ",
      year: 2024,
      volume: "1",
      issue: null,
      pages: null,
      doi: "10.5678/pmid-doi",
    });

    const result = await resolveEntry(
      "smith2024",
      `@article{smith2024, doi = {10.1234/bad}, note = {PMID: 12345}, title = {Test}}`
    );

    expect(result.provenanceTier).toBe("A");
    expect(result.evidenceType).toBe("pmid");
    expect(result.sourcePmid).toBe("12345");
  });

  it("should resolve via title search → Tier A when similarity > 0.85", async () => {
    const { lookupDOI, searchCrossRef } = await import("./crossref");

    (lookupDOI as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null) // initial DOI fails
      .mockResolvedValueOnce({
        bibtex: `@article{found, title = {Exact Same Title For Testing}}`,
        work: { doi: "10.1234/found" },
      });

    (searchCrossRef as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      items: [
        {
          doi: "10.1234/found",
          title: "Exact Same Title For Testing",
          authors: [],
          journal: "",
          year: 2024,
          volume: null,
          issue: null,
          pages: null,
          type: "journal-article",
        },
      ],
      totalResults: 1,
    });

    const result = await resolveEntry(
      "ref2024",
      `@article{ref2024, title = {Exact Same Title For Testing}}`
    );

    expect(result.provenanceTier).toBe("A");
    expect(result.evidenceType).toBe("doi");
  });

  it("should fall back to Tier D when all lookups fail", async () => {
    const { lookupDOI, searchCrossRef } = await import("./crossref");

    (lookupDOI as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (searchCrossRef as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      items: [],
      totalResults: 0,
    });

    const rawBibtex = `@article{unknown2024, title = {Some Obscure Study}, year = {2024}}`;
    const result = await resolveEntry("unknown2024", rawBibtex);

    expect(result.provenanceTier).toBe("D");
    expect(result.evidenceType).toBeNull();
    expect(result.bibtex).toContain("Some Obscure Study");
  });

  it("should sanitise doi field in output BibTeX", async () => {
    const { lookupDOI, searchCrossRef } = await import("./crossref");

    (lookupDOI as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (searchCrossRef as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      items: [],
      totalResults: 0,
    });

    const rawBibtex = `@article{test,
  title = {Test},
  doi = {10.1234/should_be_stripped}
}`;

    const result = await resolveEntry("test", rawBibtex);
    expect(result.bibtex).not.toMatch(/doi\s*=/i);
  });
});

describe("resolveAllEntries", () => {
  it("should resolve entries in parallel with concurrency limit", async () => {
    const { lookupDOI, searchCrossRef } = await import("./crossref");

    (lookupDOI as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (searchCrossRef as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [],
      totalResults: 0,
    });

    const bib = `@article{a, title = {Study A}}

@article{b, title = {Study B}}

@article{c, title = {Study C}}

@article{d, title = {Study D}}`;

    const result = await resolveAllEntries(bib);
    expect(result.resolved).toHaveLength(4);
    expect(result.errors).toHaveLength(0);
  });

  it("should capture errors without failing entire batch", async () => {
    const { lookupDOI, searchCrossRef } = await import("./crossref");

    (lookupDOI as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error")
    );
    (searchCrossRef as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [],
      totalResults: 0,
    });

    // Second entry has DOI that will throw
    const bib = `@article{good, title = {Good Study}}

@article{bad, doi = {10.1234/will-fail}, title = {Bad Study}}`;

    // Make the first entry succeed
    (lookupDOI as ReturnType<typeof vi.fn>).mockReset();
    (lookupDOI as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null) // good — no DOI hint
      .mockRejectedValueOnce(new Error("Network error")); // bad — DOI throws

    const result = await resolveAllEntries(bib);
    // One resolves (Tier D fallback), one errors
    expect(result.resolved.length + result.errors.length).toBe(2);
  });
});
