/**
 * Shared utilities for pipeline QA checkpoints.
 *
 * Provides truncation detection, AI content QA helper,
 * and report-building utilities reused across checkpoint-rol,
 * checkpoint-results, checkpoint-conclusions, and checkpoint-references.
 */

import { getAnthropicClient } from "@/lib/ai/client";
import { recordTokenUsage } from "@/lib/ai/token-budget";
import { WORD_COUNT_CONFIG } from "@/lib/phases/word-count-config";
import { extractCiteKeys } from "@/lib/citations/extract-keys";
import { splitBibtex } from "@/lib/latex/assemble";
import type { QCDetail, QCCheck, QCReport } from "./final-qc";

// ── Re-exports ──────────────────────────────────────────────────────────────

export type { QCDetail, QCCheck, QCReport };

// ── Helpers ─────────────────────────────────────────────────────────────────

export function countLatexWords(latex: string): number {
  const plain = latex
    .replace(/\\[a-zA-Z]+\{[^}]*\}/g, " ")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[{}\\]/g, " ");
  return plain.split(/\s+/).filter(Boolean).length;
}

export function extractUniqueCiteKeys(latex: string): string[] {
  return extractCiteKeys(latex);
}

// ── Truncation Detection ────────────────────────────────────────────────────

export function detectTruncation(
  latex: string,
  phaseNumber: number,
): QCDetail[] {
  const details: QCDetail[] = [];
  const trimmed = latex.trim();
  if (!trimmed) return details;

  const { body, bib } = splitBibtex(trimmed);
  const bodyTrimmed = body.trim();

  // 1. Incomplete BibTeX trailer: has ---BIBTEX--- but last entry lacks closing `}`
  if (bib.trim()) {
    const lastBrace = bib.lastIndexOf("}");
    const lastAt = bib.lastIndexOf("@");
    if (lastAt >= 0 && (lastBrace < 0 || lastBrace < lastAt)) {
      details.push({
        item: `Phase ${phaseNumber}`,
        message: "BibTeX trailer appears truncated --- last entry lacks closing brace",
      });
    }
  }

  // 2. Abrupt body ending: last non-whitespace line doesn't end properly
  const bodyLines = bodyTrimmed.split("\n").filter((l) => l.trim());
  if (bodyLines.length > 0) {
    const lastLine = bodyLines[bodyLines.length - 1].trim();
    const endsWell =
      /[.!?}\]%]$/.test(lastLine) ||
      /\\end\{[^}]+\}$/.test(lastLine) ||
      /---BIBTEX---/.test(lastLine) ||
      lastLine === "";
    if (!endsWell && bodyLines.length > 5) {
      details.push({
        item: `Phase ${phaseNumber}`,
        message: "Content appears to end abruptly mid-sentence",
      });
    }
  }

  // 3. Mid-sentence cutoff: final paragraph < 20 chars without sentence-ending punctuation
  const paras = bodyTrimmed.split(/\n\s*\n/).filter((p) => p.trim());
  if (paras.length > 1) {
    const lastPara = paras[paras.length - 1].trim();
    if (lastPara.length < 20 && !/[.!?}]$/.test(lastPara)) {
      details.push({
        item: `Phase ${phaseNumber}`,
        message: "Final paragraph appears to be a truncated fragment",
      });
    }
  }

  // 4. Word count far below expected floor
  const config = WORD_COUNT_CONFIG[phaseNumber];
  if (config) {
    const words = countLatexWords(bodyTrimmed);
    const halfFloor = Math.floor(config.hardFloor * 0.5);
    if (words < halfFloor && words > 0) {
      details.push({
        item: `Phase ${phaseNumber}`,
        message: `Word count (${words}) is below 50% of minimum (${config.hardFloor}) --- likely truncated`,
      });
    }
  }

  return details;
}

// ── AI Content QA Helper ────────────────────────────────────────────────────

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

export async function aiContentQA(
  systemPrompt: string,
  context: string,
  projectId: string,
  phaseNumber: number,
): Promise<{ blocking: string[]; warnings: string[] }> {
  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: "user", content: context }],
    });

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;

    await recordTokenUsage(
      projectId,
      phaseNumber,
      inputTokens,
      outputTokens,
      HAIKU_MODEL,
    );

    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock?.type === "text" ? textBlock.text : "";

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { blocking: [], warnings: [] };

    const parsed = JSON.parse(jsonMatch[0]) as {
      blocking_issues?: string[];
      warnings?: string[];
    };

    return {
      blocking: parsed.blocking_issues ?? [],
      warnings: parsed.warnings ?? [],
    };
  } catch {
    // Non-fatal: AI QA failure doesn't block the pipeline
    return { blocking: [], warnings: [] };
  }
}

// ── Report Builder ──────────────────────────────────────────────────────────

export function buildReport(checks: QCCheck[]): QCReport {
  const blockingCount = checks.filter(
    (c) => c.blocking && c.status === "fail",
  ).length;
  const warningCount = checks.filter((c) => c.status === "warn").length;

  return {
    checks,
    overallPass: blockingCount === 0,
    blockingCount,
    warningCount,
  };
}
