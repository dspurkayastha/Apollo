/**
 * Shared utility to extract \cite{key} keys from LaTeX content.
 * Used by section save route, generate/refine routes, and auto-resolve.
 */

const CITE_REGEX = /\\cite\{([^}]+)\}/g;

/**
 * Extract all unique citation keys from LaTeX source.
 * Handles multi-key citations like \cite{a,b,c}.
 */
export function extractCiteKeys(latex: string): string[] {
  const keys = new Set<string>();
  let match: RegExpExecArray | null;
  // Reset lastIndex for safety (global regex)
  CITE_REGEX.lastIndex = 0;
  while ((match = CITE_REGEX.exec(latex)) !== null) {
    for (const key of match[1].split(",")) {
      const trimmed = key.trim();
      if (trimmed) keys.add(trimmed);
    }
  }
  return [...keys];
}
