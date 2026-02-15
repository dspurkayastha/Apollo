import { describe, it, expect } from "vitest";
import { preflightChapter } from "./validate";

describe("preflightChapter", () => {
  it("returns no issues for clean LaTeX", () => {
    const latex = `\\section{Background}
Anaemia is a common condition affecting 40\\% of pregnant women \\cite{who2024}.

\\subsection{Prevalence}
The prevalence varies by region, with rates of 20--60\\% reported globally.

\\begin{itemize}
  \\item Iron deficiency is the most common cause
  \\item Folate deficiency contributes in endemic areas
\\end{itemize}`;

    const issues = preflightChapter("chapters/introduction.tex", latex);
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("detects unescaped # as error", () => {
    const latex = "# Introduction\nThis section covers the background.";
    const issues = preflightChapter("chapters/introduction.tex", latex);

    const errors = issues.filter((i) => i.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((i) => i.message.includes("#"))).toBe(true);
  });

  it("does not flag escaped \\# as error", () => {
    const latex = "The cost was \\$5 for item \\#3.";
    const issues = preflightChapter("chapters/introduction.tex", latex);

    const hashErrors = issues.filter(
      (i) => i.severity === "error" && i.message.includes("#")
    );
    expect(hashErrors).toHaveLength(0);
  });

  it("detects markdown heading (# Heading) as error", () => {
    const latex = "Some text.\n# Introduction\nMore text.";
    const issues = preflightChapter("chapters/introduction.tex", latex);

    const mdErrors = issues.filter(
      (i) => i.severity === "error" && i.message.includes("Markdown heading")
    );
    expect(mdErrors.length).toBeGreaterThan(0);
  });

  it("detects ## subheading as markdown artifact", () => {
    const latex = "## Background\nSome background info.";
    const issues = preflightChapter("chapters/introduction.tex", latex);

    const mdErrors = issues.filter(
      (i) => i.severity === "error" && i.message.includes("Markdown heading")
    );
    expect(mdErrors.length).toBeGreaterThan(0);
  });

  it("detects unbalanced braces (unclosed)", () => {
    const latex = "\\textbf{bold text without closing";
    const issues = preflightChapter("chapters/introduction.tex", latex);

    const braceErrors = issues.filter(
      (i) => i.severity === "error" && i.message.includes("braces")
    );
    expect(braceErrors.length).toBeGreaterThan(0);
    expect(braceErrors[0].message).toContain("unclosed");
  });

  it("detects unbalanced braces (extra closing)", () => {
    const latex = "Some text} extra brace";
    const issues = preflightChapter("chapters/introduction.tex", latex);

    const braceErrors = issues.filter(
      (i) => i.severity === "error" && i.message.includes("braces")
    );
    expect(braceErrors.length).toBeGreaterThan(0);
    expect(braceErrors[0].message).toContain("extra");
  });

  it("passes balanced braces", () => {
    const latex = "\\textbf{bold} and \\textit{italic} with \\cite{key}";
    const issues = preflightChapter("chapters/introduction.tex", latex);

    const braceErrors = issues.filter(
      (i) => i.severity === "error" && i.message.includes("braces")
    );
    expect(braceErrors).toHaveLength(0);
  });

  it("detects unmatched \\begin/\\end environments", () => {
    const latex = `\\begin{itemize}
  \\item First
  \\item Second`;
    const issues = preflightChapter("chapters/introduction.tex", latex);

    const envErrors = issues.filter(
      (i) => i.severity === "error" && i.message.includes("environment")
    );
    expect(envErrors.length).toBeGreaterThan(0);
    expect(envErrors[0].message).toContain("itemize");
  });

  it("passes matched \\begin/\\end environments", () => {
    const latex = `\\begin{itemize}
  \\item First
  \\item Second
\\end{itemize}`;
    const issues = preflightChapter("chapters/introduction.tex", latex);

    const envErrors = issues.filter(
      (i) => i.severity === "error" && i.message.includes("environment")
    );
    expect(envErrors).toHaveLength(0);
  });

  it("detects bare URLs as warning", () => {
    const latex = "See https://example.com/study for details.";
    const issues = preflightChapter("chapters/introduction.tex", latex);

    const urlWarnings = issues.filter(
      (i) => i.severity === "warning" && i.message.includes("URL")
    );
    expect(urlWarnings.length).toBeGreaterThan(0);
  });

  it("does not flag \\url{} wrapped URLs", () => {
    const latex = "See \\url{https://example.com/study} for details.";
    const issues = preflightChapter("chapters/introduction.tex", latex);

    const urlWarnings = issues.filter(
      (i) => i.severity === "warning" && i.message.includes("URL")
    );
    // The URL is still bare in the regex match since we look for the URL pattern
    // but \url{} prefix should ideally not flag. Our regex checks (?<!\\url\{)
    expect(urlWarnings).toHaveLength(0);
  });

  it("detects markdown separator (---) as warning", () => {
    const latex = "First section.\n---\nSecond section.";
    const issues = preflightChapter("chapters/introduction.tex", latex);

    const sepWarnings = issues.filter(
      (i) => i.severity === "warning" && i.message.includes("separator")
    );
    expect(sepWarnings.length).toBeGreaterThan(0);
  });

  it("returns empty array for empty content", () => {
    const issues = preflightChapter("chapters/introduction.tex", "");
    expect(issues).toHaveLength(0);
  });

  it("returns empty array for whitespace-only content", () => {
    const issues = preflightChapter("chapters/introduction.tex", "   \n  \n  ");
    expect(issues).toHaveLength(0);
  });

  it("does not flag # in LaTeX comments", () => {
    const latex = "% This is a comment with # in it\nReal content here.";
    const issues = preflightChapter("chapters/introduction.tex", latex);

    const hashErrors = issues.filter(
      (i) => i.severity === "error" && i.message.includes("#")
    );
    expect(hashErrors).toHaveLength(0);
  });

  it("includes line numbers in issues", () => {
    const latex = "Clean line.\n# Bad markdown heading\nAnother clean line.";
    const issues = preflightChapter("chapters/introduction.tex", latex);

    const mdErrors = issues.filter(
      (i) => i.severity === "error" && i.message.includes("Markdown heading")
    );
    expect(mdErrors.length).toBeGreaterThan(0);
    expect(mdErrors[0].line).toBe(2);
  });

  it("includes chapter name in all issues", () => {
    const latex = "# Bad heading";
    const issues = preflightChapter("chapters/introduction.tex", latex);

    for (const issue of issues) {
      expect(issue.chapter).toBe("chapters/introduction.tex");
    }
  });
});
