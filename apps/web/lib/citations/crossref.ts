// ── CrossRef DOI lookup and search ──────────────────────────────────────────

const CROSSREF_API = "https://api.crossref.org";
const TIMEOUT_MS = 10_000;

// ── Types ───────────────────────────────────────────────────────────────────

export interface CrossRefWork {
  doi: string;
  title: string;
  authors: string[];
  journal: string;
  year: number | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  type: string;
}

export interface CrossRefSearchResult {
  items: CrossRefWork[];
  totalResults: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getMailtoHeader(): Record<string, string> {
  const mailto = process.env.CROSSREF_MAILTO;
  return mailto ? { "User-Agent": `Apollo/1.0 (mailto:${mailto})` } : {};
}

function makeController(): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

function parseCrossRefItem(item: Record<string, unknown>): CrossRefWork {
  const titleArr = item.title as string[] | undefined;
  const authorArr = item.author as { given?: string; family?: string }[] | undefined;
  const containerArr = item["container-title"] as string[] | undefined;
  const published =
    (item["published-print"] as { "date-parts"?: number[][] }) ??
    (item["published-online"] as { "date-parts"?: number[][] });

  return {
    doi: (item.DOI as string) ?? "",
    title: titleArr?.[0] ?? "",
    authors: (authorArr ?? []).map(
      (a) => [a.given, a.family].filter(Boolean).join(" ")
    ),
    journal: containerArr?.[0] ?? "",
    year: published?.["date-parts"]?.[0]?.[0] ?? null,
    volume: (item.volume as string) ?? null,
    issue: (item.issue as string) ?? null,
    pages: (item.page as string) ?? null,
    type: (item.type as string) ?? "unknown",
  };
}

/**
 * Strip `doi = {…}` field from BibTeX to avoid DOI underscores crashing
 * `vancouver.bst` (per lessons.md).
 */
export function stripDoiField(bibtex: string): string {
  return bibtex.replace(/^\s*doi\s*=\s*\{[^}]*\},?\s*$/gm, "").trim();
}

// ── Fetch with exponential backoff retry ─────────────────────────────────────

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status === 404) return response;
      if (attempt < maxRetries && response.status >= 500) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      return response;
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Look up a DOI via CrossRef content negotiation (returns BibTeX directly)
 * and also fetch structured metadata.
 */
export async function lookupDOI(
  doi: string
): Promise<{ bibtex: string; work: CrossRefWork } | null> {
  const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//i, "").trim();
  if (!cleanDoi) return null;

  const { signal, clear } = makeController();

  try {
    // Fetch BibTeX via content negotiation
    const bibtexRes = await fetchWithRetry(`https://doi.org/${encodeURIComponent(cleanDoi)}`, {
      headers: {
        Accept: "application/x-bibtex",
        ...getMailtoHeader(),
      },
      signal,
      redirect: "follow",
    });

    if (!bibtexRes.ok) {
      clear();
      return null;
    }

    const rawBibtex = await bibtexRes.text();
    const bibtex = stripDoiField(rawBibtex);

    // Fetch structured metadata
    const metaRes = await fetchWithRetry(
      `${CROSSREF_API}/works/${encodeURIComponent(cleanDoi)}`,
      {
        headers: {
          Accept: "application/json",
          ...getMailtoHeader(),
        },
        signal,
      }
    );

    let work: CrossRefWork;
    if (metaRes.ok) {
      const json = (await metaRes.json()) as { message: Record<string, unknown> };
      work = parseCrossRefItem(json.message);
    } else {
      // Fallback: construct minimal work from DOI
      work = {
        doi: cleanDoi,
        title: "",
        authors: [],
        journal: "",
        year: null,
        volume: null,
        issue: null,
        pages: null,
        type: "unknown",
      };
    }

    return { bibtex, work };
  } catch {
    return null;
  } finally {
    clear();
  }
}

/**
 * Search CrossRef for works matching a query string.
 */
export async function searchCrossRef(
  query: string,
  rows = 10
): Promise<CrossRefSearchResult> {
  const { signal, clear } = makeController();

  try {
    const url = new URL(`${CROSSREF_API}/works`);
    url.searchParams.set("query", query);
    url.searchParams.set("rows", String(Math.min(rows, 20)));

    const res = await fetchWithRetry(url.toString(), {
      headers: {
        Accept: "application/json",
        ...getMailtoHeader(),
      },
      signal,
    });

    if (!res.ok) {
      return { items: [], totalResults: 0 };
    }

    const json = (await res.json()) as {
      message: {
        items: Record<string, unknown>[];
        "total-results": number;
      };
    };

    return {
      items: json.message.items.map(parseCrossRefItem),
      totalResults: json.message["total-results"],
    };
  } catch {
    return { items: [], totalResults: 0 };
  } finally {
    clear();
  }
}

/**
 * Fallback: build BibTeX from a CrossRefWork object when content negotiation
 * fails. Strips doi field from output.
 */
export function crossRefWorkToBibtex(
  work: CrossRefWork,
  citeKey: string
): string {
  const fields: string[] = [];

  if (work.title) fields.push(`  title = {${work.title}}`);
  if (work.authors.length > 0)
    fields.push(`  author = {${work.authors.join(" and ")}}`);
  if (work.journal) fields.push(`  journal = {${work.journal}}`);
  if (work.year !== null) fields.push(`  year = {${work.year}}`);
  if (work.volume) fields.push(`  volume = {${work.volume}}`);
  if (work.issue) fields.push(`  number = {${work.issue}}`);
  if (work.pages) fields.push(`  pages = {${work.pages}}`);
  // Deliberately omit doi field — DOI underscores crash vancouver.bst

  const entryType = work.type === "journal-article" ? "article" : "misc";

  return `@${entryType}{${citeKey},\n${fields.join(",\n")}\n}`;
}
