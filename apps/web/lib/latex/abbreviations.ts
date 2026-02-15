import { escapeLatex } from "./escape";
import type { Abbreviation } from "@/lib/types/database";

/**
 * Generate LaTeX for the abbreviations list.
 * Uses the \begin{abbreviations} environment from the thesis CLS files.
 * Abbreviations are sorted alphabetically by short_form.
 */
export function generateAbbreviationsLatex(abbreviations: Abbreviation[]): string {
  if (abbreviations.length === 0) return "";

  const sorted = [...abbreviations].sort((a, b) =>
    a.short_form.localeCompare(b.short_form)
  );

  const rows = sorted
    .map((abbr) => `  ${escapeLatex(abbr.short_form)} & ${escapeLatex(abbr.long_form)} \\\\`)
    .join("\n");

  return `\\begin{abbreviations}\n${rows}\n\\end{abbreviations}\n`;
}
