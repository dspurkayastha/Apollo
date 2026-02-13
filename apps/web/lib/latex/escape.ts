/**
 * Escape special LaTeX characters in user-provided text.
 * This is critical for security — prevents LaTeX injection.
 */

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
  // Use a single-pass replacement to avoid double-escaping
  return text.replace(
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
