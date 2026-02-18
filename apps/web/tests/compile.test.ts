import { describe, it, expect } from "vitest";
import { readFile } from "fs/promises";
import path from "path";
import { generateTex } from "@/lib/latex/generate-tex";
import { parseLatexLog } from "@/lib/latex/parse-log";
import type { Project } from "@/lib/types/database";

const TEMPLATES_DIR = path.resolve(__dirname, "../../../templates");

function makeProject(universityType: "wbuhs" | "ssuhs"): Project {
  return {
    id: "compile-test",
    user_id: "test-user",
    organisation_id: null,
    status: "sandbox",
    license_id: null,
    title: "A Study on Test Compilation of LaTeX Templates",
    synopsis_text: null,
    study_type: "Cross-sectional",
    university_type: universityType,
    metadata_json: {
      candidate_name: "Dr. Test Candidate",
      guide_name: "Prof (Dr.) Test Guide",
      hod_name: "Prof (Dr.) Test HOD",
      department: "Department of Test Medicine",
      degree: "M.D.",
      speciality: "Test Medicine",
      registration_no: "TEST/2024/001",
      session: "2024--2027",
      year: "2026",
    },
    current_phase: 0,
    phases_completed: [],
    analysis_plan_json: [],
    analysis_plan_status: "pending" as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe("Compile Tests", () => {
  let template: string;

  it("should load the main.tex template", async () => {
    template = await readFile(path.join(TEMPLATES_DIR, "main.tex"), "utf-8");
    expect(template).toContain("\\documentclass");
    expect(template).toContain("\\begin{document}");
    expect(template).toContain("\\end{document}");
  });

  it("should generate valid TeX for WBUHS (sskm-thesis.cls)", async () => {
    template = await readFile(path.join(TEMPLATES_DIR, "main.tex"), "utf-8");
    const project = makeProject("wbuhs");
    const { tex, warnings } = generateTex(template, project);

    expect(tex).toContain("\\documentclass{sskm-thesis}");
    expect(tex).toContain("\\thesistitle{A Study on Test Compilation of LaTeX Templates}");
    expect(tex).toContain("\\candidatename{Dr. Test Candidate}");

    // Verify no critical placeholder tokens remain for populated fields
    expect(tex).not.toContain("[YOUR THESIS TITLE HERE]");
    expect(tex).not.toContain("[Your Name]");
  });

  it("should generate valid TeX for SSUHS (ssuhs-thesis.cls)", async () => {
    template = await readFile(path.join(TEMPLATES_DIR, "main.tex"), "utf-8");
    const project = makeProject("ssuhs");
    const { tex, warnings } = generateTex(template, project);

    expect(tex).toContain("\\documentclass{ssuhs-thesis}");
    expect(tex).not.toContain("\\documentclass{sskm-thesis}\n");
    expect(tex).toContain("\\thesistitle{A Study on Test Compilation of LaTeX Templates}");
  });

  it("should verify CLS files exist", async () => {
    const sskmCls = await readFile(
      path.join(TEMPLATES_DIR, "sskm-thesis.cls"),
      "utf-8"
    );
    expect(sskmCls).toContain("\\ProvidesClass");

    const ssuhsCls = await readFile(
      path.join(TEMPLATES_DIR, "ssuhs-thesis.cls"),
      "utf-8"
    );
    expect(ssuhsCls).toContain("\\ProvidesClass");
  });

  it("should verify vancouver.bst exists", async () => {
    const bst = await readFile(
      path.join(TEMPLATES_DIR, "vancouver.bst"),
      "utf-8"
    );
    expect(bst.length).toBeGreaterThan(0);
  });

  it("should parse a sample clean log with 0 errors and ≤20 warnings", () => {
    const cleanLog = `
This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2025) (preloaded format=pdflatex)
Overfull \\hbox (1.5pt too wide) in paragraph at lines 100--105
Overfull \\hbox (0.8pt too wide) in paragraph at lines 200--205
Output written on main.pdf (15 pages, 234567 bytes).
Transcript written on main.log.
    `;

    const result = parseLatexLog(cleanLog);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBeLessThanOrEqual(20);
  });

  it("should detect errors in a failing log", () => {
    const failLog = `
This is pdfTeX, Version 3.141592653
! Undefined control sequence.
l.42 \\badcommand
! Emergency stop.
    `;

    const result = parseLatexLog(failLog);
    expect(result.errorCount).toBeGreaterThan(0);
  });
});
