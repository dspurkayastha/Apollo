/**
 * Section review checks: fast regex pre-flight + optional AI-powered review.
 *
 * Pre-flight checks (no AI call --- fast, free, deterministic):
 *   citation diff, word count, structural requirements, British English.
 *
 * AI review (optional, calls Haiku --- ~2K tokens per review):
 *   completeness, logical flow, citation adequacy, methodological rigour,
 *   academic tone, synopsis alignment.
 */

import { getWordCountConfig } from "@/lib/phases/word-count-config";
import { getAnthropicClient } from "@/lib/ai/client";
import { SECTION_REVIEW_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { recordTokenUsage } from "@/lib/ai/token-budget";

// ── Types ───────────────────────────────────────────────────────────────────

export type ReviewSeverity = "error" | "warning" | "info";

export interface ReviewIssue {
  severity: ReviewSeverity;
  category: "citation" | "word-count" | "structure" | "spelling" | "ai-review";
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
  const cfg = getWordCountConfig(phaseNumber);
  if (!cfg) return [];

  const count = countWords(currentLatex);
  const issues: ReviewIssue[] = [];

  if (count < cfg.hardFloor) {
    issues.push({
      severity: "warning",
      category: "word-count",
      message: `Word count (${count}) is below the minimum target of ${cfg.softMin} for this phase`,
    });
  } else if (count > cfg.hardCeiling) {
    issues.push({
      severity: "warning",
      category: "word-count",
      message: `Word count (${count}) exceeds the hard ceiling of ${cfg.hardCeiling} for this phase (target: ${cfg.softMin}--${cfg.softMax})`,
    });
  } else if (count > cfg.softMax) {
    issues.push({
      severity: "info",
      category: "word-count",
      message: `Word count (${count}) is above the soft target of ${cfg.softMax} but within the hard ceiling of ${cfg.hardCeiling}`,
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
      // M&M: at least 12 section/subsection commands (NBEMS requirement)
      const sectionCount = (
        latex.match(/\\(section|subsection|subsubsection)\*?\{/g) ?? []
      ).length;
      if (sectionCount < 12) {
        issues.push({
          severity: "warning",
          category: "structure",
          message: `Materials & Methods has ${sectionCount} section headings (minimum 12 expected for NBEMS compliance)`,
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
      message: `${tierDCount} of ${total} citations are unverified (Tier D) --- consider re-resolving or attesting before approval`,
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

// ── AI-powered review (optional, calls Haiku) ───────────────────────────────

interface AIReviewDimension {
  name: string;
  rating: string;
  feedback: string;
}

interface AIReviewResponse {
  dimensions: AIReviewDimension[];
  overall_assessment: string;
  suggestions: string[];
  blocking_issues: string[];
}

const WEAK_RATINGS = new Set([
  "incomplete", "weak", "under-cited", "needs-improvement", "informal", "divergent",
]);

/**
 * AI-powered section review via Haiku. Non-blocking --- errors return empty array.
 * ~2K tokens per review call.
 */
export async function aiReviewSection(
  latex: string,
  phaseNumber: number,
  projectId: string,
  synopsisText: string,
  metadata: Record<string, unknown>,
): Promise<ReviewIssue[]> {
  const issues: ReviewIssue[] = [];

  try {
    const client = getAnthropicClient();
    const phaseName = getPhaseName(phaseNumber);

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: SECTION_REVIEW_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [
          `Phase: ${phaseName}`,
          `\nMetadata:\n${Object.entries(metadata).filter(([, v]) => v != null).map(([k, v]) => `${k}: ${String(v)}`).join("\n")}`,
          `\nSynopsis (first 2000 chars):\n${synopsisText.slice(0, 2000)}`,
          `\nChapter content:\n${latex.slice(0, 8000)}`,
        ].join("\n"),
      }],
    });

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    void recordTokenUsage(projectId, phaseNumber, inputTokens, outputTokens, "claude-haiku-4-5-20251001").catch(console.error);

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return issues;

    let jsonText = textBlock.text.trim();
    jsonText = jsonText.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "");

    const parsed = JSON.parse(jsonText) as AIReviewResponse;

    // Convert blocking issues to errors
    for (const issue of parsed.blocking_issues ?? []) {
      if (issue.trim()) {
        issues.push({
          severity: "error",
          category: "ai-review",
          message: issue,
        });
      }
    }

    // Convert weak ratings to warnings
    for (const dim of parsed.dimensions ?? []) {
      if (WEAK_RATINGS.has(dim.rating)) {
        issues.push({
          severity: "warning",
          category: "ai-review",
          message: `${dim.name}: ${dim.feedback}`,
        });
      }
    }

    // Convert suggestions to info
    for (const suggestion of parsed.suggestions ?? []) {
      if (suggestion.trim()) {
        issues.push({
          severity: "info",
          category: "ai-review",
          message: suggestion,
        });
      }
    }
  } catch (err) {
    console.warn("AI review failed (non-blocking):", err);
  }

  return issues;
}

function getPhaseName(phaseNumber: number): string {
  const names: Record<number, string> = {
    1: "Front Matter",
    2: "Introduction",
    3: "Aims and Objectives",
    4: "Review of Literature",
    5: "Materials and Methods",
    6: "Results",
    7: "Discussion",
    8: "Conclusion",
    9: "References",
    10: "Appendices",
  };
  return names[phaseNumber] ?? `Phase ${phaseNumber}`;
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface ReviewOptions {
  includeAIReview?: boolean;
  projectId?: string;
  synopsis?: string;
  metadata?: Record<string, unknown>;
}

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
