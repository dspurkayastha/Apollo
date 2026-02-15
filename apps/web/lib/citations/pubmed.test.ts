import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { lookupPMID, searchPubMed, pubmedArticleToBibtex } from "./pubmed";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock crossref module for DOI cascade
vi.mock("./crossref", () => ({
  lookupDOI: vi.fn().mockResolvedValue(null),
  crossRefWorkToBibtex: vi.fn(
    (_work: unknown, citeKey: string) =>
      `@article{${citeKey},\n  title = {Mocked}\n}`
  ),
  stripDoiField: vi.fn((s: string) => s),
}));

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("lookupPMID", () => {
  it("should return article for valid PMID", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          "12345678": {
            uid: "12345678",
            title: "A Clinical Study",
            authors: [{ name: "Smith J" }, { name: "Doe A" }],
            fulljournalname: "The Lancet",
            pubdate: "2024 Jan",
            volume: "403",
            issue: "1",
            pages: "100-110",
            articleids: [{ idtype: "doi", value: "10.1016/test" }],
          },
        },
      }),
    });

    const article = await lookupPMID("12345678");
    expect(article).not.toBeNull();
    expect(article!.pmid).toBe("12345678");
    expect(article!.title).toBe("A Clinical Study");
    expect(article!.authors).toEqual(["Smith J", "Doe A"]);
    expect(article!.journal).toBe("The Lancet");
    expect(article!.year).toBe(2024);
    expect(article!.doi).toBe("10.1016/test");
  });

  it("should return null for invalid PMID", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          "99999999": { error: "cannot get document summary" },
        },
      }),
    });

    const result = await lookupPMID("99999999");
    expect(result).toBeNull();
  });

  it("should return null on timeout", async () => {
    mockFetch.mockRejectedValueOnce(new Error("AbortError"));
    const result = await lookupPMID("12345678");
    expect(result).toBeNull();
  });

  it("should strip non-digit characters from PMID", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          "12345": {
            uid: "12345",
            title: "Test",
            pubdate: "2024",
          },
        },
      }),
    });

    await lookupPMID("PMID:12345");
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("id=12345");
  });

  it("should return null for empty PMID", async () => {
    const result = await lookupPMID("");
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("searchPubMed", () => {
  it("should return search results via two-step lookup", async () => {
    // Step 1: esearch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        esearchresult: {
          idlist: ["111", "222"],
          count: "50",
        },
      }),
    });

    // Step 2: esummary
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          "111": {
            uid: "111",
            title: "Study One",
            authors: [{ name: "Author A" }],
            fulljournalname: "BMJ",
            pubdate: "2024",
            articleids: [],
          },
          "222": {
            uid: "222",
            title: "Study Two",
            authors: [{ name: "Author B" }],
            fulljournalname: "JAMA",
            pubdate: "2023",
            articleids: [],
          },
        },
      }),
    });

    const result = await searchPubMed("diabetes treatment", 10);
    expect(result.items).toHaveLength(2);
    expect(result.totalResults).toBe(50);
    expect(result.items[0].title).toBe("Study One");
    expect(result.items[1].title).toBe("Study Two");
  });

  it("should return empty for no results", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        esearchresult: { idlist: [], count: "0" },
      }),
    });

    const result = await searchPubMed("xyznonexistent123");
    expect(result.items).toHaveLength(0);
    expect(result.totalResults).toBe(0);
  });

  it("should cap maxResults at 20", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        esearchresult: { idlist: [], count: "0" },
      }),
    });

    await searchPubMed("test", 100);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("retmax=20");
  });
});

describe("pubmedArticleToBibtex", () => {
  it("should build BibTeX for article without DOI", async () => {
    const bibtex = await pubmedArticleToBibtex(
      {
        pmid: "12345",
        title: "A Study",
        authors: ["Smith J", "Doe A"],
        journal: "BMJ",
        year: 2024,
        volume: "368",
        issue: "1",
        pages: "m1234",
        doi: null,
      },
      "smith2024"
    );

    expect(bibtex).toContain("@article{smith2024,");
    expect(bibtex).toContain("title = {A Study}");
    expect(bibtex).toContain("author = {Smith J and Doe A}");
    expect(bibtex).toContain("note = {PMID: 12345}");
  });

  it("should cascade to CrossRef when DOI is available", async () => {
    const { lookupDOI } = await import("./crossref");
    (lookupDOI as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      bibtex: `@article{original_key,\n  title = {CrossRef Version}\n}`,
      work: { doi: "10.1234/test" },
    });

    const bibtex = await pubmedArticleToBibtex(
      {
        pmid: "12345",
        title: "A Study",
        authors: ["Smith J"],
        journal: "BMJ",
        year: 2024,
        volume: null,
        issue: null,
        pages: null,
        doi: "10.1234/test",
      },
      "smith2024"
    );

    expect(bibtex).toContain("smith2024");
    expect(bibtex).toContain("CrossRef Version");
  });
});
