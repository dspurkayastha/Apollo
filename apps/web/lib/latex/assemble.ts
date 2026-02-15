import { generateTex } from "./generate-tex";
import { tiptapToLatex, type TiptapNode } from "./tiptap-to-latex";
import { latexToTiptap } from "./latex-to-tiptap";
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
          .map((k) => `% UNRESOLVED: ${k} — provide source or remove`)
          .join("\n");
      }

      if (removed.length > 0) {
        // Mixed — keep valid keys, comment out Tier D ones
        const comments = removed
          .map((k) => `% UNRESOLVED: ${k} — provide source or remove`)
          .join("\n");
        return `\\cite{${kept.join(", ")}}\n${comments}`;
      }

      // No Tier D keys in this cite command
      return _match;
    }
  );

  return { stripped, replacedKeys };
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

  const tex = metadataTex;
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

  // Step 4: Deduplicate
  const rawBib = bibParts.join("\n\n");
  const bib = deduplicateBibEntries(rawBib);

  return { tex, bib, chapterFiles, warnings };
}
