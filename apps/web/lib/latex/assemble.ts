import { generateTex } from "./generate-tex";
import { tiptapToLatex, type TiptapNode } from "./tiptap-to-latex";
import { latexToTiptap } from "./latex-to-tiptap";
import { normaliseUnicode } from "./escape";
import type { Project, Section, Citation } from "@/lib/types/database";

// ── Phase → chapter file mapping ────────────────────────────────────────────

const PHASE_CHAPTER_MAP: Record<number, string> = {
  2: "chapters/introduction.tex",
  3: "chapters/aims.tex",
  4: "chapters/literature.tex",
  5: "chapters/methodology.tex",
  6: "chapters/results.tex",
  7: "chapters/discussion.tex",
  8: "chapters/conclusion.tex",
  10: "chapters/appendices.tex",
};

// ── BibTeX splitter ─────────────────────────────────────────────────────────

const BIBTEX_SEPARATOR = "---BIBTEX---";

export interface SplitResult {
  body: string;
  bib: string;
}

/**
 * Split section latex_content at the `---BIBTEX---` marker.
 * Returns the body (before marker) and bib entries (after marker).
 */
export function splitBibtex(latexContent: string): SplitResult {
  const idx = latexContent.indexOf(BIBTEX_SEPARATOR);
  if (idx === -1) {
    return { body: latexContent.trim(), bib: "" };
  }
  return {
    body: latexContent.slice(0, idx).trim(),
    bib: latexContent.slice(idx + BIBTEX_SEPARATOR.length).trim(),
  };
}

// ── BibTeX deduplication ────────────────────────────────────────────────────

/**
 * Parse `@type{key,` entries from BibTeX content, deduplicate by cite key
 * (last-write-wins so citations table entries override AI-generated ones).
 */
export function deduplicateBibEntries(bibContent: string): string {
  if (!bibContent.trim()) return "";

  const entries: { key: string; entry: string }[] = [];
  const lines = bibContent.split("\n");
  let currentEntry = "";
  let currentKey = "";

  for (const line of lines) {
    const entryStart = line.match(/^@(\w+)\{([^,]+),/);
    if (entryStart) {
      if (currentEntry && currentKey) {
        entries.push({ key: currentKey, entry: currentEntry.trim() });
      }
      currentKey = entryStart[2].trim();
      currentEntry = line + "\n";
    } else if (currentKey) {
      currentEntry += line + "\n";
    }
  }

  if (currentEntry && currentKey) {
    entries.push({ key: currentKey, entry: currentEntry.trim() });
  }

  const seen = new Map<string, string>();
  for (const { key, entry } of entries) {
    seen.set(key, entry);
  }

  return Array.from(seen.values()).join("\n\n");
}

// ── Tier D citation stripping ────────────────────────────────────────────────

/**
 * Replace \cite{key} commands for Tier D citations with a LaTeX comment.
 * Per PLAN.md §358-362: Tier D citations must NEVER appear as \cite{key}
 * in compiled output — they are replaced with:
 *   % UNRESOLVED: key — provide source or remove
 */
export function stripTierDCitations(
  chapterBody: string,
  tierDKeys: Set<string>
): { stripped: string; replacedKeys: string[] } {
  if (tierDKeys.size === 0) return { stripped: chapterBody, replacedKeys: [] };

  const replacedKeys: string[] = [];

  // Match \cite{key} and \cite{key1,key2,...} patterns
  const stripped = chapterBody.replace(
    /\\cite\{([^}]+)\}/g,
    (_match, keysStr: string) => {
      const keys = keysStr.split(",").map((k) => k.trim());
      const kept = keys.filter((k) => !tierDKeys.has(k));
      const removed = keys.filter((k) => tierDKeys.has(k));

      for (const k of removed) {
        if (!replacedKeys.includes(k)) replacedKeys.push(k);
      }

      if (kept.length === 0 && removed.length > 0) {
        // All keys are Tier D — replace entire \cite{} with comment
        return removed
          .map((k) => `% UNRESOLVED: ${k} --- provide source or remove`)
          .join("\n");
      }

      if (removed.length > 0) {
        // Mixed — keep valid keys, comment out Tier D ones
        const comments = removed
          .map((k) => `% UNRESOLVED: ${k} --- provide source or remove`)
          .join("\n");
        return `\\cite{${kept.join(", ")}}\n${comments}`;
      }

      // No Tier D keys in this cite command
      return _match;
    }
  );

  return { stripped, replacedKeys };
}

// ── Chapter body sanitisation ────────────────────────────────────────────────

/**
 * Sanitise a chapter body after the tiptap round-trip:
 * 1. Strip bare markdown separators (--- / *** / ___)
 * 2. Repair unbalanced \begin{}/\end{} environments
 * 3. Repair unbalanced braces
 */
function sanitiseChapterLatex(latex: string): string {
  // 1. Strip markdown separators (lines that are just --- or *** or ___)
  let result = latex.replace(/^\s*[-*_]{3,}\s*$/gm, "");

  // 2. Repair environment balance
  const beginRe = /\\begin\{(\w+)\}/g;
  const endRe = /\\end\{(\w+)\}/g;
  const envStack: string[] = [];
  const tokens: { type: "begin" | "end"; name: string; pos: number }[] = [];

  for (const m of result.matchAll(beginRe)) {
    tokens.push({ type: "begin", name: m[1], pos: m.index! });
  }
  for (const m of result.matchAll(endRe)) {
    tokens.push({ type: "end", name: m[1], pos: m.index! });
  }
  tokens.sort((a, b) => a.pos - b.pos);

  // Track unmatched \end{} positions to remove
  const unmatchedEndPositions: { pos: number; len: number }[] = [];

  for (const token of tokens) {
    if (token.type === "begin") {
      envStack.push(token.name);
    } else {
      if (envStack.length > 0 && envStack[envStack.length - 1] === token.name) {
        envStack.pop();
      } else {
        // Unmatched \end{} — mark for removal
        const fullMatch = `\\end{${token.name}}`;
        unmatchedEndPositions.push({ pos: token.pos, len: fullMatch.length });
      }
    }
  }

  // Remove unmatched \end{} from end to start (so positions stay valid)
  for (let i = unmatchedEndPositions.length - 1; i >= 0; i--) {
    const { pos, len } = unmatchedEndPositions[i];
    result = result.slice(0, pos) + result.slice(pos + len);
  }

  // Close any remaining unclosed environments in LIFO order
  if (envStack.length > 0) {
    const closings = envStack.reverse().map((env) => `\\end{${env}}`).join("\n");
    result = result.trimEnd() + "\n" + closings + "\n";
  }

  // 3. Repair unbalanced braces
  let braceDepth = 0;
  let inComment = false;
  for (let i = 0; i < result.length; i++) {
    const ch = result[i];
    if (ch === "%" && (i === 0 || result[i - 1] !== "\\")) {
      inComment = true;
      continue;
    }
    if (ch === "\n") {
      inComment = false;
      continue;
    }
    if (inComment) continue;
    if (ch === "{" && (i === 0 || result[i - 1] !== "\\")) braceDepth++;
    else if (ch === "}" && (i === 0 || result[i - 1] !== "\\")) braceDepth--;
  }

  if (braceDepth > 0) {
    // More { than } — append closing braces
    result = result.trimEnd() + "}".repeat(braceDepth) + "\n";
  } else if (braceDepth < 0) {
    // More } than { — prepend opening braces
    result = "{".repeat(Math.abs(braceDepth)) + result;
  }

  return result;
}

// ── Bare ampersand sanitisation ──────────────────────────────────────────────

/**
 * Escape bare `&` characters outside of tabular environments.
 *
 * In LaTeX, `&` is a column separator inside tabular/longtable/array — valid there.
 * Everywhere else it causes "Misplaced alignment tab character &".
 *
 * The tiptap round-trip escapes `&` in text nodes via `escapeLatex()`, but
 * content inside `codeBlock` nodes (non-tabular environments like `\begin{center}`)
 * passes through raw. AI may output bare `&` inside such environments.
 */
function escapeBareAmpersands(latex: string): string {
  const lines = latex.split("\n");
  let tabularDepth = 0;

  return lines
    .map((line) => {
      const opens = (
        line.match(/\\begin\{(tabular|longtable|tabularx|array)\}/g) || []
      ).length;
      const closes = (
        line.match(/\\end\{(tabular|longtable|tabularx|array)\}/g) || []
      ).length;

      // Inside a tabular env — & is a column separator, leave it
      if (tabularDepth > 0 || opens > 0) {
        tabularDepth += opens - closes;
        tabularDepth = Math.max(0, tabularDepth);
        return line;
      }

      tabularDepth += opens - closes;
      tabularDepth = Math.max(0, tabularDepth);

      // Skip comment lines
      if (line.trimStart().startsWith("%")) return line;

      // Escape bare & (not preceded by \)
      return line.replace(/(?<!\\)&/g, "\\&");
    })
    .join("\n");
}

// ── DOI underscore escaping ──────────────────────────────────────────────────

/**
 * Escape bare `_` in DOI field values.
 * BibTeX passes DOI strings through to the .bbl file unchanged.
 * Bare `_` in DOIs like `10.4103/jgid.jgid_132_18` causes
 * "Missing $ inserted" errors in pdfLaTeX.
 */
function escapeDOIUnderscores(bibContent: string): string {
  // Match doi = {value} and doi = "value" patterns
  return bibContent.replace(
    /^(\s*doi\s*=\s*\{)([^}]+)(\})/gm,
    (_match, prefix: string, value: string, suffix: string) => {
      // Escape bare _ (not already escaped as \_)
      const escaped = value.replace(/(?<!\\)_/g, "\\_");
      return prefix + escaped + suffix;
    }
  );
}

// ── Front matter injection ──────────────────────────────────────────────────

/**
 * Extract Phase 1 content and inject acknowledgements + abstract into the
 * template's \begin{acknowledgements}...\end{acknowledgements} and
 * \begin{thesis_abstract}...\end{thesis_abstract} environments.
 */
function injectFrontMatter(
  tex: string,
  sections: Section[],
  warnings: string[]
): string {
  const phase1 = sections
    .filter((s) => s.phase_number === 1)
    .sort((a, b) => {
      const priority: Record<string, number> = { approved: 0, review: 1 };
      return (priority[a.status] ?? 2) - (priority[b.status] ?? 2);
    })[0];

  if (!phase1) return tex;

  // Get content via same pipeline as chapters
  let content = "";
  if (phase1.rich_content_json) {
    const r = tiptapToLatex(phase1.rich_content_json as unknown as TiptapNode);
    content = r.latex;
  } else if (phase1.latex_content) {
    const { body } = splitBibtex(phase1.latex_content);
    const tiptapJson = latexToTiptap(body);
    const r = tiptapToLatex(tiptapJson.json);
    content = r.latex;
  }

  if (!content.trim()) return tex;

  // Split at ABSTRACT heading — try \section{ABSTRACT} first, then markdown
  let ackText = content;
  let abstractText = "";

  const abstractPatterns = [
    /\\section\*?\{[^}]*ABSTRACT[^}]*\}/i,
    /\\section\*?\{[^}]*Abstract[^}]*\}/,
  ];

  for (const pattern of abstractPatterns) {
    const match = content.match(pattern);
    if (match?.index !== undefined) {
      ackText = content.slice(0, match.index).trim();
      abstractText = content.slice(match.index + match[0].length).trim();
      break;
    }
  }

  // Clean acknowledgements — remove heading, keep body paragraphs
  ackText = ackText
    .replace(/\\section\*?\{[^}]*ACKNOWLEDGEMENTS[^}]*\}/i, "")
    .replace(/\\section\*?\{[^}]*Acknowledgements[^}]*\}/i, "")
    .trim();

  // Inject acknowledgements (sanitise bare & in case AI missed escaping)
  if (ackText) {
    const safeAck = escapeBareAmpersands(ackText);
    tex = tex.replace(
      /\\begin\{acknowledgements\}[\s\S]*?\\end\{acknowledgements\}/,
      `\\begin{acknowledgements}\n\n${safeAck}\n\n\\end{acknowledgements}`
    );
  }

  // Format abstract: convert \subsection{Label} → \noindent\textbf{Label:}
  if (abstractText) {
    const formatted = abstractText
      .replace(
        /\\subsection\*?\{([^}]+)\}/g,
        (_m, label: string) =>
          `\\vspace{0.3cm}\n\\noindent\\textbf{${label.trim()}:}`
      )
      // Remove leading \vspace before first label
      .replace(/^\s*\\vspace\{0\.3cm\}\s*\n/, "");

    const safeAbstract = escapeBareAmpersands(formatted);
    tex = tex.replace(
      /\\begin\{thesis_abstract\}[\s\S]*?\\end\{thesis_abstract\}/,
      `\\begin{thesis_abstract}\n\n${safeAbstract}\n\n\\end{thesis_abstract}`
    );
  } else {
    warnings.push("Phase 1: could not split abstract from acknowledgements");
  }

  return tex;
}

// ── Main assembly function ──────────────────────────────────────────────────

export interface AssembleResult {
  tex: string;
  bib: string;
  chapterFiles: Record<string, string>;
  warnings: string[];
}

/**
 * Assemble the thesis .tex, .bib, and chapter files from template,
 * project metadata, approved/review sections, and citations.
 *
 * 1. Populate metadata via `generateTex()`
 * 2. For each phase 2–8: find the section, produce chapter body + extract BibTeX
 * 3. Chapter body source: `tiptapToLatex(rich_content_json)` if available,
 *    else `splitBibtex(latex_content).body` as fallback
 * 4. BibTeX source: `ai_generated_latex` (preserves ---BIBTEX--- trailer after user edits),
 *    else fallback to `latex_content`
 * 5. Each chapter body → `chapterFiles["chapters/xxx.tex"]`
 * 6. Missing chapters → empty file (LaTeX `\input{}` of empty file is fine)
 * 7. Collect BibTeX from all sections + citations table, deduplicate
 */
export function assembleThesisContent(
  template: string,
  project: Project,
  sections: Section[],
  citations: Citation[]
): AssembleResult {
  const warnings: string[] = [];

  // Step 1: Populate metadata
  const { tex: metadataTex, warnings: metaWarnings } = generateTex(template, project);
  warnings.push(...metaWarnings);

  // Step 1b: Inject Phase 1 front matter (acknowledgements + abstract)
  const tex = injectFrontMatter(metadataTex, sections, warnings);
  const bibParts: string[] = [];
  const chapterFiles: Record<string, string> = {};

  // Build set of Tier D cite keys (to strip from compiled output)
  const tierDKeys = new Set<string>(
    citations
      .filter((c) => c.provenance_tier === "D")
      .map((c) => c.cite_key)
  );

  // Step 2: For each chapter phase, produce chapter file content
  for (const [phaseStr, chapterPath] of Object.entries(PHASE_CHAPTER_MAP)) {
    const phaseNum = parseInt(phaseStr, 10);

    // Find the best section: prefer approved, then review
    const section = sections
      .filter((s) => s.phase_number === phaseNum)
      .sort((a, b) => {
        const priority: Record<string, number> = { approved: 0, review: 1 };
        return (priority[a.status] ?? 2) - (priority[b.status] ?? 2);
      })[0];

    if (!section) {
      warnings.push(`Phase ${phaseNum}: no approved/review content — chapter will be empty`);
      chapterFiles[chapterPath] = "";
      continue;
    }

    // Chapter body: prefer tiptap round-trip (sanitised, escaped)
    let chapterBody = "";

    if (section.rich_content_json) {
      const tiptapResult = tiptapToLatex(section.rich_content_json as unknown as TiptapNode);
      chapterBody = tiptapResult.latex;
      if (tiptapResult.warnings.length > 0) {
        warnings.push(
          `Phase ${phaseNum} tiptap warnings: ${tiptapResult.warnings.join(", ")}`
        );
      }
    } else if (section.latex_content) {
      // Fallback: sanitise raw latex_content via tiptap round-trip.
      // This strips markdown artifacts (# headings), \needspace, comments,
      // and escapes LaTeX special characters like bare #.
      const { body } = splitBibtex(section.latex_content);
      const tiptapJson = latexToTiptap(body);
      const roundTripped = tiptapToLatex(tiptapJson.json);
      chapterBody = roundTripped.latex;
      if (roundTripped.warnings.length > 0) {
        warnings.push(
          `Phase ${phaseNum} fallback round-trip warnings: ${roundTripped.warnings.join(", ")}`
        );
      }
    }

    if (!chapterBody) {
      warnings.push(`Phase ${phaseNum}: section exists but body is empty`);
    }

    // Strip Tier D \cite{key} → replace with % UNRESOLVED comment
    if (chapterBody && tierDKeys.size > 0) {
      const { stripped, replacedKeys } = stripTierDCitations(chapterBody, tierDKeys);
      chapterBody = stripped;
      if (replacedKeys.length > 0) {
        warnings.push(
          `Phase ${phaseNum}: stripped Tier D citations: ${replacedKeys.join(", ")}`
        );
      }
    }

    // Sanitise bare & outside tabular environments (AI may output unescaped &)
    if (chapterBody) {
      chapterBody = escapeBareAmpersands(chapterBody);
    }

    // Sanitise: strip markdown separators, repair environment/brace balance
    if (chapterBody) {
      chapterBody = sanitiseChapterLatex(chapterBody);
    }

    chapterFiles[chapterPath] = chapterBody;

    // BibTeX: prefer ai_generated_latex (preserves ---BIBTEX--- even after user edits)
    const bibSource = section.ai_generated_latex ?? section.latex_content;
    if (bibSource) {
      const { bib } = splitBibtex(bibSource);
      if (bib) {
        bibParts.push(bib);
      }
    }
  }

  // Step 3: Collect BibTeX from citations table (exclude Tier D — they have no \cite{})
  for (const citation of citations) {
    if (citation.bibtex_entry?.trim() && citation.provenance_tier !== "D") {
      bibParts.push(citation.bibtex_entry.trim());
    }
  }

  // Step 4: Deduplicate and sanitise BibTeX
  const rawBib = bibParts.join("\n\n");
  const dedupedBib = deduplicateBibEntries(rawBib);
  // Normalise Unicode (smart quotes, em-dashes) in BibTeX field values —
  // external APIs (CrossRef, PubMed) and AI often return these characters
  // which cause "Invalid UTF-8 byte sequence" during compilation.
  const normalisedBib = normaliseUnicode(dedupedBib);
  // Escape bare & in BibTeX field values — AI often generates journal names
  // like "Endocrinology & Metabolism" instead of "Endocrinology \& Metabolism".
  const ampEscapedBib = escapeBareAmpersands(normalisedBib);
  // Escape bare _ in doi fields — BibTeX passes DOI values through to .bbl
  // as-is, and bare _ causes "Missing $ inserted" in pdflatex.
  const bib = escapeDOIUnderscores(ampEscapedBib);

  return { tex, bib, chapterFiles, warnings };
}
