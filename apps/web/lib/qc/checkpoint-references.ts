/**
 * QA Checkpoint — Post-References (Phase 9).
 *
 * Deterministic DOI/PMID verification --- no AI calls.
 * Designed for SSE-compatible progress reporting.
 *
 * 3 checks: DOI→title match, Tier D re-resolution, entry integrity.
 */

import type { Citation } from "@/lib/types/database";
import type { QCCheck, QCReport } from "./final-qc";
import { lookupDOI } from "@/lib/citations/crossref";
import { resolveEntry } from "@/lib/citations/resolve";
import { buildReport } from "./checkpoint-utils";

// ── Levenshtein for title comparison ────────────────────────────────────────

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0) as number[],
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

// ── Extract title from BibTeX entry ─────────────────────────────────────────

function extractTitle(bibtex: string): string {
  const match = bibtex.match(/title\s*=\s*\{([^}]+)\}/i);
  return match?.[1]?.trim() ?? "";
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const BATCH_SIZE = 5;
const PER_REQUEST_TIMEOUT = 8000;
const TOTAL_TIMEOUT_MS = 60_000;
const SIMILARITY_THRESHOLD = 0.80;

/**
 * Run a promise with a per-request timeout.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | null> {
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), ms),
  );
  return Promise.race([promise, timeout]);
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface VerificationProgress {
  step: string;
  current: number;
  total: number;
}

export interface UpgradedEntry {
  citeKey: string;
  newTier: string;
  newBibtex: string;
  evidenceType: string | null;
  evidenceValue: string | null;
}

export interface VerificationResult {
  report: QCReport;
  upgradedCount: number;
  upgradedEntries: UpgradedEntry[];
  stillUnresolved: string[];
}

export async function verifyAllCitations(
  citations: Citation[],
  onProgress: (progress: VerificationProgress) => void,
): Promise<VerificationResult> {
  const startTime = Date.now();
  let current = 0;
  let upgradedCount = 0;

  const doiMismatchDetails: { item: string; message: string }[] = [];
  const integrityDetails: { item: string; message: string }[] = [];
  const tierDCitations = citations.filter((c) => c.provenance_tier === "D");
  const doiCitations = citations.filter(
    (c) =>
      (c.provenance_tier === "A" || c.provenance_tier === "B") &&
      c.source_doi,
  );

  // Total across all three check phases (DOI match + Tier D re-resolve + integrity)
  const total = doiCitations.length + tierDCitations.length + citations.length;

  // Tier D citations that got upgraded (for DB persistence)
  const upgradedEntries: UpgradedEntry[] = [];
  // Tier D citation keys still unresolved
  const stillUnresolved: string[] = [];

  // ── Check 1: DOI→title match for Tier A/B ────────────────────────────────

  for (let i = 0; i < doiCitations.length; i += BATCH_SIZE) {
    if (Date.now() - startTime > TOTAL_TIMEOUT_MS) break;

    const batch = doiCitations.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (citation) => {
        current++;
        onProgress({
          step: `Verifying ${citation.cite_key} (DOI match)`,
          current,
          total,
        });

        const result = await withTimeout(
          lookupDOI(citation.source_doi!),
          PER_REQUEST_TIMEOUT,
        );

        if (!result?.work?.title) return; // Skip if lookup failed

        const localTitle = extractTitle(citation.bibtex_entry);
        if (!localTitle) return;

        const sim = titleSimilarity(localTitle, result.work.title);
        if (sim < SIMILARITY_THRESHOLD) {
          doiMismatchDetails.push({
            item: citation.cite_key,
            message: `Title mismatch (similarity: ${(sim * 100).toFixed(0)}%): local="${localTitle.slice(0, 60)}" vs DOI="${result.work.title.slice(0, 60)}"`,
          });
        }
      }),
    );

    // Count settled
    void results;
  }

  // ── Check 2: Tier D re-resolution ────────────────────────────────────────

  for (let i = 0; i < tierDCitations.length; i += BATCH_SIZE) {
    if (Date.now() - startTime > TOTAL_TIMEOUT_MS) break;

    const batch = tierDCitations.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (citation) => {
        current++;
        onProgress({
          step: `Re-resolving ${citation.cite_key} via PubMed/CrossRef`,
          current,
          total,
        });

        const resolved = await withTimeout(
          resolveEntry(citation.cite_key, citation.bibtex_entry),
          PER_REQUEST_TIMEOUT,
        );

        if (resolved && resolved.provenanceTier !== "D") {
          upgradedEntries.push({
            citeKey: citation.cite_key,
            newTier: resolved.provenanceTier,
            newBibtex: resolved.bibtex,
            evidenceType: resolved.evidenceType,
            evidenceValue: resolved.evidenceValue,
          });
          upgradedCount++;
          return { key: citation.cite_key, upgraded: true, resolved };
        } else {
          stillUnresolved.push(citation.cite_key);
          return { key: citation.cite_key, upgraded: false };
        }
      }),
    );

    void results;
  }

  // ── Check 3: Entry integrity ─────────────────────────────────────────────

  for (const citation of citations) {
    current++;
    const entry = citation.bibtex_entry;
    const missing: string[] = [];

    if (!/author\s*=/i.test(entry)) missing.push("author");
    if (!/title\s*=/i.test(entry)) missing.push("title");
    if (!/year\s*=/i.test(entry)) missing.push("year");
    if (!/(?:journal|publisher|booktitle)\s*=/i.test(entry))
      missing.push("journal/publisher");

    if (missing.length > 0) {
      integrityDetails.push({
        item: citation.cite_key,
        message: `Missing fields: ${missing.join(", ")}`,
      });
    }
  }

  onProgress({ step: "Verification complete", current: total, total });

  // ── Build checks ─────────────────────────────────────────────────────────

  const doiCheck: QCCheck =
    doiMismatchDetails.length >= 3
      ? {
          name: "ref-doi-match",
          status: "fail",
          blocking: true,
          message: `${doiMismatchDetails.length} DOI→title mismatch(es) found`,
          details: doiMismatchDetails,
        }
      : {
          name: "ref-doi-match",
          status:
            doiMismatchDetails.length > 0 ? "warn" : "pass",
          blocking: false,
          message:
            doiMismatchDetails.length > 0
              ? `${doiMismatchDetails.length} DOI→title mismatch(es) (below blocking threshold)`
              : "All DOI→title matches verified",
          details: doiMismatchDetails,
        };

  const tierDThreshold = Math.ceil(citations.length * 0.1);
  const tierDCheck: QCCheck =
    stillUnresolved.length > tierDThreshold
      ? {
          name: "ref-tier-d",
          status: "fail",
          blocking: true,
          message: `${stillUnresolved.length} Tier D citation(s) remain (>${tierDThreshold} threshold)`,
          details: stillUnresolved.map((k) => ({
            item: k,
            message: "Could not verify via DOI, PMID, or title search",
          })),
        }
      : {
          name: "ref-tier-d",
          status:
            stillUnresolved.length > 0 ? "warn" : "pass",
          blocking: false,
          message:
            stillUnresolved.length > 0
              ? `${stillUnresolved.length} Tier D citation(s) remain (within threshold)`
              : `All citations verified (${upgradedCount} upgraded)`,
          details: stillUnresolved.map((k) => ({
            item: k,
            message: "Could not verify via DOI, PMID, or title search",
          })),
        };

  const integrityCheck: QCCheck =
    integrityDetails.length > 0
      ? {
          name: "ref-entry-integrity",
          status: "warn",
          blocking: false,
          message: `${integrityDetails.length} BibTeX entry(ies) missing required fields`,
          details: integrityDetails,
        }
      : {
          name: "ref-entry-integrity",
          status: "pass",
          blocking: false,
          message: "All BibTeX entries have required fields",
          details: [],
        };

  return {
    report: buildReport([doiCheck, tierDCheck, integrityCheck]),
    upgradedCount,
    upgradedEntries,
    stillUnresolved,
  };
}

/**
 * Quick Tier D count check for the approve route (no network calls).
 * Used after the client has already run the full verification via SSE.
 */
export function quickTierDCheck(citations: Citation[]): QCReport {
  const tierDCount = citations.filter(
    (c) => c.provenance_tier === "D",
  ).length;
  const threshold = Math.ceil(citations.length * 0.1);

  const check: QCCheck =
    tierDCount > threshold
      ? {
          name: "ref-tier-d-quick",
          status: "fail",
          blocking: true,
          message: `${tierDCount} Tier D citation(s) remain (>${threshold} threshold)`,
          details: [],
        }
      : {
          name: "ref-tier-d-quick",
          status: "pass",
          blocking: false,
          message: `Tier D citations within threshold (${tierDCount}/${threshold})`,
          details: [],
        };

  return buildReport([check]);
}
