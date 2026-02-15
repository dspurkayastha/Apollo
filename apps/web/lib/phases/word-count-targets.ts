/**
 * Word count targets per thesis phase (GOLD Standard methodology).
 *
 * Phases without a meaningful prose target (orientation, front matter,
 * references, appendices, final QC) return `null`.
 */

export interface WordCountTarget {
  min: number;
  max: number;
}

export type WordCountStatus = "under" | "on-target" | "over" | "no-target";

const WORD_COUNT_TARGETS: Record<number, WordCountTarget> = {
  2: { min: 750, max: 1200 },   // introduction
  3: { min: 200, max: 500 },    // aims
  4: { min: 3500, max: 4500 },  // review_of_literature
  5: { min: 1500, max: 3000 },  // materials_methods
  6: { min: 1500, max: 3000 },  // results
  7: { min: 2000, max: 3500 },  // discussion
  8: { min: 400, max: 800 },    // conclusion
};

/**
 * Return the target word-count range for the given phase, or `null` if the
 * phase has no prose target.
 */
export function getWordCountTarget(phaseNumber: number): WordCountTarget | null {
  return WORD_COUNT_TARGETS[phaseNumber] ?? null;
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
