/**
 * LaTeX → Tiptap JSON converter.
 *
 * Two-pass regex-based parser targeting the predictable subset of LaTeX
 * produced by AI generation. NOT a general-purpose LaTeX parser.
 *
 * Pass 1: Block tokeniser — splits input into heading / list / blockquote /
 *         codeBlock / paragraph blocks.
 * Pass 2: Inline parser — recursive-descent within each block's text to
 *         handle \textbf, \textit, \emph, \texttt, \underline, \cite, and
 *         escaped characters.
 */

import type { TiptapNode, TiptapMark } from "./tiptap-to-latex";

// ── Result type ─────────────────────────────────────────────────────────────

export interface LatexToTiptapResult {
  json: TiptapNode;
  citationKeys: string[];
  warnings: string[];
}

// ── Pre-processing ──────────────────────────────────────────────────────────

/**
 * Strip non-content LaTeX that the Rich Text editor should never display:
 * labels, needspace, bibtex trailer, comment lines.
 * Also converts markdown heading artefacts (`# Title`) to LaTeX headings.
 */
function preprocess(latex: string): string {
  let result = latex;
  // Remove ---BIBTEX--- trailer (everything after it)
  const bibtexIdx = result.indexOf("---BIBTEX---");
  if (bibtexIdx !== -1) {
    result = result.slice(0, bibtexIdx);
  }
  // Remove \label{...}
  result = result.replace(/\\label\{[^}]*\}/g, "");
  // Remove \needspace{...}
  result = result.replace(/\\needspace\{[^}]*\}/g, "");
  // Remove full-line comments (lines starting with %)
  result = result.replace(/^%.*$/gm, "");
  // Convert markdown heading artefacts to LaTeX headings
  // (AI sometimes produces `# Title` instead of `\section{Title}`)
  result = result.replace(/^###\s+(.+)$/gm, "\\subsubsection{$1}");
  result = result.replace(/^##\s+(.+)$/gm, "\\subsection{$1}");
  result = result.replace(/^#\s+(.+)$/gm, "\\section{$1}");
  return result.trim();
}

// ── Escaped character mapping (inverse of escape.ts) ────────────────────────

const UNESCAPE_MAP: [RegExp, string][] = [
  [/\\textbackslash\{\}/g, "\\"],
  [/\\textasciitilde\{\}/g, "~"],
  [/\\textasciicircum\{\}/g, "^"],
  [/\\&/g, "&"],
  [/\\%/g, "%"],
  [/\\\$/g, "$"],
  [/\\#/g, "#"],
  [/\\_/g, "_"],
  [/\\\{/g, "{"],
  [/\\\}/g, "}"],
];

function unescapeLatex(text: string): string {
  let result = text;
  for (const [pattern, replacement] of UNESCAPE_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// ── Citation key extraction ─────────────────────────────────────────────────

function extractCiteKeys(text: string): string[] {
  const keys: string[] = [];
  const re = /\\cite\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    for (const k of m[1].split(",")) {
      const trimmed = k.trim();
      if (trimmed && !keys.includes(trimmed)) keys.push(trimmed);
    }
  }
  return keys;
}

// ── Pass 2: Inline parser ───────────────────────────────────────────────────

/**
 * Parse inline LaTeX content into Tiptap text nodes with marks.
 * Uses recursive descent to handle nested commands like \textbf{\textit{...}}.
 */
function parseInline(
  input: string,
  marks: TiptapMark[],
  citationKeys: string[],
): TiptapNode[] {
  const nodes: TiptapNode[] = [];
  let pos = 0;

  while (pos < input.length) {
    // Try to match a LaTeX command
    const cmdMatch = matchCommand(input, pos);

    if (cmdMatch) {
      // Flush any plain text before this command
      if (cmdMatch.start > pos) {
        const plain = unescapeLatex(input.slice(pos, cmdMatch.start));
        if (plain) {
          nodes.push(textNode(plain, marks));
        }
      }

      if (cmdMatch.type === "cite") {
        // \cite{keys} → code-marked text node with raw command
        const raw = input.slice(cmdMatch.start, cmdMatch.end);
        const keys = extractCiteKeys(raw);
        for (const k of keys) {
          if (!citationKeys.includes(k)) citationKeys.push(k);
        }
        nodes.push(textNode(raw, [...marks, { type: "code" }]));
      } else if (cmdMatch.type === "format") {
        // \textbf{...}, \textit{...}, etc. → recurse with added mark
        const innerNodes = parseInline(
          cmdMatch.content,
          [...marks, { type: cmdMatch.mark! }],
          citationKeys,
        );
        nodes.push(...innerNodes);
      }

      pos = cmdMatch.end;
    } else if (input[pos] === "\\") {
      // Backslash at current position but no command matched — try escaped char
      const escMatch = matchEscapedChar(input, pos);
      if (escMatch) {
        nodes.push(textNode(escMatch.char, marks));
        pos = escMatch.end;
      } else {
        // Unknown backslash sequence — consume the backslash as-is
        nodes.push(textNode(input[pos], marks));
        pos++;
      }
    } else {
      // No backslash here — consume plain text up to the next backslash
      const nextBackslash = input.indexOf("\\", pos);
      const end = nextBackslash === -1 ? input.length : nextBackslash;
      const plain = unescapeLatex(input.slice(pos, end));
      if (plain) {
        nodes.push(textNode(plain, marks));
      }
      pos = end;
    }
  }

  return mergeAdjacentTextNodes(nodes);
}

interface CommandMatch {
  type: "format" | "cite";
  start: number;
  end: number;
  content: string;
  mark?: string;
}

const FORMAT_COMMANDS: Record<string, string> = {
  "\\textbf": "bold",
  "\\textit": "italic",
  "\\emph": "italic",
  "\\texttt": "code",
  "\\underline": "underline",
};

/**
 * Try to match a LaTeX command at the given position.
 */
function matchCommand(input: string, pos: number): CommandMatch | null {
  if (input[pos] !== "\\") return null;

  // Try \cite{...}
  if (input.startsWith("\\cite{", pos)) {
    const braceContent = extractBraceContent(input, pos + 5);
    if (braceContent) {
      return {
        type: "cite",
        start: pos,
        end: braceContent.end,
        content: braceContent.content,
      };
    }
  }

  // Try format commands
  for (const [cmd, mark] of Object.entries(FORMAT_COMMANDS)) {
    if (input.startsWith(cmd + "{", pos)) {
      const braceContent = extractBraceContent(input, pos + cmd.length);
      if (braceContent) {
        return {
          type: "format",
          start: pos,
          end: braceContent.end,
          content: braceContent.content,
          mark,
        };
      }
    }
  }

  return null;
}

interface EscapedCharMatch {
  char: string;
  end: number;
}

/**
 * Match an escaped character sequence at the given position.
 */
function matchEscapedChar(input: string, pos: number): EscapedCharMatch | null {
  if (input[pos] !== "\\") return null;

  // Multi-character escapes
  if (input.startsWith("\\textbackslash{}", pos))
    return { char: "\\", end: pos + 16 };
  if (input.startsWith("\\textasciitilde{}", pos))
    return { char: "~", end: pos + 17 };
  if (input.startsWith("\\textasciicircum{}", pos))
    return { char: "^", end: pos + 18 };

  // Single-character escapes: \& \% \$ \# \_ \{ \}
  const next = input[pos + 1];
  if (next && "&%$#_{} ".includes(next)) {
    return { char: next, end: pos + 2 };
  }

  return null;
}

/**
 * Extract content between balanced braces starting at `pos` (which must point to `{`).
 */
function extractBraceContent(
  input: string,
  pos: number,
): { content: string; end: number } | null {
  if (input[pos] !== "{") return null;

  let depth = 1;
  let i = pos + 1;

  while (i < input.length && depth > 0) {
    if (input[i] === "{" && input[i - 1] !== "\\") {
      depth++;
    } else if (input[i] === "}" && input[i - 1] !== "\\") {
      depth--;
    }
    if (depth > 0) i++;
  }

  if (depth !== 0) return null;

  return {
    content: input.slice(pos + 1, i),
    end: i + 1,
  };
}

function textNode(text: string, marks: TiptapMark[]): TiptapNode {
  const node: TiptapNode = { type: "text", text };
  if (marks.length > 0) {
    node.marks = [...marks];
  }
  return node;
}

/**
 * Merge adjacent text nodes that have identical marks.
 */
function mergeAdjacentTextNodes(nodes: TiptapNode[]): TiptapNode[] {
  if (nodes.length === 0) return nodes;

  const merged: TiptapNode[] = [nodes[0]];

  for (let i = 1; i < nodes.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = nodes[i];

    if (
      prev.type === "text" &&
      curr.type === "text" &&
      marksEqual(prev.marks, curr.marks)
    ) {
      prev.text = (prev.text ?? "") + (curr.text ?? "");
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

function marksEqual(
  a: TiptapMark[] | undefined,
  b: TiptapMark[] | undefined,
): boolean {
  const aMarks = a ?? [];
  const bMarks = b ?? [];
  if (aMarks.length !== bMarks.length) return false;
  return aMarks.every(
    (m, i) => m.type === bMarks[i].type,
  );
}

// ── Pass 1: Block tokeniser ─────────────────────────────────────────────────

interface Block {
  type:
    | "heading"
    | "paragraph"
    | "bulletList"
    | "orderedList"
    | "blockquote"
    | "codeBlock";
  level?: number; // for headings
  content: string;
  items?: string[]; // for lists
}

/**
 * Tokenise LaTeX into blocks for conversion to Tiptap nodes.
 */
function tokeniseBlocks(latex: string): Block[] {
  const blocks: Block[] = [];
  const lines = latex.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // Headings: \section{...}, \subsection{...}, \subsubsection{...}
    // Also handle starred variants
    const headingMatch = trimmed.match(
      /^\\(section|subsection|subsubsection)\*?\{(.+)\}$/,
    );
    if (headingMatch) {
      const levelMap: Record<string, number> = {
        section: 1,
        subsection: 2,
        subsubsection: 3,
      };
      blocks.push({
        type: "heading",
        level: levelMap[headingMatch[1]],
        content: headingMatch[2],
      });
      i++;
      continue;
    }

    // Environment blocks: \begin{env}...\end{env}
    const beginMatch = trimmed.match(/^\\begin\{(\w+)\}/);
    if (beginMatch) {
      const envName = beginMatch[1];
      const envContent: string[] = [];
      const startLine = trimmed;
      i++;

      // Collect until \end{envName}
      while (i < lines.length) {
        const eLine = lines[i];
        if (eLine.trim() === `\\end{${envName}}`) {
          i++;
          break;
        }
        envContent.push(eLine);
        i++;
      }

      if (envName === "itemize") {
        blocks.push({
          type: "bulletList",
          content: envContent.join("\n"),
          items: parseListItems(envContent),
        });
      } else if (envName === "enumerate") {
        blocks.push({
          type: "orderedList",
          content: envContent.join("\n"),
          items: parseListItems(envContent),
        });
      } else if (envName === "quote") {
        blocks.push({
          type: "blockquote",
          content: envContent.join("\n").trim(),
        });
      } else {
        // Complex environments (longtable, table, figure, etc.) → codeBlock
        blocks.push({
          type: "codeBlock",
          content:
            startLine +
            "\n" +
            envContent.join("\n") +
            `\n\\end{${envName}}`,
        });
      }
      continue;
    }

    // Regular paragraph text — collect until empty line or command
    const paraLines: string[] = [];
    while (i < lines.length) {
      const pLine = lines[i].trim();
      if (!pLine) {
        i++;
        break;
      }
      // Stop if we hit a block-level command
      if (
        pLine.match(/^\\(section|subsection|subsubsection)\*?\{/) ||
        pLine.match(/^\\begin\{/)
      ) {
        break;
      }
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      blocks.push({
        type: "paragraph",
        content: paraLines.join(" ").trim(),
      });
    }
  }

  return blocks;
}

/**
 * Parse \item entries from list environment content lines.
 */
function parseListItems(lines: string[]): string[] {
  const items: string[] = [];
  let currentItem = "";

  for (const line of lines) {
    const trimmed = line.trim();
    const itemMatch = trimmed.match(/^\\item\s*(.*)/);
    if (itemMatch) {
      if (currentItem) {
        items.push(currentItem.trim());
      }
      currentItem = itemMatch[1];
    } else if (currentItem && trimmed) {
      currentItem += " " + trimmed;
    }
  }

  if (currentItem) {
    items.push(currentItem.trim());
  }

  return items;
}

// ── Block → Tiptap node conversion ─────────────────────────────────────────

function blockToNode(
  block: Block,
  citationKeys: string[],
  warnings: string[],
): TiptapNode | TiptapNode[] {
  switch (block.type) {
    case "heading": {
      const inlineNodes = parseInline(block.content, [], citationKeys);
      return {
        type: "heading",
        attrs: { level: block.level ?? 1 },
        content: inlineNodes.length > 0 ? inlineNodes : undefined,
      };
    }

    case "paragraph": {
      const inlineNodes = parseInline(block.content, [], citationKeys);
      return {
        type: "paragraph",
        content: inlineNodes.length > 0 ? inlineNodes : undefined,
      };
    }

    case "bulletList":
    case "orderedList": {
      const listItems = (block.items ?? []).map((itemText) => {
        const inlineNodes = parseInline(itemText, [], citationKeys);
        return {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: inlineNodes.length > 0 ? inlineNodes : undefined,
            },
          ],
        } as TiptapNode;
      });
      return {
        type: block.type,
        content: listItems.length > 0 ? listItems : undefined,
      };
    }

    case "blockquote": {
      const inlineNodes = parseInline(block.content, [], citationKeys);
      return {
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: inlineNodes.length > 0 ? inlineNodes : undefined,
          },
        ],
      };
    }

    case "codeBlock":
      return {
        type: "codeBlock",
        content: [
          {
            type: "text",
            text: block.content,
          },
        ],
      };

    default: {
      warnings.push(`Unknown block type: ${block.type}`);
      return {
        type: "paragraph",
        content: [{ type: "text", text: block.content }],
      };
    }
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export function latexToTiptap(latex: string): LatexToTiptapResult {
  const warnings: string[] = [];
  const citationKeys: string[] = [];

  if (!latex || !latex.trim()) {
    return {
      json: { type: "doc", content: [{ type: "paragraph" }] },
      citationKeys: [],
      warnings: [],
    };
  }

  const cleaned = preprocess(latex);
  const blocks = tokeniseBlocks(cleaned);

  const content: TiptapNode[] = [];
  for (const block of blocks) {
    const node = blockToNode(block, citationKeys, warnings);
    if (Array.isArray(node)) {
      content.push(...node);
    } else {
      content.push(node);
    }
  }

  // Ensure at least one node
  if (content.length === 0) {
    content.push({ type: "paragraph" });
  }

  return {
    json: { type: "doc", content },
    citationKeys,
    warnings,
  };
}
