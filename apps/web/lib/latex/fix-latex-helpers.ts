/**
 * Helpers for targeted line-number-based LaTeX fixing.
 *
 * Instead of sending entire chapter content (~2000-5000 lines) to AI,
 * we extract only the lines around each error and fix those surgically.
 */

import type { LatexErrorDetail } from "./parse-log";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ErrorContext {
  /** The error this context belongs to */
  error: LatexErrorDetail;
  /** First line number in the window (1-based) */
  startLine: number;
  /** Last line number in the window (1-based, inclusive) */
  endLine: number;
  /** Lines with their original line numbers: [lineNumber, content][] */
  lines: [number, string][];
}

export interface LineFix {
  /** 1-based line number */
  lineNumber: number;
  /** The fixed content for that line */
  content: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Number of lines to include above and below each error line */
const CONTEXT_RADIUS = 5;

// ── extractErrorContexts ────────────────────────────────────────────────────

/**
 * For each error with a line number, extract ±CONTEXT_RADIUS lines from the
 * content. Merges overlapping windows so the AI sees a coherent block.
 */
export function extractErrorContexts(
  content: string,
  errors: LatexErrorDetail[]
): ErrorContext[] {
  const contentLines = content.split("\n");
  const totalLines = contentLines.length;

  // Filter to errors that have line numbers within range
  const located = errors.filter(
    (e) => e.line !== undefined && e.line >= 1 && e.line <= totalLines
  );

  if (located.length === 0) return [];

  // Build raw windows
  const windows: { error: LatexErrorDetail; start: number; end: number }[] = [];
  for (const error of located) {
    const line = error.line!;
    const start = Math.max(1, line - CONTEXT_RADIUS);
    const end = Math.min(totalLines, line + CONTEXT_RADIUS);
    windows.push({ error, start, end });
  }

  // Sort by start line
  windows.sort((a, b) => a.start - b.start);

  // Merge overlapping windows
  const merged: { errors: LatexErrorDetail[]; start: number; end: number }[] = [];
  for (const w of windows) {
    const last = merged[merged.length - 1];
    if (last && w.start <= last.end + 1) {
      // Overlapping or adjacent — merge
      last.end = Math.max(last.end, w.end);
      last.errors.push(w.error);
    } else {
      merged.push({ errors: [w.error], start: w.start, end: w.end });
    }
  }

  // Build ErrorContext for each merged window
  return merged.map((m) => {
    const lines: [number, string][] = [];
    for (let i = m.start; i <= m.end; i++) {
      lines.push([i, contentLines[i - 1]]); // contentLines is 0-indexed
    }
    return {
      error: m.errors[0], // Primary error for this window
      startLine: m.start,
      endLine: m.end,
      lines,
    };
  });
}

// ── buildTargetedUserMessage ────────────────────────────────────────────────

/**
 * Build a focused AI prompt showing only the error snippets with line numbers.
 */
export function buildTargetedUserMessage(
  contexts: ErrorContext[],
  errors: LatexErrorDetail[]
): string {
  const parts: string[] = [];

  // List all errors upfront
  parts.push("ERRORS TO FIX:");
  for (const err of errors) {
    const loc = err.line ? ` (line ${err.line})` : "";
    parts.push(`- ${err.rawMessage}${loc}`);
  }
  parts.push("");

  // Show each context window
  for (const ctx of contexts) {
    // Find which errors fall in this window
    const windowErrors = errors.filter(
      (e) => e.line !== undefined && e.line >= ctx.startLine && e.line <= ctx.endLine
    );
    const errorDesc = windowErrors
      .map((e) => `${e.rawMessage} (line ${e.line})`)
      .join("; ");

    parts.push(`=== Context for: ${errorDesc} ===`);
    for (const [num, content] of ctx.lines) {
      const marker = windowErrors.some((e) => e.line === num) ? ">>>" : "   ";
      parts.push(`${marker} ${num}| ${content}`);
    }
    parts.push("");
  }

  return parts.join("\n");
}

// ── parseFixResponse ────────────────────────────────────────────────────────

/**
 * Parse AI response lines matching `NN| fixed content`.
 * Returns null if the response doesn't follow the expected format.
 */
export function parseFixResponse(response: string): LineFix[] | null {
  const trimmed = response.trim();

  // Check for explicit "no changes needed" signal
  if (trimmed === "NO_CHANGES_NEEDED") {
    return [];
  }

  const fixes: LineFix[] = [];
  const responseLines = trimmed.split("\n");

  for (const line of responseLines) {
    // Match: optional whitespace, digits, pipe, then content
    const match = line.match(/^\s*(\d+)\|\s?(.*)$/);
    if (match) {
      fixes.push({
        lineNumber: parseInt(match[1], 10),
        content: match[2],
      });
    }
    // Skip lines that don't match the format (AI commentary, blank lines)
  }

  // If we found no parseable fix lines at all, return null (trigger fallback)
  if (fixes.length === 0 && responseLines.length > 0 && trimmed.length > 0) {
    return null;
  }

  return fixes;
}

// ── applyLineFixes ──────────────────────────────────────────────────────────

/**
 * Replace specific lines by number in the original content.
 * Line numbers are 1-based.
 */
export function applyLineFixes(original: string, fixes: LineFix[]): string {
  if (fixes.length === 0) return original;

  const lines = original.split("\n");

  // Build a map for O(1) lookup
  const fixMap = new Map<number, string>();
  for (const fix of fixes) {
    fixMap.set(fix.lineNumber, fix.content);
  }

  // Apply fixes
  for (const [lineNum, content] of fixMap) {
    const idx = lineNum - 1; // Convert to 0-based
    if (idx >= 0 && idx < lines.length) {
      lines[idx] = content;
    }
  }

  return lines.join("\n");
}
