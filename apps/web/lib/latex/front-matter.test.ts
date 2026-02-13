import { describe, it, expect } from "vitest";
import { generateFrontMatterLatex, generateAcknowledgements } from "./front-matter";
import type { Project, ProjectMetadata } from "@/lib/types/database";

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
    current_phase: 1,
    phases_completed: [0],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("generateFrontMatterLatex", () => {
  it("should generate all metadata commands", () => {
    const project = makeProject();
    const latex = generateFrontMatterLatex(project);

    expect(latex).toContain("\\thesistitle{Prevalence of Anaemia in Pregnancy}");
    expect(latex).toContain("\\candidatename{Dr. Ananya Sharma}");
    expect(latex).toContain("\\candidatedesignation{Post Graduate Trainee}");
    expect(latex).toContain("\\registrationno{MD/2024/001}");
    expect(latex).toContain("\\supervisorname{Prof (Dr.) Rajesh Kumar}");
    expect(latex).toContain("\\hodname{Prof (Dr.) Sunil Das}");
    expect(latex).toContain("\\departmentname{Department of Obstetrics \\& Gynaecology}");
    expect(latex).toContain("\\degreename{M.D.}");
    expect(latex).toContain("\\degreebranch{Obstetrics \\& Gynaecology}");
    expect(latex).toContain("\\submissionyear{2026}");
  });

  it("should handle missing metadata gracefully", () => {
    const project = makeProject({ metadata_json: {} });
    const latex = generateFrontMatterLatex(project);

    // Should still include title from project
    expect(latex).toContain("\\thesistitle{");
    // Should not crash
    expect(latex).not.toContain("undefined");
  });

  it("should escape special characters in metadata", () => {
    const project = makeProject({
      metadata_json: {
        candidate_name: "Dr. O'Brien & Partners",
      },
    });
    const latex = generateFrontMatterLatex(project);

    expect(latex).toContain("Dr. O'Brien \\& Partners");
  });
});

describe("generateAcknowledgements", () => {
  it("should include guide acknowledgement", () => {
    const meta: ProjectMetadata = {
      guide_name: "Prof (Dr.) Rajesh Kumar",
      hod_name: "Prof (Dr.) Sunil Das",
      department: "Department of Surgery",
    };
    const text = generateAcknowledgements(meta);

    expect(text).toContain("Prof (Dr.) Rajesh Kumar");
    expect(text).toContain("guidance");
  });

  it("should include HOD and department", () => {
    const meta: ProjectMetadata = {
      hod_name: "Prof (Dr.) Sunil Das",
      department: "Department of Surgery",
    };
    const text = generateAcknowledgements(meta);

    expect(text).toContain("Prof (Dr.) Sunil Das");
    expect(text).toContain("Department of Surgery");
  });

  it("should always include patients and family", () => {
    const meta: ProjectMetadata = {};
    const text = generateAcknowledgements(meta);

    expect(text).toContain("patients");
    expect(text).toContain("family");
  });
});
