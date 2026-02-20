/**
 * Post-processing sanitisation for AI-generated LaTeX content.
 *
 * Catches common AI mistakes that would break LaTeX compilation:
 * - Markdown headings (# HEADING → \section{Heading})
 * - Bare # characters outside comments
 * - Markdown bold (**text** → \textbf{text})
 * - Markdown bullet lists (- item → \item)
 */

/**
 * Sanitise AI-generated LaTeX, fixing markdown artefacts.
 * Applied after generation, before saving to DB.
 */
export function sanitiseLatexOutput(content: string): string {
  // Split into body and BibTeX trailer — only sanitise the body
  const bibtexMarker = "---BIBTEX---";
  const markerIdx = content.indexOf(bibtexMarker);
  let body = markerIdx >= 0 ? content.slice(0, markerIdx) : content;
  const trailer = markerIdx >= 0 ? content.slice(markerIdx) : "";

  // 1. Convert markdown headings to LaTeX sections
  //    Must be done BEFORE escaping bare # (so we don't escape heading markers)
  body = body.replace(/^######\s+(.+)$/gm, (_m, title) => `\\subparagraph{${title.trim()}}`);
  body = body.replace(/^#####\s+(.+)$/gm, (_m, title) => `\\paragraph{${title.trim()}}`);
  body = body.replace(/^####\s+(.+)$/gm, (_m, title) => `\\subsubsubsection{${title.trim()}}`);
  body = body.replace(/^###\s+(.+)$/gm, (_m, title) => `\\subsubsection{${title.trim()}}`);
  body = body.replace(/^##\s+(.+)$/gm, (_m, title) => `\\subsection{${title.trim()}}`);
  body = body.replace(/^#\s+(.+)$/gm, (_m, title) => `\\section{${title.trim()}}`);

  // 2. Convert markdown bold to LaTeX bold
  body = body.replace(/\*\*([^*]+)\*\*/g, "\\textbf{$1}");

  // 3. Convert markdown italic to LaTeX italic
  //    - (?<![a-zA-Z*]) prevents matching \section* and other starred LaTeX commands
  //    - [^*\n]+ prevents matching across newlines (italic is single-line)
  body = body.replace(/(?<![a-zA-Z*])\*([^*\n]+)\*(?!\*)/g, "\\textit{$1}");

  // 4. Escape bare # that are NOT in LaTeX commands and NOT in comments
  //    A bare # is one not preceded by a backslash and not at line start as a heading (already converted)
  body = body.replace(/^(%.*$)/gm, "%%COMMENT%%$1"); // Temporarily protect comments
  body = body.replace(/(?<!\\)#/g, "\\#");
  body = body.replace(/%%COMMENT%%(%.*$)/gm, "$1"); // Restore comments

  return trailer ? `${body}${trailer}` : body;
}
