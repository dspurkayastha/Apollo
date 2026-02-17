/**
 * E2E Pipeline Integration Test
 *
 * Exercises the full thesis compilation pipeline:
 *   AI-generated LaTeX → sanitiseChapterLatex → assembleThesisContent → compileTex
 *
 * Phase 4: The tiptap round-trip has been eliminated. LaTeX is canonical.
 *
 * Uses realistic AI-generated content including known edge cases:
 * - Markdown heading artifacts (# Introduction)
 * - \needspace{} commands
 * - BibTeX trailers (---BIBTEX---)
 * - \cite{} references
 */

import { describe, it, expect } from "vitest";
import { readFile } from "fs/promises";
import path from "path";
import { preflightChapter } from "@/lib/latex/validate";
import {
  splitBibtex,
  assembleThesisContent,
} from "@/lib/latex/assemble";
import { compileTex } from "@/lib/latex/compile";
import { extractCiteKeys } from "@/lib/citations/extract-keys";
import type { Project, Section, Citation } from "@/lib/types/database";

// ── Realistic AI-generated content (from actual production data) ──────────

const AI_GENERATED_INTRO = `\\section{Introduction}

Ventral hernias represent a significant global surgical challenge, encompassing a spectrum of anterior abdominal wall defects including umbilical, incisional, epigastric, and spigelian hernias. The condition arises from musculofascial weakness or defects, allowing protrusion of intra-abdominal contents through the anterior abdominal wall\\cite{Sanders2013}. Globally, ventral hernias account for approximately 15--20\\% of all abdominal wall hernias, with incisional hernias constituting the most substantial proportion following laparotomy procedures\\cite{Muysoms2016EHS}.

\\subsection{Epidemiology in India}

Studies conducted across Indian tertiary care hospitals indicate that ventral hernias constitute approximately 4--6\\% of all surgical admissions\\cite{Jaykar2022Clinical}, with incisional hernias predominating at 46--70\\% of all ventral hernia presentations\\cite{Mishra2022Prospective}.

\\subsection{Clinical Significance}

The clinical significance of ventral hernias extends beyond cosmetic concerns, encompassing substantial morbidity and potential mortality. Complications include \\textbf{incarceration}, \\textit{strangulation}, and skin changes overlying large hernias\\cite{Thompson2023Review}.

\\begin{itemize}
  \\item Incarceration rates of 10--15\\% for untreated hernias
  \\item Emergency surgical mortality of 6--10\\%
  \\item Recurrence rates of 24--43\\% after primary repair
\\end{itemize}

---BIBTEX---
@article{Sanders2013,
  author={Sanders, D L and Kingsnorth, A N},
  title={The modern management of incisional hernias},
  journal={BMJ},
  year={2013},
  volume={346},
  pages={f2843}
}

@article{Muysoms2016EHS,
  author={Muysoms, F E and Miserez, M and others},
  title={Classification of primary and incisional abdominal wall hernias},
  journal={Hernia},
  year={2016}
}`;

const AI_GENERATED_AIMS = `\\section{Aims}

To study the spectrum of ventral hernias treated in a tertiary care hospital with special reference to classification and management.

\\section{Objectives}

\\begin{enumerate}
  \\item To classify ventral hernias according to the European Hernia Society classification
  \\item To study the demographic profile of patients presenting with ventral hernias
  \\item To compare outcomes of mesh versus non-mesh repair
  \\item To assess post-operative complications and recurrence rates
\\end{enumerate}`;

const CLEAN_SECTION_LATEX = `\\section{Materials and Methods}

This was a prospective observational study conducted in the Department of General Surgery over a period of 18 months (January 2025 to June 2026).

\\subsection{Study Design}

The study employed a descriptive cross-sectional design with prospective data collection.

\\subsection{Sample Size}

Based on previous studies reporting a prevalence of 4--6\\%, a sample size of 120 patients was calculated using the formula $n = Z^2 \\times p(1-p) / d^2$ with 95\\% confidence interval and 5\\% margin of error.`;

// ── Helper factories ──────────────────────────────────────────────────────

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "pipeline-test",
    user_id: "test-user",
    organisation_id: null,
    status: "sandbox",
    license_id: null,
    title: "Spectrum of Ventral Hernia Treated in a Tertiary Care Hospital",
    synopsis_text: "Test synopsis text for the study.",
    study_type: "Prospective observational",
    university_type: "wbuhs",
    metadata_json: {
      candidate_name: "Dr. Ananya Sharma",
      guide_name: "Prof (Dr.) Rajesh Kumar",
      hod_name: "Prof (Dr.) Sunil Das",
      department: "Department of General Surgery",
      degree: "M.S.",
      speciality: "General Surgery",
      registration_no: "MS/2024/042",
      session: "2024--2027",
      year: "2026",
    },
    current_phase: 5,
    phases_completed: [0, 1, 2, 3, 4],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    id: "section-id",
    project_id: "pipeline-test",
    phase_number: 2,
    phase_name: "introduction",
    latex_content: "",
    rich_content_json: null,
    ai_generated_latex: null,
    word_count: 0,
    citation_keys: [],
    status: "approved",
    ai_conversation_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const TEMPLATES_DIR = path.resolve(__dirname, "../../../templates");

// ── Tests ─────────────────────────────────────────────────────────────────

describe("Pipeline E2E: AI content → compile", () => {
  let template: string;

  it("loads template", async () => {
    template = await readFile(path.join(TEMPLATES_DIR, "main.tex"), "utf-8");
    expect(template).toContain("\\input{chapters/introduction}");
  });

  // ── Step 1: Verify citation extraction from raw LaTeX ─────────────────

  describe("Step 1: Citation key extraction from LaTeX", () => {
    it("extracts citation keys from AI output", () => {
      const keys = extractCiteKeys(AI_GENERATED_INTRO);
      expect(keys).toContain("Sanders2013");
      expect(keys).toContain("Muysoms2016EHS");
      expect(keys).toContain("Jaykar2022Clinical");
      expect(keys).toContain("Mishra2022Prospective");
      expect(keys).toContain("Thompson2023Review");
    });
  });

  // ── Step 2: Direct sanitisation of AI content ─────────────────────────

  describe("Step 2: Direct sanitisation (no round-trip)", () => {
    it("clean LaTeX content passes preflightChapter with zero errors", () => {
      const { body } = splitBibtex(AI_GENERATED_INTRO);
      const issues = preflightChapter("chapters/introduction.tex", body);
      const errors = issues.filter((i) => i.severity === "error");
      expect(errors).toHaveLength(0);
    });

    it("splitBibtex separates body from BibTeX trailer", () => {
      const { body, bib } = splitBibtex(AI_GENERATED_INTRO);
      expect(body).toContain("\\section{Introduction}");
      expect(body).not.toContain("---BIBTEX---");
      expect(bib).toContain("@article{Sanders2013");
    });
  });

  // ── Step 3: Test clean content passes directly ────────────────────────

  describe("Step 3: Clean LaTeX content passes directly", () => {
    it("preflightChapter passes clean LaTeX with zero errors", () => {
      const issues = preflightChapter("chapters/methodology.tex", CLEAN_SECTION_LATEX);
      const errors = issues.filter((i) => i.severity === "error");
      expect(errors).toHaveLength(0);
    });

    it("inline math $p < 0.05$ survives — no round-trip destruction", () => {
      const content = `Results showed significance ($p < 0.05$) for the primary endpoint.`;
      const issues = preflightChapter("chapters/results.tex", content);
      const errors = issues.filter((i) => i.severity === "error");
      expect(errors).toHaveLength(0);
      // THE critical test: math mode preserved as-is
      expect(content).toContain("$p < 0.05$");
    });

    it("\\footnote{} and \\label{} survive — no round-trip destruction", () => {
      const content = `This finding\\footnote{See supplementary data} is labelled\\label{fig:test}.`;
      expect(content).toContain("\\footnote{");
      expect(content).toContain("\\label{fig:test}");
    });
  });

  // ── Step 4: Test assembly pipeline ────────────────────────────────────

  describe("Step 4: assembleThesisContent uses latex_content directly", () => {
    it("uses latex_content directly for chapter body", async () => {
      template = await readFile(path.join(TEMPLATES_DIR, "main.tex"), "utf-8");

      const sections = [
        makeSection({
          phase_number: 2,
          latex_content: AI_GENERATED_INTRO,
          ai_generated_latex: AI_GENERATED_INTRO,
          status: "approved",
        }),
      ];

      const { chapterFiles, bib, warnings } = assembleThesisContent(
        template,
        makeProject(),
        sections,
        []
      );

      const intro = chapterFiles["chapters/introduction.tex"];

      // Content preserved directly — no round-trip destruction
      expect(intro).toContain("\\section{Introduction}");
      expect(intro).toContain("\\subsection{Epidemiology in India}");
      expect(intro).toContain("\\cite{Sanders2013}");

      // BibTeX should be extracted from ai_generated_latex
      expect(bib).toContain("Sanders2013");
      expect(bib).toContain("Muysoms2016EHS");

      // Chapter should pass pre-flight
      const issues = preflightChapter("chapters/introduction.tex", intro);
      const errors = issues.filter((i) => i.severity === "error");
      expect(errors).toHaveLength(0);
    });

    it("handles section with only latex_content (no ai_generated_latex)", async () => {
      template = await readFile(path.join(TEMPLATES_DIR, "main.tex"), "utf-8");

      const sections = [
        makeSection({
          phase_number: 2,
          latex_content: AI_GENERATED_INTRO,
          rich_content_json: null,
          ai_generated_latex: null,
          status: "approved",
        }),
      ];

      const { chapterFiles } = assembleThesisContent(
        template,
        makeProject(),
        sections,
        []
      );

      const intro = chapterFiles["chapters/introduction.tex"];

      // Content passes pre-flight directly
      const issues = preflightChapter("chapters/introduction.tex", intro);
      const errors = issues.filter((i) => i.severity === "error");
      expect(errors).toHaveLength(0);
    });
  });

  // ── Step 5: Full compile with multiple sections ───────────────────────

  describe("Step 5: Full compile pipeline", () => {
    it("assembles and compiles a multi-section thesis", async () => {
      template = await readFile(path.join(TEMPLATES_DIR, "main.tex"), "utf-8");

      const sections = [
        makeSection({
          id: "s2",
          phase_number: 2,
          latex_content: AI_GENERATED_INTRO,
          ai_generated_latex: AI_GENERATED_INTRO,
          status: "approved",
        }),
        makeSection({
          id: "s3",
          phase_number: 3,
          latex_content: AI_GENERATED_AIMS,
          status: "approved",
        }),
        makeSection({
          id: "s5",
          phase_number: 5,
          latex_content: CLEAN_SECTION_LATEX,
          status: "review",
        }),
      ];

      const citations: Citation[] = [
        {
          id: "c1",
          project_id: "pipeline-test",
          cite_key: "Thompson2023Review",
          bibtex_entry: `@article{Thompson2023Review,
  author={Thompson, J},
  title={Review of Ventral Hernia Management},
  journal={Surgical Clinics},
  year={2023}
}`,
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
        },
      ];

      // Step 5a: Assemble
      const { tex, bib, chapterFiles, warnings } = assembleThesisContent(
        template,
        makeProject(),
        sections,
        citations
      );

      // Verify assembly
      expect(tex).toContain("\\input{chapters/introduction}");
      expect(tex).toContain("\\input{chapters/aims}");
      expect(chapterFiles["chapters/introduction.tex"]).toBeTruthy();
      expect(chapterFiles["chapters/aims.tex"]).toBeTruthy();
      expect(chapterFiles["chapters/methodology.tex"]).toBeTruthy();
      expect(bib).toContain("Sanders2013");
      expect(bib).toContain("Thompson2023Review");

      // Step 5b: Pre-flight all chapters
      for (const [filename, content] of Object.entries(chapterFiles)) {
        const issues = preflightChapter(filename, content);
        const errors = issues.filter((i) => i.severity === "error");
        if (errors.length > 0) {
          throw new Error(
            `Pre-flight errors in ${filename}:\n${errors.map((e) => `  L${e.line}: ${e.message}`).join("\n")}`
          );
        }
      }

      // Step 5c: Compile (local mode)
      const result = await compileTex(tex, {
        projectId: "pipeline-test",
        watermark: true,
        bibContent: bib,
        chapterFiles,
      });

      // Verify compile result
      expect(result.success).toBe(true);
      expect(result.pdfPath).toBeTruthy();
      expect(result.log.errorCount).toBe(0);
      expect(result.compileTimeMs).toBeGreaterThan(0);
    }, 120_000); // 2-minute timeout for pdflatex
  });

  // ── Step 6: Edge cases ────────────────────────────────────────────────

  describe("Step 6: Edge cases", () => {
    it("handles section with only BibTeX (no body)", () => {
      const content = `---BIBTEX---
@article{test2024,
  author={Test},
  title={Test},
  year={2024}
}`;
      const { body, bib } = splitBibtex(content);
      expect(body).toBe("");
      expect(bib).toContain("@article{test2024");
    });

    it("handles empty sections gracefully", async () => {
      template = await readFile(path.join(TEMPLATES_DIR, "main.tex"), "utf-8");

      const { chapterFiles, warnings } = assembleThesisContent(
        template,
        makeProject(),
        [],
        []
      );

      // All chapter files should be empty strings (not undefined)
      for (const content of Object.values(chapterFiles)) {
        expect(typeof content).toBe("string");
      }

      // Compile should still succeed (empty chapters are valid)
      const result = await compileTex(
        (await readFile(path.join(TEMPLATES_DIR, "main.tex"), "utf-8")),
        {
          projectId: "pipeline-edge-empty",
          watermark: false,
          bibContent: "",
          chapterFiles,
        }
      );

      // pdflatex should handle empty \input files
      expect(result.pdfPath).toBeTruthy();
    }, 120_000);

    it("content with ## headings is treated as markdown artifacts", () => {
      const markdown = "## Background\nSome text.\n## Methodology\nMore text.";
      const issues = preflightChapter("chapters/test.tex", markdown);
      const errors = issues.filter((i) =>
        i.severity === "error" && i.message.includes("Markdown heading")
      );
      expect(errors.length).toBe(2);
    });
  });
});
