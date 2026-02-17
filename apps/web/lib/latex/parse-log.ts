/**
 * Parse a LaTeX compilation log to extract errors and warnings.
 *
 * Errors are split into two tiers:
 * - **Blocking**: Syntax errors that prevent meaningful output (misplaced chars,
 *   undefined commands in critical positions, emergency stops).
 * - **Non-blocking**: Issues that pdflatex survives with `-interaction=nonstopmode`
 *   (missing fonts, missing figure files, package conflicts). These are demoted
 *   to warnings so a usable PDF can still be served.
 */

export interface ParsedLog {
  errors: string[];
  warnings: string[];
  errorCount: number;
  warningCount: number;
}

/**
 * Patterns for `! ...` lines that are truly fatal — no usable PDF.
 */
const FATAL_ERROR_PATTERNS = [
  /Fatal error/,
  /Emergency stop/,
  /Misplaced alignment tab/,
  /Missing \$ inserted/,
  /Too many \}'s/,
  /Extra alignment tab/,
  /Incomplete \\if/,
  /\\ can be used only in paragraph mode/,
];

/**
 * Patterns for `! ...` lines that pdflatex survives — demote to warnings.
 * The PDF is still produced (possibly with visual artefacts).
 */
const NON_FATAL_ERROR_PATTERNS = [
  /Font .+ not loadable/,
  /Font .+ not found/,
  /Package pdftex\.def Error: File/,
  /Package .+ Error: File .+ not found/,
  /Metric \(TFM\) file not/,
  /I couldn't open file name/,
];

const BLOCKING_ERROR_PATTERNS = [
  /^! (.+)$/,
  /Fatal error/,
  /Emergency stop/,
  /Undefined control sequence/,
  /File .+ not found/,
];

const WARNING_PATTERNS = [
  /Overfull \\[hv]box/,
  /Underfull \\[hv]box/,
  /Font .+ does not contain/,
  /Font shape .+ undefined/,
  /LaTeX Warning: (.+)/,
  /Package .+ Warning: (.+)/,
];

function isNonFatalError(line: string): boolean {
  return NON_FATAL_ERROR_PATTERNS.some((p) => p.test(line));
}

function isFatalError(line: string): boolean {
  return FATAL_ERROR_PATTERNS.some((p) => p.test(line));
}

export function parseLatexLog(logContent: string): ParsedLog {
  const lines = logContent.split("\n");
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenErrors = new Set<string>();
  const seenWarnings = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if this is a `! ...` error line
    if (/^! /.test(trimmed)) {
      const normalised = trimmed.slice(0, 200);

      // Non-fatal errors → demote to warnings
      if (isNonFatalError(normalised)) {
        if (!seenWarnings.has(normalised)) {
          seenWarnings.add(normalised);
          warnings.push(normalised);
        }
        continue;
      }

      // Fatal or unknown `! ` errors → blocking
      if (!seenErrors.has(normalised)) {
        seenErrors.add(normalised);
        errors.push(normalised);
      }
      continue;
    }

    // Other blocking patterns (not starting with `! `)
    for (const pattern of BLOCKING_ERROR_PATTERNS) {
      if (pattern === BLOCKING_ERROR_PATTERNS[0]) continue; // skip ^! — handled above
      if (pattern.test(trimmed)) {
        const normalised = trimmed.slice(0, 200);
        if (!seenErrors.has(normalised)) {
          seenErrors.add(normalised);
          errors.push(normalised);
        }
        break;
      }
    }

    // Check for warnings
    for (const pattern of WARNING_PATTERNS) {
      if (pattern.test(trimmed)) {
        const normalised = trimmed.slice(0, 200);
        if (!seenWarnings.has(normalised)) {
          seenWarnings.add(normalised);
          warnings.push(normalised);
        }
        break;
      }
    }
  }

  return {
    errors,
    warnings,
    errorCount: errors.length,
    warningCount: warnings.length,
  };
}
