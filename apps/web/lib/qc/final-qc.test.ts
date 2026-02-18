import { describe, it, expect } from "vitest";
import { finalQC } from "./final-qc";
import type { Section, Citation } from "@/lib/types/database";

function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    id: "section-id",
    project_id: "test-id",
    phase_number: 2,
    phase_name: "introduction",
    latex_content: "\\section{Background}\nAnaemia is a common condition.",
    rich_content_json: null,
    ai_generated_latex: null,
    streaming_content: "",
    word_count: 500,
    citation_keys: [],
    status: "approved",
    ai_conversation_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeCitation(overrides: Partial<Citation> = {}): Citation {
  return {
    id: "citation-id",
    project_id: "test-id",
    cite_key: "smith2024",
    bibtex_entry: "@article{smith2024, author={Smith}, title={Test}, year={2024}}",
    provenance_tier: "A",
    evidence_type: "doi",
    evidence_value: "10.1000/test",
    source_doi: "10.1000/test",
    source_pmid: null,
    attested_by_user_id: null,
    attested_at: null,
    used_in_sections: ["introduction"],
    serial_number: 1,
    verified_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// Minimal sections covering phases 2-8 with content
function makeMinimalSections(): Section[] {
  // M&M needs >= 12 section headings for NBEMS compliance
  const mmHeadings = Array.from({ length: 12 }, (_, i) =>
    `\\subsection{Section ${i + 1}}\n${"word ".repeat(150)}`
  ).join("\n");
  const mmContent = `\\section{Materials and Methods}\n${mmHeadings}`;

  const phases: [number, string, string][] = [
    [2, "introduction", `\\section{Introduction}\n${"word ".repeat(1100)}`],
    [3, "aims", `\\section{Aims}\n${"word ".repeat(350)}`],
    [4, "literature", `\\section{Literature}\n${"word ".repeat(3600)}`],
    [5, "methodology", mmContent],
    [6, "results", `\\section{Results}\n${"word ".repeat(2000)}`],
    [7, "discussion", `\\section{Discussion}\n${"word ".repeat(2200)}`],
    [8, "conclusion", `\\section{Conclusion}\n${"word ".repeat(600)}`],
  ];
  return phases.map(([phase, name, content]) =>
    makeSection({
      id: `s${phase}`,
      phase_number: phase,
      phase_name: name,
      latex_content: content,
      word_count: content.split(/\s+/).length,
    }),
  );
}

describe("checkUndefinedReferences", () => {
  it("returns fail when compile log is null", () => {
    const report = finalQC(makeMinimalSections(), [], null, 5, 7);
    const check = report.checks.find((c) => c.name === "undefined-references");
    expect(check).toBeDefined();
    expect(check!.status).toBe("fail");
    expect(check!.blocking).toBe(true);
    expect(check!.message).toContain("No compile log available");
  });

  it("returns pass when log has no warnings", () => {
    const cleanLog = `
This is pdfTeX, Version 3.14159265
Output written on main.pdf (42 pages, 1234567 bytes).
Transcript written on main.log.
`;
    const report = finalQC(makeMinimalSections(), [], cleanLog, 5, 7);
    const check = report.checks.find((c) => c.name === "undefined-references");
    expect(check!.status).toBe("pass");
  });

  it("returns fail when log has undefined reference warnings", () => {
    const log = `
LaTeX Warning: Reference \`fig:missing' on page 12
LaTeX Warning: Citation \`unknown2024' on page 5
`;
    const report = finalQC(makeMinimalSections(), [], log, 5, 7);
    const check = report.checks.find((c) => c.name === "undefined-references");
    expect(check!.status).toBe("fail");
    expect(check!.details.length).toBe(2);
  });
});

describe("finalQC", () => {
  it("returns overallPass: false when any blocking check fails", () => {
    // No compile log → undefined-references fails (blocking)
    const report = finalQC(makeMinimalSections(), [], null, 5, 7);
    expect(report.overallPass).toBe(false);
    expect(report.blockingCount).toBeGreaterThanOrEqual(1);
  });

  it("returns overallPass: true with only warnings", () => {
    const cleanLog = "Output written on main.pdf (42 pages).";
    const sections = makeMinimalSections();
    const citations = [makeCitation()];

    const report = finalQC(sections, citations, cleanLog, 5, 7);
    expect(report.overallPass).toBe(true);
    expect(report.blockingCount).toBe(0);
  });

  it("runs all 6 quality checks", () => {
    const report = finalQC(makeMinimalSections(), [], "", 5, 7);
    expect(report.checks.length).toBe(6);
    const names = report.checks.map((c) => c.name);
    expect(names).toContain("citation-provenance");
    expect(names).toContain("section-completeness");
    expect(names).toContain("british-english");
    expect(names).toContain("nbems-compliance");
    expect(names).toContain("undefined-references");
    expect(names).toContain("results-figures-tables");
  });

  it("detects British English issues using shared dictionary", () => {
    const sections = makeMinimalSections();
    // Inject American spelling into a section
    sections[0] = makeSection({
      id: "s2",
      phase_number: 2,
      phase_name: "introduction",
      latex_content: "The patient was hospitalized and treated with estrogen therapy.",
      word_count: 600,
    });

    const report = finalQC(sections, [], "", 5, 7);
    const check = report.checks.find((c) => c.name === "british-english");
    expect(check!.status).toBe("warn");
    expect(check!.details.length).toBeGreaterThanOrEqual(1);
  });

  it("fails results-figures-tables when below minimums", () => {
    const report = finalQC(makeMinimalSections(), [], "", 2, 3);
    const check = report.checks.find((c) => c.name === "results-figures-tables");
    expect(check!.status).toBe("fail");
    expect(check!.blocking).toBe(true);
  });
});
