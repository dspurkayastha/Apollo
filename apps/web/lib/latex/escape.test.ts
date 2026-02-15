import { describe, it, expect } from "vitest";
import { escapeLatex, escapeLatexArg, normaliseUnicode } from "./escape";

describe("escapeLatex", () => {
  it("should escape ampersand", () => {
    expect(escapeLatex("A & B")).toBe("A \\& B");
  });

  it("should escape percent", () => {
    expect(escapeLatex("100%")).toBe("100\\%");
  });

  it("should escape dollar", () => {
    expect(escapeLatex("$100")).toBe("\\$100");
  });

  it("should escape hash", () => {
    expect(escapeLatex("Item #1")).toBe("Item \\#1");
  });

  it("should escape underscore", () => {
    expect(escapeLatex("my_variable")).toBe("my\\_variable");
  });

  it("should escape braces", () => {
    expect(escapeLatex("{value}")).toBe("\\{value\\}");
  });

  it("should escape tilde", () => {
    expect(escapeLatex("~approx")).toBe("\\textasciitilde{}approx");
  });

  it("should escape caret", () => {
    expect(escapeLatex("x^2")).toBe("x\\textasciicircum{}2");
  });

  it("should escape backslash", () => {
    expect(escapeLatex("path\\to")).toBe("path\\textbackslash{}to");
  });

  it("should handle multiple special characters", () => {
    expect(escapeLatex("100% of $5 & #1")).toBe("100\\% of \\$5 \\& \\#1");
  });

  it("should leave normal text unchanged", () => {
    expect(escapeLatex("Dr. Sharma")).toBe("Dr. Sharma");
  });

  it("should handle empty string", () => {
    expect(escapeLatex("")).toBe("");
  });
});

describe("normaliseUnicode", () => {
  it("should convert smart quotes to LaTeX equivalents", () => {
    expect(normaliseUnicode("\u201CHello\u201D")).toBe("``Hello''");
    expect(normaliseUnicode("\u2018it\u2019s\u2019")).toBe("`it's'");
  });

  it("should convert em-dash and en-dash", () => {
    expect(normaliseUnicode("A\u2014B")).toBe("A---B");
    expect(normaliseUnicode("2020\u20132024")).toBe("2020--2024");
  });

  it("should convert ellipsis", () => {
    expect(normaliseUnicode("and so on\u2026")).toBe("and so on\\ldots{}");
  });

  it("should convert non-breaking space", () => {
    expect(normaliseUnicode("Dr.\u00A0Sharma")).toBe("Dr.~Sharma");
  });

  it("should convert degree and plus-minus", () => {
    expect(normaliseUnicode("37\u00B0C")).toBe("37\\textdegree{}C");
    expect(normaliseUnicode("\u00B10.5")).toBe("\\textpm{}0.5");
  });

  it("should convert comparison operators", () => {
    expect(normaliseUnicode("p \u2264 0.05")).toBe("p \\leq{} 0.05");
    expect(normaliseUnicode("n \u2265 100")).toBe("n \\geq{} 100");
  });

  it("should leave ASCII text unchanged", () => {
    expect(normaliseUnicode("Hello world")).toBe("Hello world");
  });
});

describe("escapeLatex — unicode integration", () => {
  it("should normalise unicode then escape special chars", () => {
    expect(escapeLatex("\u201CHello & world\u201D")).toBe("``Hello \\& world''");
  });

  it("should handle em-dash without double-escaping", () => {
    expect(escapeLatex("A\u2014B")).toBe("A---B");
  });
});

describe("escapeLatexArg", () => {
  it("should normalise whitespace and escape", () => {
    expect(escapeLatexArg("  Dr.  Sharma  ")).toBe("Dr. Sharma");
  });

  it("should strip newlines", () => {
    expect(escapeLatexArg("Line 1\nLine 2")).toBe("Line 1 Line 2");
  });
});
