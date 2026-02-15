/**
 * Escape special LaTeX characters in user-provided text.
 * This is critical for security — prevents LaTeX injection.
 */

// ── Unicode → ASCII/LaTeX normalisation ─────────────────────────────────

const UNICODE_REPLACEMENTS: [RegExp, string][] = [
  // Dashes
  [/\u2014/g, "---"],     // em-dash → ---
  [/\u2013/g, "--"],      // en-dash → --
  [/\u2012/g, "--"],      // figure dash → --
  // Quotes
  [/\u201C/g, "``"],      // left double quote → ``
  [/\u201D/g, "''"],      // right double quote → ''
  [/\u2018/g, "`"],       // left single quote → `
  [/\u2019/g, "'"],       // right single quote / apostrophe → '
  [/\u201A/g, ","],       // single low-9 quote → ,
  [/\u201E/g, ",,"],      // double low-9 quote → ,,
  // Ellipsis
  [/\u2026/g, "\\ldots{}"], // horizontal ellipsis → \ldots{}
  // Spaces
  [/\u00A0/g, "~"],       // non-breaking space → ~
  [/\u2009/g, "\\,"],     // thin space → \,
  [/\u2002/g, " "],       // en space → space
  [/\u2003/g, " "],       // em space → space
  // Misc punctuation
  [/\u00B7/g, "\\cdot{}"], // middle dot → \cdot{}
  [/\u2022/g, "\\textbullet{}"], // bullet → \textbullet{}
  [/\u00B0/g, "\\textdegree{}"], // degree sign → \textdegree{}
  [/\u00D7/g, "\\texttimes{}"],  // multiplication sign → \texttimes{}
  [/\u00B1/g, "\\textpm{}"],     // plus-minus → \textpm{}
  [/\u2264/g, "\\leq{}"],        // less-than-or-equal → \leq{}
  [/\u2265/g, "\\geq{}"],        // greater-than-or-equal → \geq{}
  [/\u2248/g, "\\approx{}"],     // approximately equal → \approx{}
  [/\u00AE/g, "\\textregistered{}"], // registered → \textregistered{}
  [/\u00A9/g, "\\textcopyright{}"],  // copyright → \textcopyright{}
  [/\uFB01/g, "fi"],     // fi ligature → fi
  [/\uFB02/g, "fl"],     // fl ligature → fl
];

/**
 * Normalise unicode characters to their ASCII/LaTeX equivalents.
 * Must run BEFORE escapeLatex() to avoid double-escaping.
 */
export function normaliseUnicode(text: string): string {
  let result = text;
  for (const [pattern, replacement] of UNICODE_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// ── LaTeX special character escaping ────────────────────────────────────

const LATEX_SPECIAL_CHARS: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

const ALL_SPECIAL_REGEX = /[\\&%$#_{}~^]/g;

export function escapeLatex(text: string): string {
  // Normalise unicode first, then escape LaTeX special chars
  const normalised = normaliseUnicode(text);
  return normalised.replace(
    ALL_SPECIAL_REGEX,
    (char) => LATEX_SPECIAL_CHARS[char] ?? char
  );
}

/**
 * Escape text for use in a LaTeX command argument.
 * Strips newlines and normalises whitespace in addition to escaping.
 */
export function escapeLatexArg(text: string): string {
  const normalised = text.replace(/\s+/g, " ").trim();
  return escapeLatex(normalised);
}
