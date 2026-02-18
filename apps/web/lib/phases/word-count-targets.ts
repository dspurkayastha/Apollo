/**
 * Word count targets per thesis phase (GOLD Standard methodology).
 *
 * Sources from the canonical word-count-config.ts (DECISIONS.md 4.1).
 * Phases without a meaningful prose target (orientation, front matter,
 * references, appendices, final QC) return `null`.
 */

import { WORD_COUNT_CONFIG } from "./word-count-config";

export interface WordCountTarget {
  min: number;
  max: number;
}

export type WordCountStatus = "under" | "on-target" | "over" | "no-target";

/**
 * Return the target word-count range for the given phase, or `null` if the
 * phase has no prose target.
 */
export function getWordCountTarget(phaseNumber: number): WordCountTarget | null {
  const cfg = WORD_COUNT_CONFIG[phaseNumber];
  if (!cfg) return null;
  return { min: cfg.softMin, max: cfg.softMax };
}

/**
 * Determine whether the current word count is under, on-target, or over the
 * expected range for the given phase.  Returns `"no-target"` for phases that
 * do not have a word-count target.
 */
export function getWordCountStatus(
  phaseNumber: number,
  wordCount: number,
): WordCountStatus {
  const target = getWordCountTarget(phaseNumber);

  if (!target) {
    return "no-target";
  }

  if (wordCount < target.min) {
    return "under";
  }

  if (wordCount > target.max) {
    return "over";
  }

  return "on-target";
}
