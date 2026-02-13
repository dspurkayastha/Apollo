/**
 * Parse a LaTeX compilation log to extract errors and warnings.
 */

export interface ParsedLog {
  errors: string[];
  warnings: string[];
  errorCount: number;
  warningCount: number;
}

const BLOCKING_ERROR_PATTERNS = [
  /^! (.+)$/,
  /Fatal error/,
  /Emergency stop/,
  /Undefined control sequence/,
  /Missing \$ inserted/,
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

export function parseLatexLog(logContent: string): ParsedLog {
  const lines = logContent.split("\n");
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenErrors = new Set<string>();
  const seenWarnings = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for blocking errors
    for (const pattern of BLOCKING_ERROR_PATTERNS) {
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
