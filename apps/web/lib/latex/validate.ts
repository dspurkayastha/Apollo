/**
 * LaTeX validation for chapter content before compilation.
 *
 * Two tiers:
 * 1. Pre-flight (local, deterministic, fast) — blocks on errors
 * 2. AI validation via Haiku (deeper checks) — non-blocking warnings
 */

import { getAnthropicClient } from "@/lib/ai/client";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ValidationIssue {
  chapter: string;
  severity: "error" | "warning";
  message: string;
  line?: number;
}

// ── Pre-flight checks (local, deterministic) ────────────────────────────────

/**
 * Run fast, deterministic checks on a chapter's LaTeX content.
 * Returns issues found — "error" severity blocks compilation.
 */
export function preflightChapter(
  chapterName: string,
  latex: string
): ValidationIssue[] {
  if (!latex.trim()) return [];

  const issues: ValidationIssue[] = [];
  const lines = latex.split("\n");
  let inTabularEnv = 0; // depth counter for tabular/longtable/array

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Track tabular environment depth (& is valid inside these)
    const tabOpens = (line.match(/\\begin\{(tabular|longtable|tabularx|array)\}/g) || []).length;
    const tabCloses = (line.match(/\\end\{(tabular|longtable|tabularx|array)\}/g) || []).length;
    inTabularEnv += tabOpens - tabCloses;
    inTabularEnv = Math.max(0, inTabularEnv);

    // Unescaped # not preceded by odd backslashes
    // Uses countPrecedingBackslashes (hoisted function declaration) to handle \\# correctly
    if (!line.trimStart().startsWith("%")) {
      for (let c = 0; c < line.length; c++) {
        if (line[c] === "#" && countPrecedingBackslashes(line, c) % 2 === 0) {
          issues.push({
            chapter: chapterName,
            severity: "error",
            message: `Unescaped '#' character — use '\\#' in LaTeX`,
            line: lineNum,
          });
        }
      }
    }

    // Bare & outside tabular environments (causes "Misplaced alignment tab character &")
    if (!line.trimStart().startsWith("%") && !inTabularEnv) {
      for (let c = 0; c < line.length; c++) {
        if (line[c] === "&" && countPrecedingBackslashes(line, c) % 2 === 0) {
          issues.push({
            chapter: chapterName,
            severity: "warning",
            message: `Bare '&' character --- should be '\\&' outside tabular environments`,
            line: lineNum,
          });
        }
      }
    }

    // Markdown heading artifacts: lines starting with # (markdown heading)
    if (/^#{1,6}\s+/.test(line.trimStart())) {
      issues.push({
        chapter: chapterName,
        severity: "error",
        message: `Markdown heading detected ('${line.trim().slice(0, 40)}') — not valid LaTeX`,
        line: lineNum,
      });
    }

    // Markdown horizontal rules: lines that are just --- or *** or ___
    if (/^\s*[-*_]{3,}\s*$/.test(line) && !line.includes("BIBTEX")) {
      issues.push({
        chapter: chapterName,
        severity: "warning",
        message: `Possible markdown separator '${line.trim()}'`,
        line: lineNum,
      });
    }

    // Bare URLs (should be \url{} or \href{})
    if (/(?<!\\url\{)(?<!\\href\{)https?:\/\/\S+/.test(line) && !line.trimStart().startsWith("%")) {
      issues.push({
        chapter: chapterName,
        severity: "warning",
        message: `Bare URL detected — wrap in \\url{} or \\href{}`,
        line: lineNum,
      });
    }
  }

  // Unbalanced braces
  // Helper: count consecutive backslashes preceding position `pos`.
  // A character is escaped only if preceded by an ODD number of backslashes
  // (e.g. `\{` is escaped, but `\\{` is not --- the backslash is itself escaped).
  function countPrecedingBackslashes(str: string, pos: number): number {
    let count = 0;
    for (let j = pos - 1; j >= 0 && str[j] === "\\"; j--) count++;
    return count;
  }

  let braceDepth = 0;
  let inComment = false;
  for (let i = 0; i < latex.length; i++) {
    const ch = latex[i];
    if (ch === "%" && countPrecedingBackslashes(latex, i) % 2 === 0) {
      inComment = true;
      continue;
    }
    if (ch === "\n") {
      inComment = false;
      continue;
    }
    if (inComment) continue;

    if (ch === "{" && countPrecedingBackslashes(latex, i) % 2 === 0) {
      braceDepth++;
    } else if (ch === "}" && countPrecedingBackslashes(latex, i) % 2 === 0) {
      braceDepth--;
    }
  }

  if (braceDepth !== 0) {
    issues.push({
      chapter: chapterName,
      severity: "error",
      message: `Unbalanced braces: ${braceDepth > 0 ? `${braceDepth} unclosed '{'` : `${Math.abs(braceDepth)} extra '}'`}`,
    });
  }

  // Unbalanced \begin{}/\end{} environments
  const beginMatches = [...latex.matchAll(/\\begin\{(\w+)\}/g)];
  const endMatches = [...latex.matchAll(/\\end\{(\w+)\}/g)];
  const envStack: string[] = [];
  const allEnvTokens: { type: "begin" | "end"; name: string; pos: number }[] = [];

  for (const m of beginMatches) {
    allEnvTokens.push({ type: "begin", name: m[1], pos: m.index! });
  }
  for (const m of endMatches) {
    allEnvTokens.push({ type: "end", name: m[1], pos: m.index! });
  }
  allEnvTokens.sort((a, b) => a.pos - b.pos);

  for (const token of allEnvTokens) {
    if (token.type === "begin") {
      envStack.push(token.name);
    } else {
      if (envStack.length === 0 || envStack[envStack.length - 1] !== token.name) {
        issues.push({
          chapter: chapterName,
          severity: "error",
          message: `Unmatched \\end{${token.name}} — no corresponding \\begin{${token.name}}`,
        });
      } else {
        envStack.pop();
      }
    }
  }

  for (const env of envStack) {
    issues.push({
      chapter: chapterName,
      severity: "error",
      message: `Unclosed environment: \\begin{${env}} has no \\end{${env}}`,
    });
  }

  return issues;
}

// ── AI validation via Haiku (non-blocking) ──────────────────────────────────

/**
 * Send chapter LaTeX to Claude Haiku for deeper validation.
 * Returns warnings (never blocks). On failure/timeout, returns empty array.
 */
export async function aiValidateChapters(
  chapters: Record<string, string>
): Promise<ValidationIssue[]> {
  const nonEmpty = Object.entries(chapters).filter(([, content]) => content.trim());
  if (nonEmpty.length === 0) return [];

  const chapterSnippets = nonEmpty
    .map(([name, content]) => {
      // Truncate to ~2000 chars per chapter to keep prompt reasonable
      const truncated = content.length > 2000 ? content.slice(0, 2000) + "\n... [truncated]" : content;
      return `=== ${name} ===\n${truncated}`;
    })
    .join("\n\n");

  try {
    const client = getAnthropicClient();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const response = await client.messages.create(
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system:
          "You are a LaTeX syntax validator for medical theses. Check for formatting errors, structural issues, and LaTeX-invalid constructs. Return a JSON array of issues. Each issue: {\"chapter\": \"filename\", \"severity\": \"warning\", \"message\": \"description\"}. If no issues found, return []. Return ONLY the JSON array, no other text.",
        messages: [
          {
            role: "user",
            content: `Validate the following LaTeX chapter content for syntax issues:\n\n${chapterSnippets}`,
          },
        ],
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed: unknown = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item: unknown): item is { chapter: string; severity: string; message: string } =>
          typeof item === "object" &&
          item !== null &&
          "chapter" in item &&
          "message" in item
      )
      .map((item) => ({
        chapter: String(item.chapter),
        severity: "warning" as const,
        message: String(item.message),
      }));
  } catch (err) {
    console.warn("AI validation failed (non-blocking):", err instanceof Error ? err.message : err);
    return [];
  }
}
