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

export interface LatexErrorDetail {
  /** Cleaned error message, e.g. "Missing $ inserted" */
  message: string;
  /** Line number from `l.NNN` in the log (1-based) */
  line?: number;
  /** Source file from the log's file stack, e.g. "chapters/results.tex" */
  file?: string;
  /** Raw error line as it appeared in the log */
  rawMessage: string;
}

export interface ParsedLog {
  errors: string[];
  warnings: string[];
  errorCount: number;
  warningCount: number;
  /** Structured error details with line numbers and file references */
  structuredErrors: LatexErrorDetail[];
}

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

/**
 * Track the current file from the log's parenthesis-based file stack.
 *
 * pdfTeX logs open files as `(./path/to/file.tex` and close with `)`.
 * We track a stack of open files and return the top.
 */
function updateFileStack(line: string, fileStack: string[]): void {
  // Scan the line character by character for `(` and `)`
  let i = 0;
  while (i < line.length) {
    if (line[i] === "(") {
      // Look ahead for a file path after `(`
      const rest = line.slice(i + 1);
      const fileMatch = rest.match(/^(\.\/[^\s)]+|[^\s)]+\.(?:tex|cls|sty|bbl|aux|bib|fd|def|cfg|clo))/);
      if (fileMatch) {
        let filePath = fileMatch[1];
        // Normalise: strip leading ./
        if (filePath.startsWith("./")) {
          filePath = filePath.slice(2);
        }
        fileStack.push(filePath);
        i += 1 + fileMatch[0].length;
        continue;
      }
      // Opening paren without recognisable file — push placeholder
      fileStack.push("");
      i++;
      continue;
    }
    if (line[i] === ")") {
      if (fileStack.length > 0) {
        fileStack.pop();
      }
      i++;
      continue;
    }
    i++;
  }
}

/**
 * Get the current file from the file stack (top non-empty entry).
 */
function currentFile(fileStack: string[]): string | undefined {
  for (let i = fileStack.length - 1; i >= 0; i--) {
    if (fileStack[i]) return fileStack[i];
  }
  return undefined;
}

export function parseLatexLog(logContent: string): ParsedLog {
  const lines = logContent.split("\n");
  const errors: string[] = [];
  const warnings: string[] = [];
  const structuredErrors: LatexErrorDetail[] = [];
  const seenErrors = new Set<string>();
  const seenWarnings = new Set<string>();
  const fileStack: string[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();

    // Update file stack from parentheses in this line
    updateFileStack(line, fileStack);

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

      // Extract structured error detail
      const cleanMessage = normalised.replace(/^!\s*/, "").replace(/\.\s*$/, "");
      const file = currentFile(fileStack);

      // Scan next few lines for `l.NNN` line number
      let errorLine: number | undefined;
      const lookAhead = Math.min(idx + 5, lines.length);
      for (let j = idx + 1; j < lookAhead; j++) {
        const lMatch = lines[j].match(/^l\.(\d+)(?:\s|$)/);
        if (lMatch) {
          errorLine = parseInt(lMatch[1], 10);
          break;
        }
      }

      structuredErrors.push({
        message: cleanMessage,
        line: errorLine,
        file,
        rawMessage: normalised,
      });

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
    structuredErrors,
  };
}
