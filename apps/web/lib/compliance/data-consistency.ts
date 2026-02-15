/**
 * Data consistency checker — cross-references numbers in Results text
 * with analysis results_json to detect mismatches.
 */

export interface ConsistencyIssue {
  type: "mismatch" | "missing" | "extra";
  description: string;
  context?: string;
}

/**
 * Extract numeric values from a text (p-values, percentages, counts, etc.)
 */
function extractNumbers(text: string): { value: string; context: string }[] {
  const results: { value: string; context: string }[] = [];
  const patterns = [
    /p\s*[=<>]\s*([\d.]+)/gi,           // p-values
    /(\d+\.?\d*)\s*%/g,                  // percentages
    /(\d+\.?\d*)\s*\(/g,                 // numbers before parentheses (counts)
    /CI\s*[:=]?\s*[\[(]?([\d.]+)\s*[-–]\s*([\d.]+)/gi, // confidence intervals
    /OR\s*[:=]?\s*([\d.]+)/gi,           // odds ratios
    /RR\s*[:=]?\s*([\d.]+)/gi,           // relative risks
    /(?:mean|median|average)\s*[:=]?\s*([\d.]+)/gi, // means/medians
    /n\s*=\s*(\d+)/gi,                   // sample sizes
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + match[0].length + 30);
      results.push({
        value: match[1] ?? match[0],
        context: text.slice(start, end).trim(),
      });
    }
  }

  return results;
}

/**
 * Flatten analysis results into a set of expected numeric values.
 */
function extractExpectedValues(
  resultsJson: Record<string, unknown>
): Set<string> {
  const values = new Set<string>();

  function walk(obj: unknown): void {
    if (typeof obj === "number") {
      // Store both the full precision and rounded versions
      values.add(String(obj));
      values.add(obj.toFixed(2));
      values.add(obj.toFixed(3));
      if (obj < 1 && obj > 0) {
        values.add(obj.toFixed(4)); // p-values
      }
    } else if (typeof obj === "string") {
      // Extract numbers from strings
      const nums = obj.match(/\d+\.?\d*/g);
      if (nums) nums.forEach((n) => values.add(n));
    } else if (Array.isArray(obj)) {
      obj.forEach(walk);
    } else if (obj && typeof obj === "object") {
      Object.values(obj).forEach(walk);
    }
  }

  walk(resultsJson);
  return values;
}

/**
 * Check if numbers in the Results section text match the analysis outputs.
 */
export function checkDataConsistency(
  resultsLatex: string,
  analysisResults: Record<string, unknown>[]
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  // Build set of expected values from all analyses
  const expectedValues = new Set<string>();
  for (const result of analysisResults) {
    const values = extractExpectedValues(result);
    values.forEach((v) => expectedValues.add(v));
  }

  if (expectedValues.size === 0) {
    issues.push({
      type: "missing",
      description: "No analysis results available for cross-referencing",
    });
    return issues;
  }

  // Extract numbers from the Results text
  const textNumbers = extractNumbers(resultsLatex);

  // Check for numbers in text that don't appear in analysis results
  // (only flag significant numbers — skip very common ones like 0, 1, 2, etc.)
  for (const { value, context } of textNumbers) {
    const num = parseFloat(value);
    if (isNaN(num)) continue;
    // Skip trivially common numbers
    if (num === 0 || num === 1 || num === 100 || num === 0.05 || num === 0.95) continue;

    if (!expectedValues.has(value) && !expectedValues.has(num.toFixed(2))) {
      issues.push({
        type: "mismatch",
        description: `Value "${value}" in Results text not found in analysis outputs — verify accuracy`,
        context,
      });
    }
  }

  return issues;
}
