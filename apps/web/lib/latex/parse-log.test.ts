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

  // ── Structured errors ────────────────────────────────────────────────────

  describe("structuredErrors", () => {
    it("should extract line numbers from l.NNN", () => {
      const log = `
! Missing $ inserted.
<inserted text>
                $
l.47 Patients with BMI>30
                          kg/m2 had worse outcomes.
      `;
      const result = parseLatexLog(log);
      expect(result.structuredErrors).toHaveLength(1);
      expect(result.structuredErrors[0].message).toBe("Missing $ inserted");
      expect(result.structuredErrors[0].line).toBe(47);
      expect(result.structuredErrors[0].rawMessage).toBe("! Missing $ inserted.");
    });

    it("should extract line numbers for multiple errors", () => {
      const log = `
! Missing $ inserted.
<inserted text>
                $
l.47 Patients with BMI>30

! Undefined control sequence.
l.102 \\invalidcmd
                  some text
      `;
      const result = parseLatexLog(log);
      expect(result.structuredErrors).toHaveLength(2);
      expect(result.structuredErrors[0].line).toBe(47);
      expect(result.structuredErrors[1].line).toBe(102);
      expect(result.structuredErrors[1].message).toBe("Undefined control sequence");
    });

    it("should track file from parenthesis stack", () => {
      const log = `
(./main.tex
(./chapters/results.tex
! Missing $ inserted.
<inserted text>
                $
l.47 Patients with BMI>30
)
)
      `;
      const result = parseLatexLog(log);
      expect(result.structuredErrors).toHaveLength(1);
      expect(result.structuredErrors[0].file).toBe("chapters/results.tex");
      expect(result.structuredErrors[0].line).toBe(47);
    });

    it("should track file changes through the log", () => {
      const log = `
(./main.tex
(./chapters/introduction.tex)
(./chapters/results.tex
! Undefined control sequence.
l.15 \\badcmd
)
(./chapters/discussion.tex
! Missing $ inserted.
l.22 p<0.05
)
)
      `;
      const result = parseLatexLog(log);
      expect(result.structuredErrors).toHaveLength(2);
      expect(result.structuredErrors[0].file).toBe("chapters/results.tex");
      expect(result.structuredErrors[0].line).toBe(15);
      expect(result.structuredErrors[1].file).toBe("chapters/discussion.tex");
      expect(result.structuredErrors[1].line).toBe(22);
    });

    it("should handle errors without line numbers", () => {
      const log = `
! Emergency stop.
      `;
      const result = parseLatexLog(log);
      expect(result.structuredErrors).toHaveLength(1);
      expect(result.structuredErrors[0].message).toBe("Emergency stop");
      expect(result.structuredErrors[0].line).toBeUndefined();
    });

    it("should return empty structuredErrors for clean log", () => {
      const log = "Output written on main.pdf (10 pages).";
      const result = parseLatexLog(log);
      expect(result.structuredErrors).toHaveLength(0);
    });

    it("should extract line number when l.NNN is at end of line", () => {
      const log = `
! Missing $ inserted.
<inserted text>
                $
l.47
      `;
      const result = parseLatexLog(log);
      expect(result.structuredErrors).toHaveLength(1);
      expect(result.structuredErrors[0].line).toBe(47);
    });

    it("should demote non-fatal errors and not include in structuredErrors", () => {
      const log = `
! Font T1/cmr/m/n not loadable: metric file not found.
l.10 some text
      `;
      const result = parseLatexLog(log);
      expect(result.structuredErrors).toHaveLength(0);
      expect(result.warningCount).toBe(1);
    });
  });
});
