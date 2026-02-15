import { describe, it, expect } from "vitest";
import {
  splitBibtex,
  deduplicateBibEntries,
  stripTierDCitations,
  assembleThesisContent,
} from "./assemble";
import type { Project, Section, Citation } from "@/lib/types/database";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "test-id",
    user_id: "user-id",
    organisation_id: null,
    status: "sandbox",
    license_id: null,
    title: "Prevalence of Anaemia in Pregnancy",
    synopsis_text: null,
    study_type: "Cross-sectional",
    university_type: "wbuhs",
    metadata_json: {
      candidate_name: "Dr. Ananya Sharma",
      guide_name: "Prof (Dr.) Rajesh Kumar",
      hod_name: "Prof (Dr.) Sunil Das",
      department: "Department of Obstetrics & Gynaecology",
      degree: "M.D.",
      speciality: "Obstetrics & Gynaecology",
      registration_no: "MD/2024/001",
      session: "2024--2027",
      year: "2026",
    },
    current_phase: 2,
    phases_completed: [0, 1],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    id: "section-id",
    project_id: "test-id",
    phase_number: 2,
    phase_name: "introduction",
    latex_content: "\\section{Background}\nAnaemia is a common condition.",
    rich_content_json: null,
    ai_generated_latex: null,
    word_count: 50,
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
    bibtex_entry: "@article{smith2024,\n  author={Smith, J},\n  title={Test Article},\n  journal={Test},\n  year={2024}\n}",
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

// Minimal template that matches main.tex structure (with \input{chapters/xxx})
const TEMPLATE = `\\documentclass{sskm-thesis}
%\\documentclass{ssuhs-thesis}
\\thesistitle{[YOUR THESIS TITLE HERE]}
\\candidatename{Dr. [Your Name]}
\\registrationno{[Registration Number]}
\\supervisorname{Prof (Dr.) [Guide Name]}
\\hodname{Prof (Dr.) [HOD Name]}
\\departmentname{Department of [Your Specialty]}
\\degreename{[M.D.]}
\\degreebranch{[Specialty]}
\\academicsession{[Start Year]--[End Year]}
\\submissionyear{[Year]}
\\begin{document}
\\frontmatter
\\maketitlepage

\\mainmatter

\\chapter{Introduction}
\\label{chap:introduction}
\\input{chapters/introduction}

\\chapter{Aims and Objectives}
\\label{chap:aims}
\\input{chapters/aims}

\\chapter{Review of Literature}
\\label{chap:literature}
\\input{chapters/literature}

\\chapter{Materials and Methods}
\\label{chap:methodology}
\\input{chapters/methodology}

\\chapter{Results}
\\label{chap:results}
\\input{chapters/results}

\\chapter{Discussion}
\\label{chap:discussion}
\\input{chapters/discussion}

\\chapter{Conclusion}
\\label{chap:conclusion}
\\input{chapters/conclusion}

\\listoffigures
\\backmatter
\\bibliography{references}
\\annexurematter
\\end{document}`;

// ── splitBibtex ─────────────────────────────────────────────────────────────

describe("splitBibtex", () => {
  it("returns body only when no marker present", () => {
    const result = splitBibtex("\\section{Intro}\nSome text.");
    expect(result.body).toBe("\\section{Intro}\nSome text.");
    expect(result.bib).toBe("");
  });

  it("splits at ---BIBTEX--- marker", () => {
    const input = `\\section{Intro}
Some text.

---BIBTEX---
@article{smith2024,
  author={Smith, J},
  title={Test},
  year={2024}
}`;
    const result = splitBibtex(input);
    expect(result.body).toBe("\\section{Intro}\nSome text.");
    expect(result.bib).toContain("@article{smith2024,");
    expect(result.bib).not.toContain("---BIBTEX---");
  });

  it("handles marker with no bib content after it", () => {
    const result = splitBibtex("Content here\n---BIBTEX---\n");
    expect(result.body).toBe("Content here");
    expect(result.bib).toBe("");
  });

  it("handles empty input", () => {
    const result = splitBibtex("");
    expect(result.body).toBe("");
    expect(result.bib).toBe("");
  });
});

// ── deduplicateBibEntries ───────────────────────────────────────────────────

describe("deduplicateBibEntries", () => {
  it("returns empty string for empty input", () => {
    expect(deduplicateBibEntries("")).toBe("");
    expect(deduplicateBibEntries("   ")).toBe("");
  });

  it("passes through single entry unchanged", () => {
    const entry = `@article{smith2024,
  author={Smith, J},
  title={Test},
  year={2024}
}`;
    const result = deduplicateBibEntries(entry);
    expect(result).toContain("@article{smith2024,");
    expect(result).toContain("author={Smith, J}");
  });

  it("deduplicates by cite key (last-write-wins)", () => {
    const input = `@article{smith2024,
  author={Smith, J},
  title={Old Title},
  year={2024}
}

@article{smith2024,
  author={Smith, John},
  title={New Title},
  year={2024}
}`;
    const result = deduplicateBibEntries(input);
    expect(result).toContain("New Title");
    expect(result).not.toContain("Old Title");
    expect(result.match(/@article\{smith2024,/g)?.length).toBe(1);
  });

  it("keeps distinct entries", () => {
    const input = `@article{smith2024,
  author={Smith, J},
  title={First},
  year={2024}
}

@article{jones2023,
  author={Jones, A},
  title={Second},
  year={2023}
}`;
    const result = deduplicateBibEntries(input);
    expect(result).toContain("@article{smith2024,");
    expect(result).toContain("@article{jones2023,");
  });
});

// ── assembleThesisContent ───────────────────────────────────────────────────

describe("assembleThesisContent", () => {
  it("populates metadata and produces chapter file for single section", () => {
    const project = makeProject();
    const sections = [
      makeSection({
        phase_number: 2,
        latex_content: "Anaemia is a common condition in pregnancy.",
        status: "approved",
      }),
    ];

    const { tex, chapterFiles, warnings } = assembleThesisContent(TEMPLATE, project, sections, []);

    // Metadata populated
    expect(tex).toContain("\\thesistitle{Prevalence of Anaemia in Pregnancy}");
    // Chapter file produced (content passes through tiptap round-trip in fallback)
    expect(chapterFiles["chapters/introduction.tex"]).toContain(
      "Anaemia is a common condition in pregnancy."
    );
    // Other phases produce warnings
    expect(warnings.some((w) => w.includes("Phase 3"))).toBe(true);
  });

  it("produces chapter files for all phases 2-8", () => {
    const project = makeProject();
    // Use realistic LaTeX content (no underscores) since fallback path
    // runs tiptap round-trip which escapes special chars
    const sections = [
      makeSection({ phase_number: 2, latex_content: "Introduction content here.", status: "approved" }),
      makeSection({ id: "s3", phase_number: 3, latex_content: "Aims content here.", status: "approved" }),
      makeSection({ id: "s4", phase_number: 4, latex_content: "Literature content here.", status: "review" }),
      makeSection({ id: "s5", phase_number: 5, latex_content: "Methods content here.", status: "approved" }),
      makeSection({ id: "s6", phase_number: 6, latex_content: "Results content here.", status: "approved" }),
      makeSection({ id: "s7", phase_number: 7, latex_content: "Discussion content here.", status: "approved" }),
      makeSection({ id: "s8", phase_number: 8, latex_content: "Conclusion content here.", status: "approved" }),
    ];

    const { chapterFiles, warnings } = assembleThesisContent(TEMPLATE, project, sections, []);

    expect(chapterFiles["chapters/introduction.tex"]).toContain("Introduction content here.");
    expect(chapterFiles["chapters/aims.tex"]).toContain("Aims content here.");
    expect(chapterFiles["chapters/literature.tex"]).toContain("Literature content here.");
    expect(chapterFiles["chapters/methodology.tex"]).toContain("Methods content here.");
    expect(chapterFiles["chapters/results.tex"]).toContain("Results content here.");
    expect(chapterFiles["chapters/discussion.tex"]).toContain("Discussion content here.");
    expect(chapterFiles["chapters/conclusion.tex"]).toContain("Conclusion content here.");
    // No missing-phase warnings for 2-8
    expect(warnings.filter((w) => w.includes("no approved/review content")).length).toBe(0);
  });

  it("uses tiptapToLatex(rich_content_json) when available — escapes #", () => {
    const project = makeProject();
    const sections = [
      makeSection({
        phase_number: 2,
        latex_content: "# Introduction\nRaw latex with # chars",
        rich_content_json: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Introduction with # properly escaped" },
              ],
            },
          ],
        },
        status: "approved",
      }),
    ];

    const { chapterFiles } = assembleThesisContent(TEMPLATE, project, sections, []);

    // tiptapToLatex escapes # → \#
    expect(chapterFiles["chapters/introduction.tex"]).toContain("\\#");
    // Should NOT contain raw markdown heading
    expect(chapterFiles["chapters/introduction.tex"]).not.toContain("# Introduction");
  });

  it("falls back to latex_content when rich_content_json is null (with round-trip)", () => {
    const project = makeProject();
    const sections = [
      makeSection({
        phase_number: 2,
        latex_content: "\\section{Background}\nFallback content.",
        rich_content_json: null,
        status: "approved",
      }),
    ];

    const { chapterFiles } = assembleThesisContent(TEMPLATE, project, sections, []);

    // Fallback path runs tiptap round-trip: heading + paragraph preserved
    expect(chapterFiles["chapters/introduction.tex"]).toContain("\\section{Background}");
    expect(chapterFiles["chapters/introduction.tex"]).toContain("Fallback content.");
  });

  it("extracts BibTeX from ai_generated_latex (not latex_content)", () => {
    const project = makeProject();
    const sections = [
      makeSection({
        phase_number: 2,
        // User edited latex_content — BibTeX trailer was lost
        latex_content: "User edited clean content without bibtex trailer.",
        rich_content_json: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "User edited clean content." }],
            },
          ],
        },
        // ai_generated_latex preserves the original AI output with BibTeX
        ai_generated_latex: `Original AI content.

---BIBTEX---
@article{smith2024,
  author={Smith, J},
  title={From AI Generated},
  year={2024}
}`,
        status: "approved",
      }),
    ];

    const { bib } = assembleThesisContent(TEMPLATE, project, sections, []);

    expect(bib).toContain("@article{smith2024,");
    expect(bib).toContain("From AI Generated");
  });

  it("collects BibTeX from citations table", () => {
    const project = makeProject();
    const citations = [
      makeCitation({
        cite_key: "jones2023",
        bibtex_entry: "@article{jones2023,\n  author={Jones, A},\n  title={Citation Table Entry},\n  year={2023}\n}",
      }),
    ];

    const { bib } = assembleThesisContent(TEMPLATE, project, [], citations);

    expect(bib).toContain("@article{jones2023,");
    expect(bib).toContain("Citation Table Entry");
  });

  it("deduplicates BibTeX: citations table wins over section trailer", () => {
    const project = makeProject();
    const sections = [
      makeSection({
        phase_number: 2,
        latex_content: "Text.",
        ai_generated_latex: `Text \\cite{smith2024}.

---BIBTEX---
@article{smith2024,
  author={Smith, J},
  title={AI Generated Version},
  year={2024}
}`,
        status: "approved",
      }),
    ];
    const citations = [
      makeCitation({
        cite_key: "smith2024",
        bibtex_entry: "@article{smith2024,\n  author={Smith, John},\n  title={Citation Table Version},\n  year={2024}\n}",
      }),
    ];

    const { bib } = assembleThesisContent(TEMPLATE, project, sections, citations);

    // Citations table entries come after section trailers → last-write-wins
    expect(bib).toContain("Citation Table Version");
    expect(bib).not.toContain("AI Generated Version");
  });

  it("missing chapters produce empty files (not errors)", () => {
    const project = makeProject();
    const { chapterFiles, warnings } = assembleThesisContent(TEMPLATE, project, [], []);

    // All chapter files should exist (as empty strings)
    expect(chapterFiles["chapters/introduction.tex"]).toBe("");
    expect(chapterFiles["chapters/aims.tex"]).toBe("");
    expect(chapterFiles["chapters/literature.tex"]).toBe("");
    expect(chapterFiles["chapters/methodology.tex"]).toBe("");
    expect(chapterFiles["chapters/results.tex"]).toBe("");
    expect(chapterFiles["chapters/discussion.tex"]).toBe("");
    expect(chapterFiles["chapters/conclusion.tex"]).toBe("");
    // Should have warnings for each missing phase
    expect(warnings.filter((w) => w.includes("no approved/review content")).length).toBe(7);
  });

  it("does not produce chapter files for phase 0 or phase 1", () => {
    const project = makeProject();
    const sections = [
      makeSection({
        phase_number: 0,
        phase_name: "orientation",
        latex_content: "ORIENTATION_CONTENT",
        status: "approved",
      }),
      makeSection({
        id: "s1",
        phase_number: 1,
        phase_name: "front_matter",
        latex_content: "FRONT_MATTER_CONTENT",
        status: "approved",
      }),
    ];

    const { chapterFiles } = assembleThesisContent(TEMPLATE, project, sections, []);

    // No chapter file should contain phase 0/1 content
    for (const content of Object.values(chapterFiles)) {
      expect(content).not.toContain("ORIENTATION_CONTENT");
      expect(content).not.toContain("FRONT_MATTER_CONTENT");
    }
  });

  it("prefers approved sections over review sections", () => {
    const project = makeProject();
    const sections = [
      makeSection({
        id: "s2-review",
        phase_number: 2,
        latex_content: "Review version content.",
        status: "review",
      }),
      makeSection({
        id: "s2-approved",
        phase_number: 2,
        latex_content: "Approved version content.",
        status: "approved",
      }),
    ];

    const { chapterFiles } = assembleThesisContent(TEMPLATE, project, sections, []);

    expect(chapterFiles["chapters/introduction.tex"]).toContain("Approved version content.");
  });

  it("main.tex still contains \\input directives (not inline content)", () => {
    const project = makeProject();
    const sections = [
      makeSection({
        phase_number: 2,
        latex_content: "Some introduction content.",
        status: "approved",
      }),
    ];

    const { tex } = assembleThesisContent(TEMPLATE, project, sections, []);

    // main.tex should still have \input directives
    expect(tex).toContain("\\input{chapters/introduction}");
    // Content goes to chapter files, NOT inline in main.tex
    expect(tex).not.toContain("Some introduction content.");
  });

  it("strips Tier D \\cite{key} from chapter bodies and replaces with comment", () => {
    const project = makeProject();
    const sections = [
      makeSection({
        phase_number: 2,
        latex_content:
          "Anaemia is common\\cite{verified2024}. Some claim\\cite{unverified2024} otherwise.",
        rich_content_json: null,
        status: "approved",
      }),
    ];
    const citations = [
      makeCitation({
        cite_key: "verified2024",
        provenance_tier: "A",
        bibtex_entry: "@article{verified2024, title={Verified}}",
      }),
      makeCitation({
        id: "c2",
        cite_key: "unverified2024",
        provenance_tier: "D",
        bibtex_entry: "@article{unverified2024, title={Unverified}}",
      }),
    ];

    const { chapterFiles, bib, warnings } = assembleThesisContent(
      TEMPLATE,
      project,
      sections,
      citations
    );

    const intro = chapterFiles["chapters/introduction.tex"];
    // Tier A citation preserved
    expect(intro).toContain("\\cite{verified2024}");
    // Tier D citation stripped → comment
    expect(intro).not.toContain("\\cite{unverified2024}");
    expect(intro).toContain("% UNRESOLVED: unverified2024");
    // Warning emitted
    expect(warnings.some((w) => w.includes("stripped Tier D"))).toBe(true);
    // Tier D BibTeX excluded from output
    expect(bib).toContain("verified2024");
    expect(bib).not.toContain("unverified2024");
  });

  it("excludes Tier D BibTeX entries from final output", () => {
    const project = makeProject();
    const citations = [
      makeCitation({
        cite_key: "good",
        provenance_tier: "A",
        bibtex_entry: "@article{good, title={Good}}",
      }),
      makeCitation({
        id: "c2",
        cite_key: "bad",
        provenance_tier: "D",
        bibtex_entry: "@article{bad, title={Bad}}",
      }),
    ];

    const { bib } = assembleThesisContent(TEMPLATE, project, [], citations);

    expect(bib).toContain("@article{good,");
    expect(bib).not.toContain("@article{bad,");
  });
});

// ── stripTierDCitations ─────────────────────────────────────────────────────

describe("stripTierDCitations", () => {
  it("replaces single Tier D \\cite{key} with comment", () => {
    const tierD = new Set(["unverified2024"]);
    const { stripped, replacedKeys } = stripTierDCitations(
      "Some text\\cite{unverified2024} more text.",
      tierD
    );
    expect(stripped).toContain("% UNRESOLVED: unverified2024");
    expect(stripped).not.toContain("\\cite{unverified2024}");
    expect(replacedKeys).toEqual(["unverified2024"]);
  });

  it("keeps non-Tier-D keys in mixed \\cite{a,b} commands", () => {
    const tierD = new Set(["bad"]);
    const { stripped } = stripTierDCitations(
      "Text\\cite{good, bad} end.",
      tierD
    );
    expect(stripped).toContain("\\cite{good}");
    expect(stripped).toContain("% UNRESOLVED: bad");
    expect(stripped).not.toContain("\\cite{good, bad}");
  });

  it("returns unchanged when no Tier D keys", () => {
    const tierD = new Set<string>();
    const input = "Text\\cite{smith2024} end.";
    const { stripped, replacedKeys } = stripTierDCitations(input, tierD);
    expect(stripped).toBe(input);
    expect(replacedKeys).toHaveLength(0);
  });

  it("handles multiple \\cite{} commands in same text", () => {
    const tierD = new Set(["d1", "d2"]);
    const { stripped, replacedKeys } = stripTierDCitations(
      "First\\cite{d1}. Second\\cite{good}. Third\\cite{d2}.",
      tierD
    );
    expect(stripped).not.toContain("\\cite{d1}");
    expect(stripped).not.toContain("\\cite{d2}");
    expect(stripped).toContain("\\cite{good}");
    expect(replacedKeys).toEqual(["d1", "d2"]);
  });
});
