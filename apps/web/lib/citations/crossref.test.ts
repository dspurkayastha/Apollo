import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  lookupDOI,
  searchCrossRef,
  crossRefWorkToBibtex,
  stripDoiField,
} from "./crossref";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("stripDoiField", () => {
  it("should remove doi field from BibTeX", () => {
    const bibtex = `@article{smith2024,
  title = {Test},
  doi = {10.1234/test},
  year = {2024}
}`;
    const result = stripDoiField(bibtex);
    expect(result).not.toContain("doi =");
    expect(result).toContain("title = {Test}");
    expect(result).toContain("year = {2024}");
  });

  it("should handle BibTeX without doi field", () => {
    const bibtex = `@article{smith2024,
  title = {Test},
  year = {2024}
}`;
    expect(stripDoiField(bibtex)).toBe(bibtex);
  });
});

describe("lookupDOI", () => {
  it("should return BibTeX and work for valid DOI", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          `@article{original_key,\n  title = {A Study},\n  doi = {10.1234/test}\n}`,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: {
            DOI: "10.1234/test",
            title: ["A Study"],
            author: [{ given: "John", family: "Smith" }],
            "container-title": ["Nature"],
            "published-print": { "date-parts": [[2024]] },
            volume: "1",
            issue: "2",
            page: "10-20",
            type: "journal-article",
          },
        }),
      });

    const result = await lookupDOI("10.1234/test");
    expect(result).not.toBeNull();
    expect(result!.work.doi).toBe("10.1234/test");
    expect(result!.work.title).toBe("A Study");
    expect(result!.work.authors).toEqual(["John Smith"]);
    // doi field should be stripped from bibtex
    expect(result!.bibtex).not.toMatch(/doi\s*=/i);
  });

  it("should return null for 404", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await lookupDOI("10.1234/nonexistent");
    expect(result).toBeNull();
  });

  it("should return null on timeout/error", async () => {
    // fetchWithRetry retries up to 3 times — reject all attempts
    mockFetch
      .mockRejectedValueOnce(new Error("AbortError"))
      .mockRejectedValueOnce(new Error("AbortError"))
      .mockRejectedValueOnce(new Error("AbortError"))
      .mockRejectedValueOnce(new Error("AbortError"));
    const result = await lookupDOI("10.1234/timeout");
    expect(result).toBeNull();
  }, 30_000);

  it("should strip https://doi.org/ prefix", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () => `@article{key, title = {Test}}`,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: {
            DOI: "10.1234/test",
            title: ["Test"],
            type: "journal-article",
          },
        }),
      });

    await lookupDOI("https://doi.org/10.1234/test");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("10.1234%2Ftest"),
      expect.anything()
    );
  });

  it("should return null for empty DOI", async () => {
    const result = await lookupDOI("");
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("searchCrossRef", () => {
  it("should return search results", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: {
          items: [
            {
              DOI: "10.1234/a",
              title: ["Study A"],
              author: [{ given: "A", family: "Author" }],
              "container-title": ["Journal A"],
              "published-print": { "date-parts": [[2023]] },
              type: "journal-article",
            },
          ],
          "total-results": 100,
        },
      }),
    });

    const result = await searchCrossRef("test query", 5);
    expect(result.items).toHaveLength(1);
    expect(result.totalResults).toBe(100);
    expect(result.items[0].doi).toBe("10.1234/a");
  });

  it("should return empty for failed request", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const result = await searchCrossRef("test");
    expect(result.items).toHaveLength(0);
    expect(result.totalResults).toBe(0);
  });

  it("should cap rows at 20", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: { items: [], "total-results": 0 },
      }),
    });

    await searchCrossRef("test", 50);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("rows=20");
  });
});

describe("crossRefWorkToBibtex", () => {
  it("should generate valid BibTeX for journal article", () => {
    const bibtex = crossRefWorkToBibtex(
      {
        doi: "10.1234/test",
        title: "A Study",
        authors: ["John Smith", "Jane Doe"],
        journal: "Nature",
        year: 2024,
        volume: "1",
        issue: "2",
        pages: "10-20",
        type: "journal-article",
      },
      "smith2024"
    );

    expect(bibtex).toContain("@article{smith2024,");
    expect(bibtex).toContain("title = {A Study}");
    expect(bibtex).toContain("author = {John Smith and Jane Doe}");
    expect(bibtex).toContain("journal = {Nature}");
    expect(bibtex).not.toContain("doi =");
  });

  it("should use @misc for non-journal types", () => {
    const bibtex = crossRefWorkToBibtex(
      {
        doi: "10.1234/test",
        title: "A Book",
        authors: [],
        journal: "",
        year: 2024,
        volume: null,
        issue: null,
        pages: null,
        type: "book",
      },
      "book2024"
    );

    expect(bibtex).toContain("@misc{book2024,");
  });

  it("should handle missing fields gracefully", () => {
    const bibtex = crossRefWorkToBibtex(
      {
        doi: "",
        title: "",
        authors: [],
        journal: "",
        year: null,
        volume: null,
        issue: null,
        pages: null,
        type: "unknown",
      },
      "empty"
    );

    expect(bibtex).toContain("@misc{empty,");
  });
});
