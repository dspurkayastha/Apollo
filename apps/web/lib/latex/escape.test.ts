import { describe, it, expect } from "vitest";
import { escapeLatex, escapeLatexArg } from "./escape";

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

describe("escapeLatexArg", () => {
  it("should normalise whitespace and escape", () => {
    expect(escapeLatexArg("  Dr.  Sharma  ")).toBe("Dr. Sharma");
  });

  it("should strip newlines", () => {
    expect(escapeLatexArg("Line 1\nLine 2")).toBe("Line 1 Line 2");
  });
});
