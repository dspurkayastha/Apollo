import { escapeLatexArg } from "./escape";
import type { Project, ProjectMetadata } from "@/lib/types/database";

/**
 * Generate front matter LaTeX from project metadata.
 * This populates the metadata commands that the CLS files use
 * to generate title page, certificates, and declaration.
 */
export function generateFrontMatterLatex(project: Project): string {
  const meta = project.metadata_json ?? {};
  const lines: string[] = [];

  lines.push("%% Front matter metadata -- auto-generated from project settings");
  lines.push(`%% Project: ${project.id}`);
  lines.push(`%% Generated: ${new Date().toISOString()}`);
  lines.push("");

  // Title
  if (project.title) {
    lines.push(`\\thesistitle{${escapeLatexArg(project.title)}}`);
  }

  // Candidate
  if (meta.candidate_name) {
    lines.push(`\\candidatename{${escapeLatexArg(meta.candidate_name)}}`);
  }
  lines.push("\\candidatedesignation{Post Graduate Trainee}");

  // Registration
  if (meta.registration_no) {
    lines.push(`\\registrationno{${escapeLatexArg(meta.registration_no)}}`);
  }

  // Session
  if (meta.session) {
    lines.push(`\\academicsession{${escapeLatexArg(meta.session)}}`);
    lines.push(`\\studyperiod{${escapeLatexArg(meta.session)}}`);
  }

  // Guide
  if (meta.guide_name) {
    lines.push(`\\supervisorname{${escapeLatexArg(meta.guide_name)}}`);
    lines.push("\\supervisordesignation{Professor}");
  }

  // HOD
  if (meta.hod_name) {
    lines.push(`\\hodname{${escapeLatexArg(meta.hod_name)}}`);
    lines.push("\\hoddesignation{Professor and Head of Department}");
  }

  // Department
  if (meta.department) {
    lines.push(`\\departmentname{${escapeLatexArg(meta.department)}}`);
  }

  // Degree
  if (meta.degree) {
    lines.push(`\\degreename{${escapeLatexArg(meta.degree)}}`);
  }
  if (meta.speciality) {
    lines.push(`\\degreebranch{${escapeLatexArg(meta.speciality)}}`);
  }

  // Year
  if (meta.year) {
    lines.push(`\\submissionyear{${escapeLatexArg(meta.year)}}`);
  }

  return lines.join("\n");
}

/**
 * Generate acknowledgements LaTeX text from metadata.
 * Follows the standard order: Guide → HOD → Head of Institution → Colleagues → Family
 */
export function generateAcknowledgements(meta: ProjectMetadata): string {
  const parts: string[] = [];

  if (meta.guide_name) {
    parts.push(
      `I express my sincere gratitude to my guide, ${escapeLatexArg(meta.guide_name)}, for their invaluable guidance, constant encouragement, and meticulous supervision throughout this study.`
    );
  }

  if (meta.hod_name) {
    parts.push(
      `I am deeply indebted to ${escapeLatexArg(meta.hod_name)}, Head of the Department${meta.department ? `, ${escapeLatexArg(meta.department)}` : ""}, for providing the necessary facilities and support to carry out this work.`
    );
  }

  parts.push(
    "I am thankful to all the faculty members and colleagues of the department for their help and cooperation during the course of this study."
  );

  parts.push(
    "I sincerely thank all the patients who participated in this study for their cooperation and trust."
  );

  parts.push(
    "Last but not least, I am eternally grateful to my family for their unwavering support, patience, and encouragement."
  );

  return parts.join("\n\n");
}
