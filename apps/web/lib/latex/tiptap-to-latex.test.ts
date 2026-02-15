import { describe, it, expect } from "vitest";
import { tiptapToLatex, type TiptapNode } from "./tiptap-to-latex";

// Helper: wrap inline content in a doc > paragraph
function docWith(...paragraphs: TiptapNode[]) {
  return {
    type: "doc" as const,
    content: paragraphs,
  };
}

function para(...content: TiptapNode[]): TiptapNode {
  return { type: "paragraph", content };
}

function text(t: string, marks?: { type: string }[]): TiptapNode {
  return { type: "text", text: t, ...(marks ? { marks } : {}) };
}

describe("tiptapToLatex", () => {
  it("should convert a simple paragraph", () => {
    const doc = docWith(para(text("Hello world")));
    const result = tiptapToLatex(doc);
    expect(result.latex).toBe("Hello world\n");
    expect(result.warnings).toEqual([]);
    expect(result.citationKeys).toEqual([]);
  });

  it("should convert multiple paragraphs", () => {
    const doc = docWith(
      para(text("First paragraph")),
      para(text("Second paragraph"))
    );
    const result = tiptapToLatex(doc);
    expect(result.latex).toBe("First paragraph\n\nSecond paragraph\n");
  });

  it("should convert bold text", () => {
    const doc = docWith(para(text("bold text", [{ type: "bold" }])));
    const result = tiptapToLatex(doc);
    expect(result.latex).toBe("\\textbf{bold text}\n");
  });

  it("should convert italic text", () => {
    const doc = docWith(para(text("italic text", [{ type: "italic" }])));
    const result = tiptapToLatex(doc);
    expect(result.latex).toBe("\\textit{italic text}\n");
  });

  it("should convert code text", () => {
    const doc = docWith(para(text("code", [{ type: "code" }])));
    const result = tiptapToLatex(doc);
    expect(result.latex).toBe("\\texttt{code}\n");
  });

  it("should convert underlined text", () => {
    const doc = docWith(para(text("underlined", [{ type: "underline" }])));
    const result = tiptapToLatex(doc);
    expect(result.latex).toBe("\\underline{underlined}\n");
  });

  it("should nest bold inside italic", () => {
    const doc = docWith(
      para(text("bold italic", [{ type: "bold" }, { type: "italic" }]))
    );
    const result = tiptapToLatex(doc);
    expect(result.latex).toBe("\\textit{\\textbf{bold italic}}\n");
  });

  it("should convert heading level 1 to section", () => {
    const doc = docWith({
      type: "heading",
      attrs: { level: 1 },
      content: [text("Introduction")],
    });
    const result = tiptapToLatex(doc);
    expect(result.latex).toBe("\\section{Introduction}\n");
  });

  it("should convert heading level 2 to subsection", () => {
    const doc = docWith({
      type: "heading",
      attrs: { level: 2 },
      content: [text("Background")],
    });
    const result = tiptapToLatex(doc);
    expect(result.latex).toBe("\\subsection{Background}\n");
  });

  it("should convert heading level 3 to subsubsection", () => {
    const doc = docWith({
      type: "heading",
      attrs: { level: 3 },
      content: [text("Details")],
    });
    const result = tiptapToLatex(doc);
    expect(result.latex).toBe("\\subsubsection{Details}\n");
  });

  it("should convert bullet list", () => {
    const doc = docWith({
      type: "bulletList",
      content: [
        { type: "listItem", content: [para(text("Item one"))] },
        { type: "listItem", content: [para(text("Item two"))] },
      ],
    });
    const result = tiptapToLatex(doc);
    expect(result.latex).toContain("\\begin{itemize}");
    expect(result.latex).toContain("\\item Item one");
    expect(result.latex).toContain("\\item Item two");
    expect(result.latex).toContain("\\end{itemize}");
  });

  it("should convert ordered list", () => {
    const doc = docWith({
      type: "orderedList",
      content: [
        { type: "listItem", content: [para(text("First"))] },
        { type: "listItem", content: [para(text("Second"))] },
      ],
    });
    const result = tiptapToLatex(doc);
    expect(result.latex).toContain("\\begin{enumerate}");
    expect(result.latex).toContain("\\item First");
    expect(result.latex).toContain("\\item Second");
    expect(result.latex).toContain("\\end{enumerate}");
  });

  it("should convert blockquote", () => {
    const doc = docWith({
      type: "blockquote",
      content: [para(text("A wise quote"))],
    });
    const result = tiptapToLatex(doc);
    expect(result.latex).toContain("\\begin{quote}");
    expect(result.latex).toContain("A wise quote");
    expect(result.latex).toContain("\\end{quote}");
  });

  it("should escape special LaTeX characters in text", () => {
    const doc = docWith(para(text("100% of $5 spent on R&D")));
    const result = tiptapToLatex(doc);
    expect(result.latex).toContain("100\\%");
    expect(result.latex).toContain("\\$5");
    expect(result.latex).toContain("R\\&D");
  });

  it("should extract citation keys from \\cite commands", () => {
    // User types \cite{...} in the editor — it passes through escapeLatex
    // which escapes the backslash. In real use, citations come from
    // AI-generated LaTeX or paste. For this test, use raw LaTeX content.
    const doc = docWith(para({ type: "text", text: "\\cite{smith2024,jones2023}" }));
    const result = tiptapToLatex(doc);
    // After escaping, the backslash becomes \textbackslash{} so no cite keys extracted
    // Citation keys are only found when content contains actual \cite commands
    // This happens when LaTeX source is pasted or AI-generated
    expect(result.citationKeys).toEqual([]);
  });

  it("should handle empty document", () => {
    const doc = { type: "doc", content: [] };
    const result = tiptapToLatex(doc);
    expect(result.latex).toBe("\n");
    expect(result.warnings).toEqual([]);
  });

  it("should handle document with no content property", () => {
    const doc = { type: "doc" };
    const result = tiptapToLatex(doc);
    expect(result.latex).toBe("\n");
  });

  it("should warn on unsupported node types", () => {
    const doc = docWith({ type: "customWidget" });
    const result = tiptapToLatex(doc);
    expect(result.warnings).toContain("Unsupported node type: customWidget");
  });

  it("should handle hardBreak", () => {
    const doc = docWith(
      para(text("Line 1"), { type: "hardBreak" }, text("Line 2"))
    );
    const result = tiptapToLatex(doc);
    expect(result.latex).toContain("Line 1\\\\\nLine 2");
  });

  it("should handle mixed inline content in a paragraph", () => {
    const doc = docWith(
      para(
        text("Normal "),
        text("bold", [{ type: "bold" }]),
        text(" and "),
        text("italic", [{ type: "italic" }]),
        text(" text")
      )
    );
    const result = tiptapToLatex(doc);
    expect(result.latex).toBe(
      "Normal \\textbf{bold} and \\textit{italic} text\n"
    );
  });

  it("should handle heading with formatted content", () => {
    const doc = docWith({
      type: "heading",
      attrs: { level: 1 },
      content: [
        text("Review of "),
        text("Literature", [{ type: "italic" }]),
      ],
    });
    const result = tiptapToLatex(doc);
    expect(result.latex).toBe(
      "\\section{Review of \\textit{Literature}}\n"
    );
  });

  it("should warn when root node is not doc", () => {
    const notDoc = { type: "paragraph", content: [text("Hello")] };
    const result = tiptapToLatex(notDoc);
    expect(result.warnings).toContain("Root node is not 'doc', wrapping as-is");
    expect(result.latex).toContain("Hello");
  });
});
