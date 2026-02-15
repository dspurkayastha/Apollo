import { describe, it, expect } from "vitest";
import { latexToTiptap } from "./latex-to-tiptap";
import { tiptapToLatex, type TiptapNode } from "./tiptap-to-latex";

describe("latexToTiptap", () => {
  // ── Paragraphs ──────────────────────────────────────────────────────────

  it("should convert a simple paragraph", () => {
    const result = latexToTiptap("Hello world");
    expect(result.json.type).toBe("doc");
    expect(result.json.content).toHaveLength(1);
    expect(result.json.content![0].type).toBe("paragraph");
    expect(result.json.content![0].content![0].text).toBe("Hello world");
  });

  it("should convert multiple paragraphs separated by blank lines", () => {
    const result = latexToTiptap("First paragraph\n\nSecond paragraph");
    expect(result.json.content).toHaveLength(2);
    expect(result.json.content![0].content![0].text).toBe("First paragraph");
    expect(result.json.content![1].content![0].text).toBe("Second paragraph");
  });

  // ── Headings ────────────────────────────────────────────────────────────

  it("should convert \\section to heading level 1", () => {
    const result = latexToTiptap("\\section{Introduction}");
    const heading = result.json.content![0];
    expect(heading.type).toBe("heading");
    expect(heading.attrs?.level).toBe(1);
    expect(heading.content![0].text).toBe("Introduction");
  });

  it("should convert \\subsection to heading level 2", () => {
    const result = latexToTiptap("\\subsection{Background}");
    const heading = result.json.content![0];
    expect(heading.type).toBe("heading");
    expect(heading.attrs?.level).toBe(2);
  });

  it("should convert \\subsubsection to heading level 3", () => {
    const result = latexToTiptap("\\subsubsection{Details}");
    const heading = result.json.content![0];
    expect(heading.type).toBe("heading");
    expect(heading.attrs?.level).toBe(3);
  });

  it("should handle starred heading variants", () => {
    const result = latexToTiptap("\\section*{Unnumbered Section}");
    const heading = result.json.content![0];
    expect(heading.type).toBe("heading");
    expect(heading.attrs?.level).toBe(1);
    expect(heading.content![0].text).toBe("Unnumbered Section");
  });

  // ── Inline formatting ──────────────────────────────────────────────────

  it("should convert \\textbf to bold mark", () => {
    const result = latexToTiptap("This is \\textbf{bold} text");
    const para = result.json.content![0];
    const nodes = para.content!;
    expect(nodes).toHaveLength(3);
    expect(nodes[0].text).toBe("This is ");
    expect(nodes[1].text).toBe("bold");
    expect(nodes[1].marks).toEqual([{ type: "bold" }]);
    expect(nodes[2].text).toBe(" text");
  });

  it("should convert \\textit to italic mark", () => {
    const result = latexToTiptap("This is \\textit{italic} text");
    const nodes = result.json.content![0].content!;
    expect(nodes[1].marks).toEqual([{ type: "italic" }]);
  });

  it("should convert \\emph to italic mark", () => {
    const result = latexToTiptap("This is \\emph{emphasised} text");
    const nodes = result.json.content![0].content!;
    expect(nodes[1].text).toBe("emphasised");
    expect(nodes[1].marks).toEqual([{ type: "italic" }]);
  });

  it("should convert \\texttt to code mark", () => {
    const result = latexToTiptap("Use \\texttt{npm install}");
    const nodes = result.json.content![0].content!;
    expect(nodes[1].text).toBe("npm install");
    expect(nodes[1].marks).toEqual([{ type: "code" }]);
  });

  it("should convert \\underline to underline mark", () => {
    const result = latexToTiptap("This is \\underline{underlined}");
    const nodes = result.json.content![0].content!;
    expect(nodes[1].text).toBe("underlined");
    expect(nodes[1].marks).toEqual([{ type: "underline" }]);
  });

  // ── Nested marks ────────────────────────────────────────────────────────

  it("should handle nested formatting (bold inside italic)", () => {
    const result = latexToTiptap("\\textit{normal \\textbf{bold} end}");
    const nodes = result.json.content![0].content!;
    // Should produce: italic "normal ", bold+italic "bold", italic " end"
    expect(nodes.length).toBeGreaterThanOrEqual(3);
    const boldNode = nodes.find(
      (n) => n.marks?.some((m) => m.type === "bold"),
    );
    expect(boldNode).toBeDefined();
    expect(boldNode!.marks).toEqual(
      expect.arrayContaining([{ type: "italic" }, { type: "bold" }]),
    );
  });

  it("should handle double nesting (bold + italic + underline)", () => {
    const result = latexToTiptap(
      "\\textbf{\\textit{\\underline{triple}}}",
    );
    const nodes = result.json.content![0].content!;
    expect(nodes[0].marks).toEqual(
      expect.arrayContaining([
        { type: "bold" },
        { type: "italic" },
        { type: "underline" },
      ]),
    );
  });

  // ── Citations ──────────────────────────────────────────────────────────

  it("should convert \\cite to code-marked text node", () => {
    const result = latexToTiptap(
      "Studies show \\cite{smith2024} that...",
    );
    const nodes = result.json.content![0].content!;
    const citeNode = nodes.find((n) => n.text?.includes("\\cite{"));
    expect(citeNode).toBeDefined();
    expect(citeNode!.text).toBe("\\cite{smith2024}");
    expect(citeNode!.marks).toEqual([{ type: "code" }]);
    expect(result.citationKeys).toContain("smith2024");
  });

  it("should handle multi-key citations", () => {
    const result = latexToTiptap("\\cite{smith2024,jones2023,lee2022}");
    expect(result.citationKeys).toEqual([
      "smith2024",
      "jones2023",
      "lee2022",
    ]);
  });

  it("should extract unique citation keys from multiple \\cite commands", () => {
    const result = latexToTiptap(
      "First \\cite{smith2024} and second \\cite{smith2024,new2025}",
    );
    expect(result.citationKeys).toEqual(["smith2024", "new2025"]);
  });

  // ── Escaped characters ────────────────────────────────────────────────

  it("should unescape \\% to %", () => {
    const result = latexToTiptap("100\\% of cases");
    const text = result.json.content![0].content![0].text;
    expect(text).toBe("100% of cases");
  });

  it("should unescape \\$ to $", () => {
    const result = latexToTiptap("costs \\$50");
    const text = result.json.content![0].content![0].text;
    expect(text).toBe("costs $50");
  });

  it("should unescape \\& to &", () => {
    const result = latexToTiptap("R\\&D department");
    const text = result.json.content![0].content![0].text;
    expect(text).toBe("R&D department");
  });

  it("should unescape \\_ to _", () => {
    const result = latexToTiptap("variable\\_name");
    const text = result.json.content![0].content![0].text;
    expect(text).toBe("variable_name");
  });

  it("should unescape \\# to #", () => {
    const result = latexToTiptap("item \\#1");
    const text = result.json.content![0].content![0].text;
    expect(text).toBe("item #1");
  });

  it("should unescape \\textbackslash{} to backslash", () => {
    const result = latexToTiptap("path\\textbackslash{}to");
    const text = result.json.content![0].content![0].text;
    expect(text).toBe("path\\to");
  });

  it("should unescape \\textasciitilde{} to tilde", () => {
    const result = latexToTiptap("approx\\textasciitilde{}100");
    const text = result.json.content![0].content![0].text;
    expect(text).toBe("approx~100");
  });

  // ── Lists ─────────────────────────────────────────────────────────────

  it("should convert itemize to bulletList", () => {
    const latex = `\\begin{itemize}
\\item First item
\\item Second item
\\end{itemize}`;
    const result = latexToTiptap(latex);
    const list = result.json.content![0];
    expect(list.type).toBe("bulletList");
    expect(list.content).toHaveLength(2);
    expect(list.content![0].type).toBe("listItem");
    expect(list.content![0].content![0].content![0].text).toBe("First item");
  });

  it("should convert enumerate to orderedList", () => {
    const latex = `\\begin{enumerate}
\\item Step one
\\item Step two
\\end{enumerate}`;
    const result = latexToTiptap(latex);
    const list = result.json.content![0];
    expect(list.type).toBe("orderedList");
    expect(list.content).toHaveLength(2);
  });

  it("should handle list items with inline formatting", () => {
    const latex = `\\begin{itemize}
\\item \\textbf{Bold} item
\\item Normal item
\\end{itemize}`;
    const result = latexToTiptap(latex);
    const firstItem = result.json.content![0].content![0];
    const textNodes = firstItem.content![0].content!;
    expect(textNodes[0].marks).toEqual([{ type: "bold" }]);
  });

  // ── Blockquote ────────────────────────────────────────────────────────

  it("should convert quote environment to blockquote", () => {
    const latex = `\\begin{quote}
A wise quote here
\\end{quote}`;
    const result = latexToTiptap(latex);
    const bq = result.json.content![0];
    expect(bq.type).toBe("blockquote");
    expect(bq.content![0].content![0].text).toBe("A wise quote here");
  });

  // ── Code blocks for complex environments ──────────────────────────────

  it("should convert longtable to codeBlock", () => {
    const latex = `\\begin{longtable}{|l|l|}
\\hline
A & B \\\\
\\hline
\\end{longtable}`;
    const result = latexToTiptap(latex);
    const cb = result.json.content![0];
    expect(cb.type).toBe("codeBlock");
    expect(cb.content![0].text).toContain("\\begin{longtable}");
    expect(cb.content![0].text).toContain("\\end{longtable}");
  });

  it("should convert figure to codeBlock", () => {
    const latex = `\\begin{figure}
\\includegraphics{test.png}
\\caption{Test}
\\end{figure}`;
    const result = latexToTiptap(latex);
    expect(result.json.content![0].type).toBe("codeBlock");
  });

  it("should convert table to codeBlock", () => {
    const latex = `\\begin{table}
\\begin{tabular}{cc}
A & B \\\\
\\end{tabular}
\\end{table}`;
    const result = latexToTiptap(latex);
    // The outer table is a codeBlock — inner tabular is captured inside it
    expect(result.json.content![0].type).toBe("codeBlock");
  });

  // ── Empty / edge cases ────────────────────────────────────────────────

  it("should handle empty input", () => {
    const result = latexToTiptap("");
    expect(result.json.type).toBe("doc");
    expect(result.json.content).toHaveLength(1);
    expect(result.json.content![0].type).toBe("paragraph");
    expect(result.warnings).toEqual([]);
  });

  it("should handle whitespace-only input", () => {
    const result = latexToTiptap("   \n\n  ");
    expect(result.json.type).toBe("doc");
    expect(result.json.content).toHaveLength(1);
    expect(result.json.content![0].type).toBe("paragraph");
  });

  it("should handle input with only comments", () => {
    const result = latexToTiptap("% This is a comment\n% Another comment");
    expect(result.json.content).toHaveLength(1);
    expect(result.json.content![0].type).toBe("paragraph");
  });

  // ── Pre-processing ───────────────────────────────────────────────────

  it("should strip \\label{} commands", () => {
    const result = latexToTiptap(
      "\\section{Introduction}\\label{sec:intro}\n\nHello",
    );
    // \label is removed; the heading content should not contain it
    const heading = result.json.content![0];
    expect(heading.type).toBe("heading");
    const headingText = heading.content![0].text;
    expect(headingText).not.toContain("\\label");
  });

  it("should strip ---BIBTEX--- trailer", () => {
    const latex = `Hello world

---BIBTEX---
@article{test, title={Test}}`;
    const result = latexToTiptap(latex);
    expect(result.json.content).toHaveLength(1);
    expect(result.json.content![0].content![0].text).toBe("Hello world");
  });

  it("should strip comment lines", () => {
    const latex = `% This is a comment
Real content here`;
    const result = latexToTiptap(latex);
    const text = result.json.content![0].content![0].text;
    expect(text).toBe("Real content here");
    expect(text).not.toContain("%");
  });

  // ── Markdown heading artefacts ───────────────────────────────────────

  it("should convert markdown # heading to LaTeX \\section", () => {
    const result = latexToTiptap("# Introduction");
    const heading = result.json.content![0];
    expect(heading.type).toBe("heading");
    expect(heading.attrs?.level).toBe(1);
    expect(heading.content![0].text).toBe("Introduction");
  });

  it("should convert markdown ## heading to LaTeX \\subsection", () => {
    const result = latexToTiptap("## Background");
    const heading = result.json.content![0];
    expect(heading.type).toBe("heading");
    expect(heading.attrs?.level).toBe(2);
    expect(heading.content![0].text).toBe("Background");
  });

  it("should convert markdown ### heading to LaTeX \\subsubsection", () => {
    const result = latexToTiptap("### Details");
    const heading = result.json.content![0];
    expect(heading.type).toBe("heading");
    expect(heading.attrs?.level).toBe(3);
    expect(heading.content![0].text).toBe("Details");
  });

  it("should handle mixed markdown headings and LaTeX content", () => {
    const latex = `# Aims and Objectives

This chapter presents the aims.

## Primary Objective

The primary objective is to study anaemia.`;

    const result = latexToTiptap(latex);
    const nodes = result.json.content!;
    expect(nodes[0].type).toBe("heading");
    expect(nodes[0].attrs?.level).toBe(1);
    expect(nodes[0].content![0].text).toBe("Aims and Objectives");
    expect(nodes[1].type).toBe("paragraph");
    expect(nodes[2].type).toBe("heading");
    expect(nodes[2].attrs?.level).toBe(2);
    expect(nodes[2].content![0].text).toBe("Primary Objective");
  });

  it("should round-trip markdown headings → clean LaTeX (no bare #)", () => {
    const input = "# Introduction\n\nSome text about the study.";
    const tiptapResult = latexToTiptap(input);
    const latexResult = tiptapToLatex(tiptapResult.json);
    expect(latexResult.latex).toContain("\\section{Introduction}");
    expect(latexResult.latex).not.toContain("# Introduction");
    expect(latexResult.latex).toContain("Some text about the study.");
  });

  // ── Full document ─────────────────────────────────────────────────────

  it("should handle a full section with headings, paragraphs, and lists", () => {
    const latex = `\\section{Introduction}

This study examines the effects of \\textbf{treatment A} on patient outcomes \\cite{smith2024}.

\\subsection{Background}

Previous research has shown:

\\begin{itemize}
\\item Finding one \\cite{jones2023}
\\item Finding two
\\end{itemize}

\\subsection{Significance}

This research is \\textit{critically important} for the field.`;

    const result = latexToTiptap(latex);
    expect(result.json.type).toBe("doc");
    expect(result.json.content!.length).toBeGreaterThanOrEqual(5);
    expect(result.citationKeys).toContain("smith2024");
    expect(result.citationKeys).toContain("jones2023");
    expect(result.warnings).toEqual([]);
  });

  // ── Round-trip test ───────────────────────────────────────────────────

  it("should round-trip: LaTeX → Tiptap → LaTeX preserves content", () => {
    const originalLatex = `\\section{Introduction}

This study examines the effects of \\textbf{treatment A} on patient outcomes.

\\subsection{Background}

Previous research by \\textit{Smith et al.} has shown significant results.

\\begin{itemize}
\\item First finding
\\item Second finding with \\textbf{emphasis}
\\end{itemize}`;

    // LaTeX → Tiptap
    const tiptapResult = latexToTiptap(originalLatex);
    // Tiptap → LaTeX
    const latexResult = tiptapToLatex(tiptapResult.json);

    // Content equivalence checks (not exact string match due to whitespace)
    expect(latexResult.latex).toContain("\\section{Introduction}");
    expect(latexResult.latex).toContain("\\textbf{treatment A}");
    expect(latexResult.latex).toContain("\\subsection{Background}");
    expect(latexResult.latex).toContain("\\textit{Smith et al.}");
    expect(latexResult.latex).toContain("\\begin{itemize}");
    expect(latexResult.latex).toContain("\\item First finding");
  });

  it("should round-trip citations: LaTeX → Tiptap → LaTeX preserves \\cite", () => {
    const original = "Studies show \\cite{smith2024,jones2023} that results are significant.";

    const tiptapResult = latexToTiptap(original);
    const latexResult = tiptapToLatex(tiptapResult.json);

    expect(latexResult.latex).toContain("\\cite{smith2024,jones2023}");
    expect(latexResult.citationKeys).toContain("smith2024");
    expect(latexResult.citationKeys).toContain("jones2023");
  });

  // ── Heading with inline formatting ───────────────────────────────────

  it("should handle heading with inline formatting", () => {
    const result = latexToTiptap(
      "\\section{Review of \\textit{Literature}}",
    );
    const heading = result.json.content![0];
    expect(heading.type).toBe("heading");
    expect(heading.content!.length).toBeGreaterThanOrEqual(2);
    const italicNode = heading.content!.find((n: TiptapNode) =>
      n.marks?.some((m) => m.type === "italic"),
    );
    expect(italicNode).toBeDefined();
    expect(italicNode!.text).toBe("Literature");
  });

  // ── Mixed content paragraph ──────────────────────────────────────────

  it("should handle paragraph with mixed formatting and citations", () => {
    const latex =
      "The \\textbf{primary} outcome was measured using \\textit{validated scales} \\cite{scale2024}.";
    const result = latexToTiptap(latex);
    const nodes = result.json.content![0].content!;

    // Check that bold, italic, and citation nodes exist
    expect(nodes.some((n) => n.marks?.some((m) => m.type === "bold"))).toBe(
      true,
    );
    expect(
      nodes.some((n) => n.marks?.some((m) => m.type === "italic")),
    ).toBe(true);
    expect(
      nodes.some((n) => n.text?.includes("\\cite{scale2024}")),
    ).toBe(true);
    expect(result.citationKeys).toContain("scale2024");
  });
});
