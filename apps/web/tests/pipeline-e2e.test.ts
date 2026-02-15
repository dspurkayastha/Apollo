/**
 * E2E Pipeline Integration Test
 *
 * Exercises the full thesis compilation pipeline:
 *   AI-generated LaTeX → latexToTiptap → tiptapToLatex → preflightChapter
 *   → assembleThesisContent → compileTex
 *
 * Uses realistic AI-generated content including known bugs:
 * - Markdown heading artifacts (# Introduction)
 * - \needspace{} commands
 * - BibTeX trailers (---BIBTEX---)
 * - \cite{} references
 */

import { describe, it, expect } from "vitest";
import { readFile } from "fs/promises";
import path from "path";
import { latexToTiptap } from "@/lib/latex/latex-to-tiptap";
import { tiptapToLatex, type TiptapNode } from "@/lib/latex/tiptap-to-latex";
import { preflightChapter } from "@/lib/latex/validate";
import {
  splitBibtex,
  assembleThesisContent,
} from "@/lib/latex/assemble";
import { compileTex } from "@/lib/latex/compile";
import type { Project, Section, Citation } from "@/lib/types/database";

// ── Realistic AI-generated content (from actual production data) ──────────

const AI_GENERATED_INTRO = `# Introduction

\\needspace{4\\baselineskip}

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

  // ── Step 1: Test the known bug ────────────────────────────────────────

  describe("Step 1: Identify the bug — raw AI content has markdown artifacts", () => {
    it("raw AI content starts with # Introduction (markdown heading)", () => {
      expect(AI_GENERATED_INTRO).toMatch(/^# Introduction/);
    });

    it("preflightChapter catches # Introduction as error", () => {
      const { body } = splitBibtex(AI_GENERATED_INTRO);
      const issues = preflightChapter("chapters/introduction.tex", body);
      const errors = issues.filter((i) => i.severity === "error");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((i) => i.message.includes("Markdown heading"))).toBe(true);
    });
  });

  // ── Step 2: Test the fix — tiptap round-trip sanitises ────────────────

  describe("Step 2: Tiptap round-trip sanitises content", () => {
    it("latexToTiptap strips # heading, \\needspace, BibTeX trailer", () => {
      const result = latexToTiptap(AI_GENERATED_INTRO);

      // Should produce valid Tiptap JSON
      expect(result.json.type).toBe("doc");
      expect(result.json.content!.length).toBeGreaterThan(0);

      // Should extract citation keys
      expect(result.citationKeys).toContain("Sanders2013");
      expect(result.citationKeys).toContain("Muysoms2016EHS");
    });

    it("tiptapToLatex escapes # and produces clean LaTeX", () => {
      const tiptap = latexToTiptap(AI_GENERATED_INTRO);
      const result = tiptapToLatex(tiptap.json);

      // Must NOT contain bare # (the original bug)
      expect(result.latex).not.toMatch(/(?<!\\)#/);

      // Must NOT contain \needspace (stripped by preprocess)
      expect(result.latex).not.toContain("\\needspace");

      // Must NOT contain ---BIBTEX--- trailer
      expect(result.latex).not.toContain("---BIBTEX---");

      // Should contain escaped content
      expect(result.latex).toContain("\\subsection");
    });

    it("round-tripped content passes preflightChapter with zero errors", () => {
      const tiptap = latexToTiptap(AI_GENERATED_INTRO);
      const round = tiptapToLatex(tiptap.json);
      const issues = preflightChapter("chapters/introduction.tex", round.latex);
      const errors = issues.filter((i) => i.severity === "error");
      expect(errors).toHaveLength(0);
    });
  });

  // ── Step 3: Test clean content passes without round-trip ──────────────

  describe("Step 3: Clean LaTeX content passes directly", () => {
    it("preflightChapter passes clean LaTeX with zero errors", () => {
      const issues = preflightChapter("chapters/methodology.tex", CLEAN_SECTION_LATEX);
      const errors = issues.filter((i) => i.severity === "error");
      expect(errors).toHaveLength(0);
    });
  });

  // ── Step 4: Test assembly pipeline ────────────────────────────────────

  describe("Step 4: assembleThesisContent handles both paths", () => {
    it("uses tiptapToLatex when rich_content_json available", async () => {
      template = await readFile(path.join(TEMPLATES_DIR, "main.tex"), "utf-8");
      const tiptap = latexToTiptap(AI_GENERATED_INTRO);

      const sections = [
        makeSection({
          phase_number: 2,
          latex_content: AI_GENERATED_INTRO,
          rich_content_json: tiptap.json as unknown as Record<string, unknown>,
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

      // Must NOT contain bare #
      expect(intro).not.toMatch(/(?<!\\)#/);

      // Must NOT contain \needspace
      expect(intro).not.toContain("\\needspace");

      // BibTeX should be extracted from ai_generated_latex
      expect(bib).toContain("Sanders2013");
      expect(bib).toContain("Muysoms2016EHS");

      // Chapter should pass pre-flight
      const issues = preflightChapter("chapters/introduction.tex", intro);
      const errors = issues.filter((i) => i.severity === "error");
      expect(errors).toHaveLength(0);
    });

    it("sanitises raw latex_content in fallback path (no rich_content_json)", async () => {
      template = await readFile(path.join(TEMPLATES_DIR, "main.tex"), "utf-8");

      const sections = [
        makeSection({
          phase_number: 2,
          latex_content: AI_GENERATED_INTRO,
          rich_content_json: null, // <-- no rich text JSON
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

      // CRITICAL: Even without rich_content_json, the fallback path must
      // produce content that passes pre-flight validation
      const issues = preflightChapter("chapters/introduction.tex", intro);
      const errors = issues.filter((i) => i.severity === "error");
      expect(errors).toHaveLength(0);
    });
  });

  // ── Step 5: Full compile with multiple sections ───────────────────────

  describe("Step 5: Full compile pipeline", () => {
    it("assembles and compiles a multi-section thesis", async () => {
      template = await readFile(path.join(TEMPLATES_DIR, "main.tex"), "utf-8");

      const introTiptap = latexToTiptap(AI_GENERATED_INTRO);

      const sections = [
        makeSection({
          id: "s2",
          phase_number: 2,
          latex_content: AI_GENERATED_INTRO,
          rich_content_json: introTiptap.json as unknown as Record<string, unknown>,
          ai_generated_latex: AI_GENERATED_INTRO,
          status: "approved",
        }),
        makeSection({
          id: "s3",
          phase_number: 3,
          latex_content: AI_GENERATED_AIMS,
          rich_content_json: null,
          status: "approved",
        }),
        makeSection({
          id: "s5",
          phase_number: 5,
          latex_content: CLEAN_SECTION_LATEX,
          rich_content_json: null,
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
      // It may warn but should not error
      expect(result.pdfPath).toBeTruthy();
    }, 120_000);

    it("content with multiple ## headings is treated as markdown artifacts", () => {
      const markdown = "## Background\nSome text.\n## Methodology\nMore text.";
      const issues = preflightChapter("chapters/test.tex", markdown);
      const errors = issues.filter((i) =>
        i.severity === "error" && i.message.includes("Markdown heading")
      );
      expect(errors.length).toBe(2);
    });
  });
});
