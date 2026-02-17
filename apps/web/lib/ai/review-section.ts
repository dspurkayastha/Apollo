/**
 * Local section review checks (no AI API call — fast, free, deterministic).
 *
 * Checks: citation diff, word count, structural requirements, British English.
 */

import { getWordCountTarget } from "@/lib/phases/word-count-targets";

// ── Types ───────────────────────────────────────────────────────────────────

export type ReviewSeverity = "error" | "warning" | "info";

export interface ReviewIssue {
  severity: ReviewSeverity;
  category: "citation" | "word-count" | "structure" | "spelling";
  message: string;
}

export interface ReviewResult {
  issues: ReviewIssue[];
  passedReview: boolean;
}

// ── Citation diff ───────────────────────────────────────────────────────────

function extractCiteKeys(latex: string): Set<string> {
  const keys = new Set<string>();
  const re = /\\cite\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(latex)) !== null) {
    for (const k of m[1].split(",")) {
      const trimmed = k.trim();
      if (trimmed) keys.add(trimmed);
    }
  }
  return keys;
}

function checkCitations(
  currentLatex: string,
  originalLatex: string | null,
): ReviewIssue[] {
  if (!originalLatex) return [];

  const currentKeys = extractCiteKeys(currentLatex);
  const originalKeys = extractCiteKeys(originalLatex);
  const issues: ReviewIssue[] = [];

  // Removed citations
  for (const key of originalKeys) {
    if (!currentKeys.has(key)) {
      issues.push({
        severity: "warning",
        category: "citation",
        message: `Citation \\cite{${key}} was removed (present in AI-generated version)`,
      });
    }
  }

  // Added citations
  for (const key of currentKeys) {
    if (!originalKeys.has(key)) {
      issues.push({
        severity: "info",
        category: "citation",
        message: `Citation \\cite{${key}} was added (not in AI-generated version)`,
      });
    }
  }

  return issues;
}

// ── Word count ──────────────────────────────────────────────────────────────

function countWords(latex: string): number {
  const plain = latex
    .replace(/\\[a-zA-Z]+\{[^}]*\}/g, " ")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[{}\\]/g, " ");
  return plain.split(/\s+/).filter(Boolean).length;
}

function checkWordCount(
  currentLatex: string,
  phaseNumber: number,
): ReviewIssue[] {
  const target = getWordCountTarget(phaseNumber);
  if (!target) return [];

  const count = countWords(currentLatex);
  const issues: ReviewIssue[] = [];

  if (count < target.min) {
    issues.push({
      severity: "warning",
      category: "word-count",
      message: `Word count (${count}) is below the minimum target of ${target.min} for this phase`,
    });
  } else if (count > target.max) {
    issues.push({
      severity: "warning",
      category: "word-count",
      message: `Word count (${count}) exceeds the maximum target of ${target.max} for this phase`,
    });
  }

  return issues;
}

// ── Structure checks (phase-specific) ───────────────────────────────────────

function checkStructure(
  latex: string,
  phaseNumber: number,
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];

  switch (phaseNumber) {
    case 4: {
      // ROL: must contain summary table (longtable)
      if (!latex.includes("\\begin{longtable}")) {
        issues.push({
          severity: "warning",
          category: "structure",
          message:
            "Review of Literature should contain a summary table (\\begin{longtable})",
        });
      }
      break;
    }

    case 5: {
      // M&M: at least 8 section/subsection commands (NBEMS requirement)
      const sectionCount = (
        latex.match(/\\(section|subsection|subsubsection)\*?\{/g) ?? []
      ).length;
      if (sectionCount < 8) {
        issues.push({
          severity: "warning",
          category: "structure",
          message: `Materials & Methods has ${sectionCount} section headings (minimum 8 expected for NBEMS compliance)`,
        });
      }
      break;
    }

    case 7: {
      // Discussion: must contain Strengths/Limitations
      const lower = latex.toLowerCase();
      if (
        !lower.includes("strength") &&
        !lower.includes("limitation")
      ) {
        issues.push({
          severity: "warning",
          category: "structure",
          message:
            "Discussion should contain Strengths and Limitations subsections",
        });
      }
      break;
    }

    case 8: {
      // Conclusion: must contain Conclusions and Recommendations
      const lower = latex.toLowerCase();
      if (!lower.includes("conclusion")) {
        issues.push({
          severity: "warning",
          category: "structure",
          message: "Conclusion section should contain a Conclusions heading",
        });
      }
      if (!lower.includes("recommendation")) {
        issues.push({
          severity: "warning",
          category: "structure",
          message:
            "Conclusion section should contain a Recommendations heading",
        });
      }
      break;
    }
  }

  return issues;
}

// ── British English spot-check ──────────────────────────────────────────────

const AMERICAN_TO_BRITISH: [RegExp, string][] = [
  [/\banalyze\b/gi, "analyse"],
  [/\banalyzed\b/gi, "analysed"],
  [/\banalyzing\b/gi, "analysing"],
  [/\bbehavior\b/gi, "behaviour"],
  [/\bcolor\b/gi, "colour"],
  [/\bcenter\b/gi, "centre"],
  [/\bcenterline\b/gi, "centreline"],
  [/\brandomized\b/gi, "randomised"],
  [/\borganize\b/gi, "organise"],
  [/\borganized\b/gi, "organised"],
  [/\brecognize\b/gi, "recognise"],
  [/\brecognized\b/gi, "recognised"],
  [/\bspecialized\b/gi, "specialised"],
  [/\bfavor\b/gi, "favour"],
  [/\bhonor\b/gi, "honour"],
  [/\blabor\b/gi, "labour"],
  [/\btumor\b/gi, "tumour"],
  [/\bfetus\b/gi, "foetus"],
  [/\bpediatric\b/gi, "paediatric"],
  [/\banesthesia\b/gi, "anaesthesia"],
  [/\bhemoglobin\b/gi, "haemoglobin"],
  [/\besophagus\b/gi, "oesophagus"],
];

function checkBritishEnglish(latex: string): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  // Strip LaTeX commands to only check prose
  const prose = latex
    .replace(/\\[a-zA-Z]+\{[^}]*\}/g, " ")
    .replace(/\\[a-zA-Z]+/g, " ");

  for (const [pattern, suggestion] of AMERICAN_TO_BRITISH) {
    const match = pattern.exec(prose);
    if (match) {
      issues.push({
        severity: "info",
        category: "spelling",
        message: `"${match[0]}" → consider British English spelling "${suggestion}"`,
      });
      // Reset regex lastIndex since we used /g flag
      pattern.lastIndex = 0;
    }
  }

  return issues;
}

// ── Citation quality ────────────────────────────────────────────────────────

interface CitationRecord {
  cite_key: string;
  provenance_tier: string;
}

const CITATION_HEAVY_PHASES = new Set([2, 4, 5, 7]);

export function checkCitationQuality(
  latex: string,
  citations: CitationRecord[],
  phaseNumber: number,
): ReviewIssue[] {
  if (!CITATION_HEAVY_PHASES.has(phaseNumber)) return [];

  const issues: ReviewIssue[] = [];
  const bodyKeys = extractCiteKeys(latex);

  // Count tiers
  const citationMap = new Map(citations.map((c) => [c.cite_key, c.provenance_tier]));
  let tierDCount = 0;
  const missingKeys: string[] = [];

  for (const key of bodyKeys) {
    const tier = citationMap.get(key);
    if (!tier) {
      missingKeys.push(key);
    } else if (tier === "D") {
      tierDCount++;
    }
  }

  const total = bodyKeys.size;
  if (total > 0 && tierDCount / total > 0.5) {
    issues.push({
      severity: "warning",
      category: "citation",
      message: `${tierDCount} of ${total} citations are unverified (Tier D) — consider re-resolving or attesting before approval`,
    });
  }

  if (missingKeys.length > 0) {
    issues.push({
      severity: "warning",
      category: "citation",
      message: `${missingKeys.length} citation key(s) not found in database: ${missingKeys.slice(0, 5).join(", ")}${missingKeys.length > 5 ? "..." : ""}`,
    });
  }

  return issues;
}

// ── Public API ──────────────────────────────────────────────────────────────

export function reviewSection(
  currentLatex: string,
  originalLatex: string | null,
  phaseNumber: number,
  citations?: CitationRecord[],
): ReviewResult {
  const issues: ReviewIssue[] = [
    ...checkCitations(currentLatex, originalLatex),
    ...checkWordCount(currentLatex, phaseNumber),
    ...checkStructure(currentLatex, phaseNumber),
    ...checkBritishEnglish(currentLatex),
    ...(citations ? checkCitationQuality(currentLatex, citations, phaseNumber) : []),
  ];

  // passedReview is true if there are no errors or warnings
  const passedReview = !issues.some(
    (i) => i.severity === "error" || i.severity === "warning",
  );

  return { issues, passedReview };
}
