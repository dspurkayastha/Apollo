/**
 * British English spell checker for thesis content.
 * Checks for common American → British spelling differences.
 */

import { AMERICAN_TO_BRITISH } from "./spelling-dictionary";

export interface SpellCheckResult {
  issues: SpellIssue[];
  correctedText: string;
}

export interface SpellIssue {
  american: string;
  british: string;
  line: number;
  column: number;
}

/**
 * Strip LaTeX commands from text for spell checking.
 */
function stripLatex(text: string): string {
  return text
    .replace(/\\[a-zA-Z]+(\{[^}]*\})?(\[[^\]]*\])?/g, " ")
    .replace(/[{}\\%$&_^~#]/g, " ");
}

/**
 * Check LaTeX content for American English spellings.
 * Returns issues found and a corrected version of the text.
 */
export function checkBritishEnglish(latexContent: string): SpellCheckResult {
  const issues: SpellIssue[] = [];
  const plainText = stripLatex(latexContent);
  const lines = plainText.split("\n");

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    for (const [pattern, replacement] of AMERICAN_TO_BRITISH) {
      let match: RegExpExecArray | null;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(line)) !== null) {
        issues.push({
          american: match[0],
          british: replacement,
          line: lineIdx + 1,
          column: match.index + 1,
        });
      }
    }
  }

  // Generate corrected text
  let corrected = latexContent;
  for (const [pattern, replacement] of AMERICAN_TO_BRITISH) {
    corrected = corrected.replace(pattern, replacement);
  }

  return { issues, correctedText: corrected };
}
