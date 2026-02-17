// ── Auto-resolve citations after AI generation ─────────────────────────────

import { splitBibtex } from "@/lib/latex/assemble";
import { resolveAllEntries } from "./resolve";
import { extractCiteKeys } from "./extract-keys";
import { searchCrossRef, lookupDOI } from "./crossref";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export interface CitationResolutionSummary {
  total: number;
  tierA: number;
  tierD: number;
  errors: number;
}

/**
 * Try to extract BibTeX entries from the full response even when
 * the ---BIBTEX--- separator is missing. AI may put entries inline
 * or use a different separator.
 */
function fallbackBibtexExtraction(text: string): string {
  const entryPattern = /@(?:article|book|inproceedings|incollection|phdthesis|mastersthesis|misc|techreport|manual)\s*\{[^@]*/gi;
  const matches = text.match(entryPattern);
  if (!matches || matches.length === 0) return "";
  return matches.join("\n\n");
}

/**
 * Resolve citations from the BibTeX trailer of an AI-generated section.
 *
 * 1. Split the full LaTeX response at ---BIBTEX---
 * 2. If no trailer found, attempt fallback BibTeX extraction
 * 3. Resolve each entry via CrossRef/PubMed
 * 4. Upsert only NEW or UNVERIFIED citations (skip verified/attested)
 * 5. Extract ALL \cite{} keys from body — create Tier D placeholders
 *    for keys that have no trailer BibTeX and no existing DB entry
 */
export async function resolveSectionCitations(
  projectId: string,
  fullLatexResponse: string
): Promise<CitationResolutionSummary> {
  const summary: CitationResolutionSummary = {
    total: 0,
    tierA: 0,
    tierD: 0,
    errors: 0,
  };

  const { body, bib } = splitBibtex(fullLatexResponse);

  // Use trailer BibTeX, or fallback extraction if empty
  const bibtexContent = bib.trim()
    ? bib
    : fallbackBibtexExtraction(fullLatexResponse);

  const supabase = createAdminSupabaseClient();

  // Track all resolved keys (from trailer BibTeX)
  const resolvedKeys = new Set<string>();

  // Step 1: Resolve trailer BibTeX entries (if any)
  if (bibtexContent.trim()) {
    const { resolved, errors } = await resolveAllEntries(bibtexContent);

    if (errors.length > 0) {
      console.warn(
        `Citation resolution errors for project ${projectId}:`,
        errors
      );
      summary.errors = errors.length;
    }

    if (resolved.length > 0) {
      // Batch-select existing citations for this project
      const citeKeys = resolved.map((r) => r.citeKey);
      const { data: existing } = await supabase
        .from("citations")
        .select("cite_key, verified_at, attested_at")
        .eq("project_id", projectId)
        .in("cite_key", citeKeys);

      const existingMap = new Map(
        (existing ?? []).map((c) => [
          c.cite_key as string,
          {
            verifiedAt: c.verified_at as string | null,
            attestedAt: c.attested_at as string | null,
          },
        ])
      );

      // Upsert only new or unverified citations
      for (const citation of resolved) {
        resolvedKeys.add(citation.citeKey);
        summary.total++;
        if (citation.provenanceTier === "A") summary.tierA++;

        const ex = existingMap.get(citation.citeKey);

        // Skip if already verified or attested by user
        if (ex?.verifiedAt || ex?.attestedAt) continue;

        const now = new Date().toISOString();

        await supabase.from("citations").upsert(
          {
            project_id: projectId,
            cite_key: citation.citeKey,
            bibtex_entry: citation.bibtex,
            provenance_tier: citation.provenanceTier,
            evidence_type: citation.evidenceType,
            evidence_value: citation.evidenceValue,
            source_doi: citation.sourceDoi,
            source_pmid: citation.sourcePmid,
            verified_at: citation.provenanceTier === "A" ? now : null,
          },
          { onConflict: "project_id,cite_key" }
        );
      }
    }
  }

  // Step 2: Extract ALL \cite{} keys from the body text
  const allBodyKeys = extractCiteKeys(body);
  if (allBodyKeys.length === 0) return summary;

  // Find keys that weren't in the trailer and aren't already in the DB
  const orphanCandidates = allBodyKeys.filter((k) => !resolvedKeys.has(k));
  if (orphanCandidates.length === 0) return summary;

  // Check which of these orphan candidates already exist in DB
  const { data: existingOrphans } = await supabase
    .from("citations")
    .select("cite_key")
    .eq("project_id", projectId)
    .in("cite_key", orphanCandidates);

  const existingOrphanKeys = new Set(
    (existingOrphans ?? []).map((c) => c.cite_key as string)
  );

  const trueOrphans = orphanCandidates.filter(
    (k) => !existingOrphanKeys.has(k)
  );
  if (trueOrphans.length === 0) return summary;

  // Step 3: For each orphan, attempt a quick CrossRef search by parsing
  // the cite key (e.g., "smith2023" → "smith 2023")
  for (const key of trueOrphans) {
    let bibtexEntry = "";
    const tier: "A" | "D" = "D";
    let sourceDoi: string | null = null;

    try {
      // Parse key into author + year for search
      const keyMatch = key.match(/^([a-zA-Z]+)(\d{4})$/);
      if (keyMatch) {
        const searchQuery = `${keyMatch[1]} ${keyMatch[2]}`;
        const results = await searchCrossRef(searchQuery, 1);
        if (results.items.length > 0 && results.items[0].doi) {
          sourceDoi = results.items[0].doi;
          // Try to get actual BibTeX from DOI so the entry is not empty
          try {
            const doiResult = await lookupDOI(results.items[0].doi);
            if (doiResult?.bibtex) {
              bibtexEntry = doiResult.bibtex.replace(
                /^(@\w+\{)[^,]+,/m,
                `$1${key},`
              );
            }
          } catch {
            // DOI lookup failed — keep empty bibtex
          }
        }
      }
    } catch {
      // Search failed — just create Tier D placeholder
    }

    summary.total++;
    summary.tierD++;

    await supabase.from("citations").upsert(
      {
        project_id: projectId,
        cite_key: key,
        bibtex_entry: bibtexEntry,
        provenance_tier: tier,
        evidence_type: null,
        evidence_value: null,
        source_doi: sourceDoi,
        source_pmid: null,
        verified_at: null,
      },
      { onConflict: "project_id,cite_key" }
    );
  }

  return summary;
}
