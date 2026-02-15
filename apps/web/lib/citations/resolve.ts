// ── Citation resolution: BibTeX → verified provenance ──────────────────────

import { lookupDOI, searchCrossRef, stripDoiField } from "./crossref";
import { lookupPMID } from "./pubmed";
import type { ProvenanceTier, EvidenceType } from "@/lib/types/database";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ResolvedCitation {
  citeKey: string;
  bibtex: string;
  provenanceTier: ProvenanceTier;
  evidenceType: EvidenceType | null;
  evidenceValue: string | null;
  sourceDoi: string | null;
  sourcePmid: string | null;
}

export interface ResolutionResult {
  resolved: ResolvedCitation[];
  errors: { citeKey: string; error: string }[];
}

// ── BibTeX parsing ──────────────────────────────────────────────────────────

/**
 * Parse raw BibTeX into a map of cite_key → full entry string.
 * Reuses the same regex pattern as deduplicateBibEntries() in assemble.ts.
 */
export function parseBibtexEntries(raw: string): Map<string, string> {
  const entries = new Map<string, string>();
  if (!raw.trim()) return entries;

  const lines = raw.split("\n");
  let currentEntry = "";
  let currentKey = "";

  for (const line of lines) {
    const entryStart = line.match(/^@(\w+)\{([^,]+),/);
    if (entryStart) {
      if (currentEntry && currentKey) {
        entries.set(currentKey, currentEntry.trim());
      }
      currentKey = entryStart[2].trim();
      currentEntry = line + "\n";
    } else if (currentKey) {
      currentEntry += line + "\n";
    }
  }

  if (currentEntry && currentKey) {
    entries.set(currentKey, currentEntry.trim());
  }

  return entries;
}

/**
 * Extract DOI and PMID hints from a BibTeX entry string.
 */
export function extractHints(bibtexEntry: string): {
  doi: string | null;
  pmid: string | null;
} {
  // Match doi = {10.xxx/yyy} or doi = "10.xxx/yyy"
  const doiMatch = bibtexEntry.match(
    /doi\s*=\s*[{"](10\.[^}"]+)[}"]/i
  );

  // Match PMID in note, keywords, or standalone pmid field
  const pmidMatch =
    bibtexEntry.match(/pmid\s*[:=]\s*(\d+)/i) ??
    bibtexEntry.match(/PMID:\s*(\d+)/);

  return {
    doi: doiMatch?.[1]?.trim() ?? null,
    pmid: pmidMatch?.[1]?.trim() ?? null,
  };
}

// ── Levenshtein similarity ──────────────────────────────────────────────────

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0) as number[]
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

function titleSimilarity(a: string, b: string): number {
  const normA = a.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const normB = b.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  if (!normA || !normB) return 0;
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(normA, normB) / maxLen;
}

// ── Extract title from BibTeX ───────────────────────────────────────────────

function extractTitle(bibtexEntry: string): string {
  const match = bibtexEntry.match(/title\s*=\s*\{([^}]+)\}/i);
  return match?.[1]?.trim() ?? "";
}

// ── Single entry resolution ─────────────────────────────────────────────────

const SIMILARITY_THRESHOLD = 0.85;

/**
 * Resolve a single BibTeX entry to its provenance tier.
 *
 * Algorithm:
 * 1. Extract DOI/PMID hints from BibTeX
 * 2. If DOI → lookupDOI(). Success → Tier A, evidence_type: "doi"
 * 3. If PMID (and no DOI match) → lookupPMID(). Success → Tier A, evidence_type: "pmid"
 * 4. If no hints or lookups fail → title search via searchCrossRef(title).
 *    Top result with similarity > 0.85 → Tier A
 * 5. All fail → Tier D with original AI BibTeX preserved
 */
export async function resolveEntry(
  citeKey: string,
  rawBibtex: string
): Promise<ResolvedCitation> {
  const hints = extractHints(rawBibtex);

  // 1. Try DOI lookup
  if (hints.doi) {
    const result = await lookupDOI(hints.doi);
    if (result) {
      // Replace cite key in the returned BibTeX
      const bibtex = result.bibtex.replace(
        /^(@\w+\{)[^,]+,/m,
        `$1${citeKey},`
      );
      return {
        citeKey,
        bibtex,
        provenanceTier: "A",
        evidenceType: "doi",
        evidenceValue: hints.doi,
        sourceDoi: hints.doi,
        sourcePmid: hints.pmid,
      };
    }
  }

  // 2. Try PMID lookup
  if (hints.pmid) {
    const article = await lookupPMID(hints.pmid);
    if (article) {
      // Build BibTeX from PubMed data (without DOI cascade to avoid double-lookup)
      const fields: string[] = [];
      if (article.title) fields.push(`  title = {${article.title}}`);
      if (article.authors.length > 0)
        fields.push(`  author = {${article.authors.join(" and ")}}`);
      if (article.journal) fields.push(`  journal = {${article.journal}}`);
      if (article.year !== null) fields.push(`  year = {${article.year}}`);
      if (article.volume) fields.push(`  volume = {${article.volume}}`);
      if (article.issue) fields.push(`  number = {${article.issue}}`);
      if (article.pages) fields.push(`  pages = {${article.pages}}`);

      const bibtex = `@article{${citeKey},\n${fields.join(",\n")}\n}`;

      return {
        citeKey,
        bibtex,
        provenanceTier: "A",
        evidenceType: "pmid",
        evidenceValue: hints.pmid,
        sourceDoi: article.doi,
        sourcePmid: hints.pmid,
      };
    }
  }

  // 3. Title search fallback
  const title = extractTitle(rawBibtex);
  if (title.length > 10) {
    const searchResult = await searchCrossRef(title, 3);
    if (searchResult.items.length > 0) {
      const best = searchResult.items[0];
      const sim = titleSimilarity(title, best.title);

      if (sim >= SIMILARITY_THRESHOLD) {
        // Fetch verified BibTeX via DOI
        const doiResult = best.doi ? await lookupDOI(best.doi) : null;
        const bibtex = doiResult
          ? doiResult.bibtex.replace(/^(@\w+\{)[^,]+,/m, `$1${citeKey},`)
          : stripDoiField(rawBibtex);

        return {
          citeKey,
          bibtex,
          provenanceTier: "A",
          evidenceType: "doi",
          evidenceValue: best.doi,
          sourceDoi: best.doi,
          sourcePmid: null,
        };
      }
    }
  }

  // 4. All failed → Tier D
  return {
    citeKey,
    bibtex: stripDoiField(rawBibtex),
    provenanceTier: "D",
    evidenceType: null,
    evidenceValue: null,
    sourceDoi: null,
    sourcePmid: null,
  };
}

// ── Batch resolution with concurrency limit ─────────────────────────────────

const CONCURRENCY = 3;

/**
 * Resolve all BibTeX entries in a raw BibTeX string, with concurrency limit.
 */
export async function resolveAllEntries(
  rawBibtex: string
): Promise<ResolutionResult> {
  const entries = parseBibtexEntries(rawBibtex);
  const resolved: ResolvedCitation[] = [];
  const errors: { citeKey: string; error: string }[] = [];

  // Process in chunks of CONCURRENCY
  const keys = Array.from(entries.keys());

  for (let i = 0; i < keys.length; i += CONCURRENCY) {
    const chunk = keys.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((key) => resolveEntry(key, entries.get(key)!))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled") {
        resolved.push(result.value);
      } else {
        errors.push({
          citeKey: chunk[j],
          error: result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
        });
      }
    }
  }

  return { resolved, errors };
}
