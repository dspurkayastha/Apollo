import { describe, it, expect } from "vitest";
import { generateTex } from "./generate-tex";
import type { Project } from "@/lib/types/database";

const MINIMAL_TEMPLATE = `\\documentclass{sskm-thesis}
%\\documentclass{ssuhs-thesis}
\\thesistitle{[YOUR THESIS TITLE HERE]}
\\candidatename{Dr. [Your Name]}
\\registrationno{[Registration Number]}
\\supervisorname{Prof (Dr.) [Guide Name]}
\\hodname{Prof (Dr.) [HOD Name]}
\\departmentname{Department of [Your Specialty]}
\\degreename{[M.D./M.S./D.M./M.Ch./M.D.S.]}
\\degreebranch{[Your Specialty/Branch]}
\\academicsession{[Start Year]--[End Year]}
\\submissionyear{[Year]}
\\begin{document}
Hello
\\end{document}`;

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
    current_phase: 0,
    phases_completed: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("generateTex", () => {
  it("should populate template with project metadata", () => {
    const project = makeProject();
    const { tex, warnings } = generateTex(MINIMAL_TEMPLATE, project);

    expect(tex).toContain("\\thesistitle{Prevalence of Anaemia in Pregnancy}");
    expect(tex).toContain("\\candidatename{Dr. Ananya Sharma}");
    expect(tex).toContain("\\supervisorname{Prof (Dr.) Rajesh Kumar}");
    expect(tex).toContain("\\hodname{Prof (Dr.) Sunil Das}");
    expect(tex).toContain("\\departmentname{Department of Obstetrics \\& Gynaecology}");
    expect(tex).toContain("\\degreename{M.D.}");
    expect(tex).toContain("\\registrationno{MD/2024/001}");
    expect(tex).toContain("\\submissionyear{2026}");
    expect(warnings).toHaveLength(0);
  });

  it("should switch to ssuhs document class", () => {
    const project = makeProject({ university_type: "ssuhs" });
    const { tex } = generateTex(MINIMAL_TEMPLATE, project);

    expect(tex).toContain("\\documentclass{ssuhs-thesis}");
    expect(tex).toContain("%\\documentclass{sskm-thesis}");
  });

  it("should keep sskm for wbuhs university type", () => {
    const project = makeProject({ university_type: "wbuhs" });
    const { tex } = generateTex(MINIMAL_TEMPLATE, project);

    expect(tex).toContain("\\documentclass{sskm-thesis}");
  });

  it("should report warnings for missing metadata", () => {
    const project = makeProject({
      metadata_json: {},
      title: "",
    });
    const { warnings } = generateTex(MINIMAL_TEMPLATE, project);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.includes("candidatename"))).toBe(true);
  });

  it("should escape special LaTeX characters in metadata", () => {
    const project = makeProject({
      metadata_json: {
        candidate_name: "Dr. O'Brien & Partners",
        department: "Dept of OB/GYN #1",
      },
    });
    const { tex } = generateTex(MINIMAL_TEMPLATE, project);

    expect(tex).toContain("Dr. O'Brien \\& Partners");
    expect(tex).toContain("Dept of OB/GYN \\#1");
  });
});
