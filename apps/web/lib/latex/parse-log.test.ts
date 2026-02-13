import { describe, it, expect } from "vitest";
import { parseLatexLog } from "./parse-log";

describe("parseLatexLog", () => {
  it("should detect blocking errors", () => {
    const log = `
This is pdfTeX, Version 3.14
! Undefined control sequence.
l.42 \\invalidcommand
    `;
    const result = parseLatexLog(log);
    expect(result.errorCount).toBe(1);
    expect(result.errors[0]).toContain("Undefined control sequence");
  });

  it("should detect Fatal error", () => {
    const log = "Fatal error occurred, no output PDF file produced!";
    const result = parseLatexLog(log);
    expect(result.errorCount).toBe(1);
  });

  it("should detect Emergency stop", () => {
    const log = "! Emergency stop.";
    const result = parseLatexLog(log);
    expect(result.errorCount).toBe(1);
  });

  it("should detect Missing $ inserted", () => {
    const log = "! Missing $ inserted.";
    const result = parseLatexLog(log);
    expect(result.errorCount).toBe(1);
  });

  it("should detect overfull hbox warnings", () => {
    const log = `
Overfull \\hbox (3.14pt too wide) in paragraph at lines 10--15
Overfull \\hbox (1.5pt too wide) in paragraph at lines 20--25
    `;
    const result = parseLatexLog(log);
    expect(result.warningCount).toBe(2);
    expect(result.errorCount).toBe(0);
  });

  it("should detect underfull hbox warnings", () => {
    const log = "Underfull \\hbox (badness 10000) in paragraph at lines 5--10";
    const result = parseLatexLog(log);
    expect(result.warningCount).toBe(1);
  });

  it("should detect font warnings", () => {
    const log = "Font shape `OT1/cmr/m/n' undefined";
    const result = parseLatexLog(log);
    expect(result.warningCount).toBe(1);
  });

  it("should detect LaTeX warnings", () => {
    const log = "LaTeX Warning: Reference `fig:test' on page 5 undefined";
    const result = parseLatexLog(log);
    expect(result.warningCount).toBe(1);
  });

  it("should deduplicate identical messages", () => {
    const log = `
Overfull \\hbox (3.14pt too wide) in paragraph at lines 10--15
Overfull \\hbox (3.14pt too wide) in paragraph at lines 10--15
    `;
    const result = parseLatexLog(log);
    expect(result.warningCount).toBe(1);
  });

  it("should return empty results for clean log", () => {
    const log = `
This is pdfTeX, Version 3.14
Output written on main.pdf (10 pages, 123456 bytes).
    `;
    const result = parseLatexLog(log);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it("should handle empty log", () => {
    const result = parseLatexLog("");
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });
});
