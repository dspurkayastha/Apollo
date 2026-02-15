// ── Bidirectional citation integrity audit ──────────────────────────────────
//
// Pure function — no I/O, trivially testable.

import type { Section, Citation } from "@/lib/types/database";

export interface AuditResult {
  /** Cite keys used in sections but not in the citations DB */
  missingCitations: { citeKey: string; usedInPhases: number[] }[];
  /** Citations in DB not referenced by any section */
  orphanedCitations: { citationId: string; citeKey: string; tier: string }[];
  /** Tier D citations that are actively used in sections (blocks Final QC) */
  tierDBlocking: { citationId: string; citeKey: string; usedInPhases: number[] }[];
  totalCitations: number;
  totalCiteCommands: number;
  /** 0–100 score: (commands with Tier A/B/C match) / total commands × 100 */
  integrityScore: number;
}

/**
 * Run a bidirectional integrity audit on citations.
 *
 * Forward: cite keys in section.citation_keys[] not in citation DB → missingCitations
 * Reverse: citations in DB not in any section → orphanedCitations
 * Tier D used in sections → tierDBlocking
 * Score: (commands with Tier A/B/C match) / total commands × 100
 */
export function auditCitations(
  sections: Section[],
  citations: Citation[]
): AuditResult {
  // 1. Collect all cite keys from sections → map citeKey → Set<phaseNumber>
  const usedKeys = new Map<string, Set<number>>();
  let totalCiteCommands = 0;

  for (const section of sections) {
    if (!section.citation_keys || section.citation_keys.length === 0) continue;
    for (const key of section.citation_keys) {
      if (!usedKeys.has(key)) {
        usedKeys.set(key, new Set());
      }
      usedKeys.get(key)!.add(section.phase_number);
      totalCiteCommands++;
    }
  }

  // 2. Build citation lookup: citeKey → Citation
  const citationMap = new Map<string, Citation>();
  for (const citation of citations) {
    citationMap.set(citation.cite_key, citation);
  }

  // 3. Forward: cite keys in sections not in citation DB
  const missingCitations: AuditResult["missingCitations"] = [];
  for (const [key, phases] of usedKeys) {
    if (!citationMap.has(key)) {
      missingCitations.push({
        citeKey: key,
        usedInPhases: Array.from(phases).sort((a, b) => a - b),
      });
    }
  }

  // 4. Reverse: citations in DB not in any section
  const orphanedCitations: AuditResult["orphanedCitations"] = [];
  for (const citation of citations) {
    if (!usedKeys.has(citation.cite_key)) {
      orphanedCitations.push({
        citationId: citation.id,
        citeKey: citation.cite_key,
        tier: citation.provenance_tier,
      });
    }
  }

  // 5. Tier D used in sections → blocking
  const tierDBlocking: AuditResult["tierDBlocking"] = [];
  for (const [key, phases] of usedKeys) {
    const citation = citationMap.get(key);
    if (citation && citation.provenance_tier === "D") {
      tierDBlocking.push({
        citationId: citation.id,
        citeKey: key,
        usedInPhases: Array.from(phases).sort((a, b) => a - b),
      });
    }
  }

  // 6. Integrity score
  let matchedCommands = 0;
  for (const [key] of usedKeys) {
    const citation = citationMap.get(key);
    if (citation && citation.provenance_tier !== "D") {
      // Count each usage of this key
      matchedCommands += usedKeys.get(key)!.size;
    }
  }
  // Recalculate totalCiteCommands as sum of unique key-phase pairs
  let totalUniqueUsages = 0;
  for (const [, phases] of usedKeys) {
    totalUniqueUsages += phases.size;
  }

  const integrityScore =
    totalUniqueUsages > 0
      ? Math.round((matchedCommands / totalUniqueUsages) * 100)
      : 100; // No citations = perfect score

  return {
    missingCitations,
    orphanedCitations,
    tierDBlocking,
    totalCitations: citations.length,
    totalCiteCommands,
    integrityScore,
  };
}
