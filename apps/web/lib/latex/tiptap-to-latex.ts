/**
 * Tiptap JSON AST → LaTeX serialiser.
 *
 * Walks a Tiptap/ProseMirror JSON document and emits LaTeX suitable for
 * inclusion in a thesis section body. Uses escapeLatex() for all user text.
 */

import { escapeLatex } from "./escape";
import { extractCiteKeys } from "@/lib/citations/extract-keys";

// ── Tiptap JSON node types ──────────────────────────────────────────────────

export interface TiptapMark {
  type: "bold" | "italic" | "code" | "underline" | "link" | string;
  attrs?: Record<string, unknown>;
}

export interface TiptapNode {
  type: string;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
  attrs?: Record<string, unknown>;
}

// ── Result type ─────────────────────────────────────────────────────────────

export interface TiptapToLatexResult {
  latex: string;
  citationKeys: string[];
  warnings: string[];
}

// ── Heading depth mapping ───────────────────────────────────────────────────

function headingCommand(level: number): string {
  switch (level) {
    case 1:
      return "\\section";
    case 2:
      return "\\subsection";
    case 3:
      return "\\subsubsection";
    default:
      return "\\paragraph";
  }
}

// ── Mark wrappers ───────────────────────────────────────────────────────────

function applyMarks(text: string, marks: TiptapMark[]): string {
  // Citation commands in code marks pass through raw
  if (
    marks.length === 1 &&
    marks[0].type === "code" &&
    /^\\cite\{[^}]+\}$/.test(text)
  ) {
    return text;
  }

  let result = text;
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        result = `\\textbf{${result}}`;
        break;
      case "italic":
        result = `\\textit{${result}}`;
        break;
      case "code":
        result = `\\texttt{${result}}`;
        break;
      case "underline":
        result = `\\underline{${result}}`;
        break;
      // Other marks (link, etc.) are passed through as plain text
    }
  }
  return result;
}

// ── Node serialisation ──────────────────────────────────────────────────────

function serializeNode(node: TiptapNode, warnings: string[]): string {
  switch (node.type) {
    case "doc":
      return serializeChildren(node, warnings);

    case "paragraph":
      return serializeChildren(node, warnings) + "\n\n";

    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      const cmd = headingCommand(level);
      const content = serializeChildren(node, warnings);
      return `${cmd}{${content}}\n\n`;
    }

    case "bulletList":
      return (
        "\\begin{itemize}\n" +
        serializeChildren(node, warnings) +
        "\\end{itemize}\n\n"
      );

    case "orderedList":
      return (
        "\\begin{enumerate}\n" +
        serializeChildren(node, warnings) +
        "\\end{enumerate}\n\n"
      );

    case "listItem": {
      const content = serializeChildren(node, warnings).trim();
      return `  \\item ${content}\n`;
    }

    case "blockquote":
      return (
        "\\begin{quote}\n" +
        serializeChildren(node, warnings) +
        "\\end{quote}\n\n"
      );

    case "text": {
      const raw = node.text ?? "";
      // Citation commands in code marks pass through raw (skip escaping)
      if (
        node.marks &&
        node.marks.length === 1 &&
        node.marks[0].type === "code" &&
        /^\\cite\{[^}]+\}$/.test(raw)
      ) {
        return raw;
      }
      const escaped = escapeLatex(raw);
      if (node.marks && node.marks.length > 0) {
        return applyMarks(escaped, node.marks);
      }
      return escaped;
    }

    case "hardBreak":
      return "\\\\\n";

    default:
      warnings.push(`Unsupported node type: ${node.type}`);
      // Best-effort: serialise children if any
      if (node.content) {
        return serializeChildren(node, warnings);
      }
      return "";
  }
}

function serializeChildren(node: TiptapNode, warnings: string[]): string {
  if (!node.content) return "";
  return node.content.map((child) => serializeNode(child, warnings)).join("");
}

// ── Public API ──────────────────────────────────────────────────────────────

export function tiptapToLatex(doc: TiptapNode): TiptapToLatexResult {
  const warnings: string[] = [];

  if (doc.type !== "doc") {
    warnings.push("Root node is not 'doc', wrapping as-is");
  }

  const latex = serializeNode(doc, warnings).trimEnd() + "\n";
  const citationKeys = extractCiteKeys(latex);

  return { latex, citationKeys, warnings };
}
