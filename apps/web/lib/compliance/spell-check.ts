/**
 * British English spell checker for thesis content.
 * Checks for common American → British spelling differences.
 */

/** American → British spelling replacements */
const AMERICAN_TO_BRITISH: [RegExp, string][] = [
  [/\banalyze\b/gi, "analyse"],
  [/\banalyzed\b/gi, "analysed"],
  [/\banalyzing\b/gi, "analysing"],
  [/\borganize\b/gi, "organise"],
  [/\borganized\b/gi, "organised"],
  [/\borganizing\b/gi, "organising"],
  [/\brecognize\b/gi, "recognise"],
  [/\brecognized\b/gi, "recognised"],
  [/\boptimize\b/gi, "optimise"],
  [/\boptimized\b/gi, "optimised"],
  [/\brandomize\b/gi, "randomise"],
  [/\brandomized\b/gi, "randomised"],
  [/\bstandardize\b/gi, "standardise"],
  [/\bstandardized\b/gi, "standardised"],
  [/\bminimize\b/gi, "minimise"],
  [/\bminimized\b/gi, "minimised"],
  [/\bmaximize\b/gi, "maximise"],
  [/\bmaximized\b/gi, "maximised"],
  [/\butilize\b/gi, "utilise"],
  [/\butilized\b/gi, "utilised"],
  [/\bspecialize\b/gi, "specialise"],
  [/\bspecialized\b/gi, "specialised"],
  [/\bhospitalize\b/gi, "hospitalise"],
  [/\bhospitalized\b/gi, "hospitalised"],
  [/\bcategorize\b/gi, "categorise"],
  [/\bcategorized\b/gi, "categorised"],
  [/\bsummarize\b/gi, "summarise"],
  [/\bsummarized\b/gi, "summarised"],
  [/\bcharacterize\b/gi, "characterise"],
  [/\bcharacterized\b/gi, "characterised"],
  [/\bcolor\b/gi, "colour"],
  [/\bbehavior\b/gi, "behaviour"],
  [/\bfavor\b/gi, "favour"],
  [/\bfavorable\b/gi, "favourable"],
  [/\bhonor\b/gi, "honour"],
  [/\bhumor\b/gi, "humour"],
  [/\blabor\b/gi, "labour"],
  [/\bneighbor\b/gi, "neighbour"],
  [/\btumor\b/gi, "tumour"],
  [/\bcenter\b/gi, "centre"],
  [/\bfiber\b/gi, "fibre"],
  [/\bliter\b/gi, "litre"],
  [/\bmeter\b/gi, "metre"],
  [/\bdefense\b/gi, "defence"],
  [/\boffense\b/gi, "offence"],
  [/\blicense\b/gi, "licence"],
  [/\bpractice\b(?=\s)/gi, "practise"], // Only the verb form
  [/\bfetus\b/gi, "foetus"],
  [/\banemia\b/gi, "anaemia"],
  [/\banemic\b/gi, "anaemic"],
  [/\banesthesia\b/gi, "anaesthesia"],
  [/\bdiarrhea\b/gi, "diarrhoea"],
  [/\bedema\b/gi, "oedema"],
  [/\bestrogen\b/gi, "oestrogen"],
  [/\bhemoglobin\b/gi, "haemoglobin"],
  [/\bhemorrhage\b/gi, "haemorrhage"],
  [/\bleukemia\b/gi, "leukaemia"],
  [/\bpediatric\b/gi, "paediatric"],
  [/\bgynecology\b/gi, "gynaecology"],
  [/\borthopedic\b/gi, "orthopaedic"],
];

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
