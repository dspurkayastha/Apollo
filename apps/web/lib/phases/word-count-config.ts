/**
 * Canonical word count configuration --- Single Source of Truth.
 * Source: DECISIONS.md Section 4.1--4.2.
 *
 * softMin/softMax: AI target range (used in prompts + UI badge)
 * hardFloor: QC fail below this (= softMin)
 * hardCeiling: QC fail above this (= Math.ceil(softMax * 1.15))
 * aiAimLow/aiAimHigh: "Attempt to stay on the higher end" per DECISIONS.md 4.2
 */

export interface WordCountConfig {
  softMin: number;
  softMax: number;
  hardFloor: number;
  hardCeiling: number;
  aiAimLow: number;
  aiAimHigh: number;
}

export const WORD_COUNT_CONFIG: Record<number, WordCountConfig> = {
  2: { softMin: 1000, softMax: 1400, hardFloor: 1000, hardCeiling: 1610, aiAimLow: 1300, aiAimHigh: 1400 },  // Introduction
  3: { softMin: 300,  softMax: 500,  hardFloor: 300,  hardCeiling: 575,  aiAimLow: 450,  aiAimHigh: 500  },  // Aims
  4: { softMin: 3500, softMax: 5000, hardFloor: 3500, hardCeiling: 5750, aiAimLow: 4500, aiAimHigh: 5000 },  // ROL
  5: { softMin: 1500, softMax: 2500, hardFloor: 1500, hardCeiling: 2875, aiAimLow: 2200, aiAimHigh: 2500 },  // M&M
  6: { softMin: 1500, softMax: 2500, hardFloor: 1500, hardCeiling: 2875, aiAimLow: 2200, aiAimHigh: 2500 },  // Results
  7: { softMin: 2000, softMax: 3500, hardFloor: 2000, hardCeiling: 4025, aiAimLow: 3000, aiAimHigh: 3500 },  // Discussion
  8: { softMin: 500,  softMax: 800,  hardFloor: 500,  hardCeiling: 920,  aiAimLow: 700,  aiAimHigh: 800  },  // Conclusion
};

/**
 * Get the word count config for a given phase, or null if the phase
 * has no prose target (e.g. orientation, front matter, references, appendices).
 */
export function getWordCountConfig(phaseNumber: number): WordCountConfig | null {
  return WORD_COUNT_CONFIG[phaseNumber] ?? null;
}

/**
 * Build a standardised word count instruction string for AI prompts.
 */
export function wordCountInstruction(phaseNumber: number): string {
  const cfg = getWordCountConfig(phaseNumber);
  if (!cfg) return "";
  return `- Target: ${cfg.softMin}--${cfg.softMax} words of chapter content. Aim for ${cfg.aiAimLow}--${cfg.aiAimHigh} words. HARD LIMIT: do NOT exceed ${cfg.hardCeiling} words of chapter content (BibTeX entries below the ---BIBTEX--- separator do NOT count toward this word limit).`;
}
