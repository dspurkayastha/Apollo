// ── PubMed PMID lookup and search ───────────────────────────────────────────

import { lookupDOI, crossRefWorkToBibtex, stripDoiField } from "./crossref";

const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const TIMEOUT_MS = 10_000;

// ── Types ───────────────────────────────────────────────────────────────────

export interface PubMedArticle {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  year: number | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
}

export interface PubMedSearchResult {
  items: PubMedArticle[];
  totalResults: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getApiKeyParam(): string {
  const key = process.env.PUBMED_API_KEY;
  return key ? `&api_key=${encodeURIComponent(key)}` : "";
}

function makeController(): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

function parseSummaryDoc(doc: Record<string, unknown>): PubMedArticle {
  const authors = (doc.authors as { name?: string }[] | undefined) ?? [];
  const articleIds = (doc.articleids as { idtype?: string; value?: string }[] | undefined) ?? [];

  const doiEntry = articleIds.find((a) => a.idtype === "doi");

  return {
    pmid: String(doc.uid ?? ""),
    title: (doc.title as string) ?? "",
    authors: authors.map((a) => a.name ?? "").filter(Boolean),
    journal: (doc.fulljournalname as string) ?? (doc.source as string) ?? "",
    year: doc.pubdate
      ? parseInt(String(doc.pubdate).slice(0, 4), 10) || null
      : null,
    volume: (doc.volume as string) || null,
    issue: (doc.issue as string) || null,
    pages: (doc.pages as string) || null,
    doi: doiEntry?.value ?? null,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Look up a single PMID via PubMed E-Utilities (esummary).
 */
export async function lookupPMID(
  pmid: string
): Promise<PubMedArticle | null> {
  const cleanPmid = pmid.replace(/\D/g, "").trim();
  if (!cleanPmid) return null;

  const { signal, clear } = makeController();

  try {
    const url = `${EUTILS_BASE}/esummary.fcgi?db=pubmed&id=${cleanPmid}&retmode=json${getApiKeyParam()}`;

    const res = await fetch(url, { signal });

    if (!res.ok) {
      return null;
    }

    const json = (await res.json()) as {
      result?: Record<string, Record<string, unknown>>;
    };

    const doc = json.result?.[cleanPmid];
    if (!doc || doc.error) return null;

    return parseSummaryDoc(doc);
  } catch {
    return null;
  } finally {
    clear();
  }
}

/**
 * Search PubMed for articles matching a query string.
 * Two-step: esearch → esummary.
 */
export async function searchPubMed(
  query: string,
  maxResults = 10
): Promise<PubMedSearchResult> {
  const { signal, clear } = makeController();
  const limit = Math.min(maxResults, 20);

  try {
    // Step 1: esearch to get PMIDs
    const searchUrl = `${EUTILS_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${limit}&retmode=json${getApiKeyParam()}`;
    const searchRes = await fetch(searchUrl, { signal });

    if (!searchRes.ok) {
      return { items: [], totalResults: 0 };
    }

    const searchJson = (await searchRes.json()) as {
      esearchresult?: {
        idlist?: string[];
        count?: string;
      };
    };

    const ids = searchJson.esearchresult?.idlist ?? [];
    const totalResults = parseInt(searchJson.esearchresult?.count ?? "0", 10);

    if (ids.length === 0) {
      return { items: [], totalResults };
    }

    // Step 2: esummary for article details
    const summaryUrl = `${EUTILS_BASE}/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json${getApiKeyParam()}`;
    const summaryRes = await fetch(summaryUrl, { signal });

    if (!summaryRes.ok) {
      return { items: [], totalResults };
    }

    const summaryJson = (await summaryRes.json()) as {
      result?: Record<string, Record<string, unknown>>;
    };

    const result = summaryJson.result ?? {};
    const items: PubMedArticle[] = ids
      .map((id) => {
        const doc = result[id];
        if (!doc || doc.error) return null;
        return parseSummaryDoc(doc);
      })
      .filter((a): a is PubMedArticle => a !== null);

    return { items, totalResults };
  } catch {
    return { items: [], totalResults: 0 };
  } finally {
    clear();
  }
}

/**
 * Convert a PubMedArticle to BibTeX.
 * If the article has a DOI, cascade to lookupDOI() for higher-quality BibTeX.
 */
export async function pubmedArticleToBibtex(
  article: PubMedArticle,
  citeKey: string
): Promise<string> {
  // If DOI is available, prefer CrossRef BibTeX (better quality)
  if (article.doi) {
    const doiResult = await lookupDOI(article.doi);
    if (doiResult) {
      // Replace the cite key in the returned BibTeX
      return doiResult.bibtex.replace(
        /^(@\w+\{)[^,]+,/m,
        `$1${citeKey},`
      );
    }

    // CrossRef lookup failed — build from CrossRef work format as fallback
    return crossRefWorkToBibtex(
      {
        doi: article.doi,
        title: article.title,
        authors: article.authors,
        journal: article.journal,
        year: article.year,
        volume: article.volume,
        issue: article.issue,
        pages: article.pages,
        type: "journal-article",
      },
      citeKey
    );
  }

  // No DOI — build BibTeX manually
  const fields: string[] = [];

  if (article.title) fields.push(`  title = {${article.title}}`);
  if (article.authors.length > 0)
    fields.push(`  author = {${article.authors.join(" and ")}}`);
  if (article.journal) fields.push(`  journal = {${article.journal}}`);
  if (article.year !== null) fields.push(`  year = {${article.year}}`);
  if (article.volume) fields.push(`  volume = {${article.volume}}`);
  if (article.issue) fields.push(`  number = {${article.issue}}`);
  if (article.pages) fields.push(`  pages = {${article.pages}}`);
  if (article.pmid) fields.push(`  note = {PMID: ${article.pmid}}`);

  return `@article{${citeKey},\n${fields.join(",\n")}\n}`;
}
