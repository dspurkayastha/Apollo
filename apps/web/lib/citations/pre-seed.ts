/**
 * Pre-seed real references from PubMed for AI context.
 *
 * Builds PubMed search queries from thesis metadata, fetches articles,
 * converts to BibTeX, and formats for inclusion in AI prompts.
 */

import { searchPubMed, pubmedArticleToBibtex } from "./pubmed";
import type { PubMedArticle } from "./pubmed";

const TIME_BUDGET_MS = 8_000;

// ── Query builders ─────────────────────────────────────────────────────────

/**
 * Build 2-3 PubMed queries of decreasing specificity from thesis metadata.
 */
export function buildSearchQueries(
  title: string,
  keywords: string[],
  studyType: string | null,
  department: string | null
): string[] {
  const queries: string[] = [];

  // Most specific: title keywords + study type
  const titleWords = title
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5)
    .join(" ");

  if (titleWords && studyType) {
    queries.push(`${titleWords} ${studyType}`);
  } else if (titleWords) {
    queries.push(titleWords);
  }

  // Medium: keywords combined
  if (keywords.length > 0) {
    queries.push(keywords.slice(0, 4).join(" "));
  }

  // Broad: department + first 2 keywords
  if (department && keywords.length >= 2) {
    queries.push(`${department} ${keywords.slice(0, 2).join(" ")}`);
  }

  return queries;
}

// ── Main function ──────────────────────────────────────────────────────────

export interface PreSeededReference {
  pmid: string;
  citeKey: string;
  bibtex: string;
  article: PubMedArticle;
}

/**
 * Search PubMed with multiple queries, deduplicate, and convert to BibTeX.
 * Respects an 8-second time budget.
 */
export async function preSeedReferences(
  title: string,
  keywords: string[],
  studyType: string | null,
  department: string | null,
  maxRefs = 20
): Promise<PreSeededReference[]> {
  const queries = buildSearchQueries(title, keywords, studyType, department);
  if (queries.length === 0) return [];

  const deadline = Date.now() + TIME_BUDGET_MS;
  const seenPmids = new Set<string>();
  const articles: PubMedArticle[] = [];

  // Run queries in parallel
  const perQueryLimit = Math.ceil(maxRefs / queries.length) + 5;
  const results = await Promise.allSettled(
    queries.map((q) => searchPubMed(q, perQueryLimit))
  );

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const article of result.value.items) {
      if (!seenPmids.has(article.pmid)) {
        seenPmids.add(article.pmid);
        articles.push(article);
      }
    }
  }

  // Limit to maxRefs
  const selected = articles.slice(0, maxRefs);

  // Convert to BibTeX with cite keys derived from first author + year
  const refs: PreSeededReference[] = [];
  for (const article of selected) {
    if (Date.now() > deadline) break;

    const citeKey = generateCiteKey(article, refs);
    try {
      const bibtex = await pubmedArticleToBibtex(article, citeKey);
      refs.push({ pmid: article.pmid, citeKey, bibtex, article });
    } catch {
      // Skip failed conversions
    }
  }

  return refs;
}

/**
 * Generate a unique cite key from article metadata (e.g., "kumar2019").
 */
function generateCiteKey(
  article: PubMedArticle,
  existing: PreSeededReference[]
): string {
  const firstAuthor = article.authors[0] ?? "unknown";
  const surname = firstAuthor
    .split(/[\s,]+/)[0]
    ?.toLowerCase()
    .replace(/[^a-z]/g, "") ?? "unknown";
  const year = article.year ?? 2020;
  const base = `${surname}${year}`;

  const usedKeys = new Set(existing.map((r) => r.citeKey));
  if (!usedKeys.has(base)) return base;

  // Append a/b/c suffix for duplicates
  for (const suffix of "abcdefghijklmnopqrstuvwxyz") {
    const candidate = `${base}${suffix}`;
    if (!usedKeys.has(candidate)) return candidate;
  }

  return `${base}_${article.pmid}`;
}

// ── Prompt formatting ──────────────────────────────────────────────────────

/**
 * Format pre-seeded references for inclusion in an AI prompt.
 */
export function formatReferencesForPrompt(refs: PreSeededReference[]): string {
  if (refs.length === 0) return "";

  const lines = refs.map(
    (r) =>
      `\\cite{${r.citeKey}} — ${r.article.authors.slice(0, 3).join(", ")}${
        r.article.authors.length > 3 ? " et al." : ""
      } (${r.article.year ?? "n.d."}). ${r.article.title}`
  );

  const bibtexBlock = refs.map((r) => r.bibtex).join("\n\n");

  return `

--- AVAILABLE REFERENCES ---
Use these verified references where appropriate. You may also generate additional references, but prefer these.

${lines.join("\n")}

--- PRE-SEEDED BIBTEX ---
Include these entries in your ---BIBTEX--- section if you use the corresponding \\cite{key}.

${bibtexBlock}
`;
}
