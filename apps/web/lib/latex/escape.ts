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
  [/\u2015/g, "---"],     // horizontal bar → ---
  // Quotes
  [/\u201C/g, "``"],      // left double quote → ``
  [/\u201D/g, "''"],      // right double quote → ''
  [/\u2018/g, "`"],       // left single quote → `
  [/\u2019/g, "'"],       // right single quote / apostrophe → '
  [/\u201A/g, ","],       // single low-9 quote → ,
  [/\u201E/g, ",,"],      // double low-9 quote → ,,
  [/\u00AB/g, "``"],      // left guillemet → ``
  [/\u00BB/g, "''"],      // right guillemet → ''
  [/\u00B2/g, "\\textsuperscript{2}"], // ² → superscript 2
  [/\u00B3/g, "\\textsuperscript{3}"], // ³ → superscript 3
  [/\u00B9/g, "\\textsuperscript{1}"], // ¹ → superscript 1
  [/\u00BC/g, "1/4"],     // ¼ → 1/4
  [/\u00BD/g, "1/2"],     // ½ → 1/2
  [/\u00BE/g, "3/4"],     // ¾ → 3/4
  [/\u00B5/g, "u"],       // µ (micro sign) → u (safe ASCII fallback)
  // Ellipsis
  [/\u2026/g, "\\ldots{}"], // horizontal ellipsis → \ldots{}
  // Spaces
  [/\u00A0/g, "~"],       // non-breaking space → ~
  [/\u2009/g, "\\,"],     // thin space → \,
  [/\u2002/g, " "],       // en space → space
  [/\u2003/g, " "],       // em space → space
  [/\u200B/g, ""],        // zero-width space → remove
  [/\u200C/g, ""],        // zero-width non-joiner → remove
  [/\u200D/g, ""],        // zero-width joiner → remove
  [/\uFEFF/g, ""],        // byte order mark → remove
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
  // Ligatures
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
  // Safety net: convert ALL non-ASCII to LaTeX commands or strip.
  // BibTeX doesn't understand UTF-8 — it can split multi-byte sequences when
  // line-wrapping the .bbl file, creating invalid byte sequences that cause
  // "Invalid UTF-8 byte sequence" errors in pdfLaTeX.
  // Converting everything to ASCII LaTeX commands avoids this entirely.
  result = result.replace(/[^\u0000-\u007F]/g, (ch) => {
    const cp = ch.codePointAt(0) ?? 0;
    const map: Record<number, string> = {
      // Latin-1 Supplement accented characters → LaTeX commands
      0x00C0: "{\\`A}", 0x00C1: "{\\'A}", 0x00C2: "{\\^A}", 0x00C3: "{\\~A}",
      0x00C4: "{\\\"A}", 0x00C5: "{\\AA}", 0x00C6: "{\\AE}",
      0x00C7: "{\\c{C}}", 0x00C8: "{\\`E}", 0x00C9: "{\\'E}",
      0x00CA: "{\\^E}", 0x00CB: "{\\\"E}", 0x00CC: "{\\`I}",
      0x00CD: "{\\'I}", 0x00CE: "{\\^I}", 0x00CF: "{\\\"I}",
      0x00D0: "{\\DH}", 0x00D1: "{\\~N}", 0x00D2: "{\\`O}",
      0x00D3: "{\\'O}", 0x00D4: "{\\^O}", 0x00D5: "{\\~O}",
      0x00D6: "{\\\"O}", 0x00D8: "{\\O}", 0x00D9: "{\\`U}",
      0x00DA: "{\\'U}", 0x00DB: "{\\^U}", 0x00DC: "{\\\"U}",
      0x00DD: "{\\'Y}", 0x00DE: "{\\TH}", 0x00DF: "{\\ss}",
      0x00E0: "{\\`a}", 0x00E1: "{\\'a}", 0x00E2: "{\\^a}", 0x00E3: "{\\~a}",
      0x00E4: "{\\\"a}", 0x00E5: "{\\aa}", 0x00E6: "{\\ae}",
      0x00E7: "{\\c{c}}", 0x00E8: "{\\`e}", 0x00E9: "{\\'e}",
      0x00EA: "{\\^e}", 0x00EB: "{\\\"e}", 0x00EC: "{\\`\\i}",
      0x00ED: "{\\'\\i}", 0x00EE: "{\\^\\i}", 0x00EF: "{\\\"\\i}",
      0x00F0: "{\\dh}", 0x00F1: "{\\~n}", 0x00F2: "{\\`o}",
      0x00F3: "{\\'o}", 0x00F4: "{\\^o}", 0x00F5: "{\\~o}",
      0x00F6: "{\\\"o}", 0x00F8: "{\\o}", 0x00F9: "{\\`u}",
      0x00FA: "{\\'u}", 0x00FB: "{\\^u}", 0x00FC: "{\\\"u}",
      0x00FD: "{\\'y}", 0x00FE: "{\\th}", 0x00FF: "{\\\"y}",
      // Latin Extended-A/B
      0x0131: "{\\i}",     // ı (dotless i)
      0x011F: "{\\u{g}}",  // ğ (g with breve)
      0x011E: "{\\u{G}}",  // Ğ (G with breve)
      0x015E: "{\\c{S}}",  // Ş (S with cedilla)
      0x015F: "{\\c{s}}",  // ş (s with cedilla)
      0x0141: "{\\L}",     // Ł (L with stroke)
      0x0142: "{\\l}",     // ł (l with stroke)
      0x0106: "{\\'C}",    // Ć (C with acute)
      0x0107: "{\\'c}",    // ć (c with acute)
      0x010C: "{\\v{C}}",  // Č (C with caron)
      0x010D: "{\\v{c}}",  // č (c with caron)
      0x0160: "{\\v{S}}",  // Š (S with caron)
      0x0161: "{\\v{s}}",  // š (s with caron)
      0x017D: "{\\v{Z}}",  // Ž (Z with caron)
      0x017E: "{\\v{z}}",  // ž (z with caron)
    };
    if (map[cp]) return map[cp];
    // Strip anything else
    return " ";
  });
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
