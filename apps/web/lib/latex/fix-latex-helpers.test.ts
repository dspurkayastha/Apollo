import { describe, it, expect } from "vitest";
import {
  extractErrorContexts,
  buildTargetedUserMessage,
  parseFixResponse,
  applyLineFixes,
} from "./fix-latex-helpers";
import type { LatexErrorDetail } from "./parse-log";

// ── Helper to build error details ───────────────────────────────────────────

function makeError(
  message: string,
  line?: number,
  file?: string
): LatexErrorDetail {
  return {
    message,
    line,
    file,
    rawMessage: `! ${message}.`,
  };
}

// ── extractErrorContexts ────────────────────────────────────────────────────

describe("extractErrorContexts", () => {
  const sampleContent = Array.from(
    { length: 20 },
    (_, i) => `Line ${i + 1} content`
  ).join("\n");

  it("should extract context window around an error", () => {
    const errors = [makeError("Missing $ inserted", 10)];
    const contexts = extractErrorContexts(sampleContent, errors);

    expect(contexts).toHaveLength(1);
    expect(contexts[0].startLine).toBe(5); // 10 - 5
    expect(contexts[0].endLine).toBe(15); // 10 + 5
    expect(contexts[0].lines).toHaveLength(11); // 5..15
    expect(contexts[0].lines[0]).toEqual([5, "Line 5 content"]);
    expect(contexts[0].lines[5]).toEqual([10, "Line 10 content"]);
  });

  it("should clamp at beginning of file", () => {
    const errors = [makeError("Missing $ inserted", 2)];
    const contexts = extractErrorContexts(sampleContent, errors);

    expect(contexts).toHaveLength(1);
    expect(contexts[0].startLine).toBe(1);
    expect(contexts[0].endLine).toBe(7);
  });

  it("should clamp at end of file", () => {
    const errors = [makeError("Missing $ inserted", 19)];
    const contexts = extractErrorContexts(sampleContent, errors);

    expect(contexts).toHaveLength(1);
    expect(contexts[0].startLine).toBe(14);
    expect(contexts[0].endLine).toBe(20);
  });

  it("should merge overlapping windows", () => {
    const errors = [
      makeError("Missing $ inserted", 8),
      makeError("Undefined control sequence", 12),
    ];
    const contexts = extractErrorContexts(sampleContent, errors);

    // Windows: [3..13] and [7..17] → merged into [3..17]
    expect(contexts).toHaveLength(1);
    expect(contexts[0].startLine).toBe(3);
    expect(contexts[0].endLine).toBe(17);
  });

  it("should keep separate non-overlapping windows", () => {
    const content = Array.from(
      { length: 100 },
      (_, i) => `Line ${i + 1}`
    ).join("\n");

    const errors = [
      makeError("Error A", 10),
      makeError("Error B", 90),
    ];
    const contexts = extractErrorContexts(content, errors);

    expect(contexts).toHaveLength(2);
    expect(contexts[0].startLine).toBe(5);
    expect(contexts[0].endLine).toBe(15);
    expect(contexts[1].startLine).toBe(85);
    expect(contexts[1].endLine).toBe(95);
  });

  it("should skip errors without line numbers", () => {
    const errors = [makeError("Emergency stop")]; // no line number
    const contexts = extractErrorContexts(sampleContent, errors);
    expect(contexts).toHaveLength(0);
  });

  it("should skip errors with out-of-range line numbers", () => {
    const errors = [makeError("Missing $ inserted", 999)];
    const contexts = extractErrorContexts(sampleContent, errors);
    expect(contexts).toHaveLength(0);
  });
});

// ── buildTargetedUserMessage ────────────────────────────────────────────────

describe("buildTargetedUserMessage", () => {
  it("should build a message with error listing and context", () => {
    const content = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5";
    const errors = [makeError("Missing $ inserted", 3)];
    const contexts = extractErrorContexts(content, errors);
    const message = buildTargetedUserMessage(contexts, errors);

    expect(message).toContain("ERRORS TO FIX:");
    expect(message).toContain("! Missing $ inserted.");
    expect(message).toContain("(line 3)");
    expect(message).toContain("3| Line 3");
    // Error line should be marked with >>>
    expect(message).toContain(">>> 3| Line 3");
  });
});

// ── parseFixResponse ────────────────────────────────────────────────────────

describe("parseFixResponse", () => {
  it("should parse valid line fixes", () => {
    const response = `47| Patients with $BMI>30$ kg/m$^2$ had worse outcomes ($p<0.001$).
102| Some other \\textbf{fixed} content.`;

    const fixes = parseFixResponse(response);
    expect(fixes).not.toBeNull();
    expect(fixes).toHaveLength(2);
    expect(fixes![0].lineNumber).toBe(47);
    expect(fixes![0].content).toBe(
      "Patients with $BMI>30$ kg/m$^2$ had worse outcomes ($p<0.001$)."
    );
    expect(fixes![1].lineNumber).toBe(102);
  });

  it("should handle NO_CHANGES_NEEDED", () => {
    const fixes = parseFixResponse("NO_CHANGES_NEEDED");
    expect(fixes).toEqual([]);
  });

  it("should skip commentary lines and blank lines", () => {
    const response = `Here are the fixes:

47| Fixed line content.

That should resolve the error.`;

    const fixes = parseFixResponse(response);
    expect(fixes).not.toBeNull();
    expect(fixes).toHaveLength(1);
    expect(fixes![0].lineNumber).toBe(47);
  });

  it("should return null for completely unparseable response", () => {
    const response = `I've analyzed the LaTeX code and here is the complete fixed version:

\\section{Introduction}
This is the introduction chapter...`;

    const fixes = parseFixResponse(response);
    expect(fixes).toBeNull();
  });

  it("should handle single line fix", () => {
    const fixes = parseFixResponse("47| $p < 0.05$");
    expect(fixes).not.toBeNull();
    expect(fixes).toHaveLength(1);
    expect(fixes![0].lineNumber).toBe(47);
    expect(fixes![0].content).toBe("$p < 0.05$");
  });

  it("should handle line with empty content after pipe", () => {
    const fixes = parseFixResponse("47| ");
    expect(fixes).not.toBeNull();
    expect(fixes).toHaveLength(1);
    expect(fixes![0].content).toBe("");
  });
});

// ── applyLineFixes ──────────────────────────────────────────────────────────

describe("applyLineFixes", () => {
  const original = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5";

  it("should replace a single line", () => {
    const result = applyLineFixes(original, [
      { lineNumber: 3, content: "Fixed Line 3" },
    ]);
    expect(result).toBe("Line 1\nLine 2\nFixed Line 3\nLine 4\nLine 5");
  });

  it("should replace multiple lines", () => {
    const result = applyLineFixes(original, [
      { lineNumber: 1, content: "Fixed 1" },
      { lineNumber: 5, content: "Fixed 5" },
    ]);
    expect(result).toBe("Fixed 1\nLine 2\nLine 3\nLine 4\nFixed 5");
  });

  it("should return original if no fixes", () => {
    const result = applyLineFixes(original, []);
    expect(result).toBe(original);
  });

  it("should ignore out-of-range line numbers", () => {
    const result = applyLineFixes(original, [
      { lineNumber: 99, content: "Should be ignored" },
    ]);
    expect(result).toBe(original);
  });

  it("should handle last-write-wins for duplicate line numbers", () => {
    const result = applyLineFixes(original, [
      { lineNumber: 3, content: "First fix" },
      { lineNumber: 3, content: "Second fix" },
    ]);
    expect(result).toBe("Line 1\nLine 2\nSecond fix\nLine 4\nLine 5");
  });
});
