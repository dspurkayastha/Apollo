import { escapeLatexArg } from "./escape";
import type { Project, ProjectMetadata } from "@/lib/types/database";

/**
 * Generate a populated main.tex from the template and project metadata.
 * Replaces placeholder tokens in the template with escaped metadata values.
 */

interface TexGenerationResult {
  tex: string;
  warnings: string[];
}

const FIELD_MAP: {
  command: string;
  metadataKey?: keyof ProjectMetadata;
  projectKey?: keyof Project;
  fallback: string;
}[] = [
  { command: "thesistitle", projectKey: "title", fallback: "[Thesis Title]" },
  { command: "candidatename", metadataKey: "candidate_name", fallback: "Dr. [Candidate Name]" },
  { command: "registrationno", metadataKey: "registration_no", fallback: "[Registration Number]" },
  { command: "supervisorname", metadataKey: "guide_name", fallback: "Prof (Dr.) [Guide Name]" },
  { command: "hodname", metadataKey: "hod_name", fallback: "Prof (Dr.) [HOD Name]" },
  { command: "departmentname", metadataKey: "department", fallback: "Department of [Specialty]" },
  { command: "degreename", metadataKey: "degree", fallback: "[M.D./M.S.]" },
  { command: "degreebranch", metadataKey: "speciality", fallback: "[Specialty]" },
  { command: "academicsession", metadataKey: "session", fallback: "[Start Year]--[End Year]" },
  { command: "submissionyear", metadataKey: "year", fallback: "[Year]" },
];

export function generateTex(
  template: string,
  project: Project
): TexGenerationResult {
  let tex = template;
  const warnings: string[] = [];
  const metadata = project.metadata_json ?? {};

  // Set university document class
  if (project.university_type === "ssuhs") {
    tex = tex
      .replace(
        /^\\documentclass\{sskm-thesis\}/m,
        "%\\documentclass{sskm-thesis}"
      )
      .replace(
        /^%\\documentclass\{ssuhs-thesis\}/m,
        "\\documentclass{ssuhs-thesis}"
      );
  }

  // Set logo paths based on university type
  const logoMap: Record<string, { university: string; institute: string }> = {
    sskm: { university: "logo/wbuhs-logo", institute: "logo/sskm-logo" },
    ssuhs: { university: "logo/ssuhs-logo", institute: "logo/ssuhs-logo" },
    generic: { university: "", institute: "" },
  };
  const logos = logoMap[project.university_type ?? ""] ?? logoMap.sskm;
  // Insert logos and additional packages before \begin{document}
  // AI-generated content may use math symbols requiring these packages
  const logoCommands = `\\universitylogo{${logos.university}}\n\\institutelogo{${logos.institute}}`;
  const extraPackages = [
    "\\usepackage{mathrsfs}   % \\mathscr{} -- formal script math font",
    "\\usepackage{amssymb}    % Extended math symbols",
    "\\usepackage{graphicx}   % \\includegraphics for figures",
    "\\usepackage{subcaption} % subfigure environments for grouped figures",
  ].join("\n");
  tex = tex.replace(
    /(\\begin\{document\})/,
    `${logoCommands}\n\n${extraPackages}\n\n$1`
  );

  // Replace field values
  for (const field of FIELD_MAP) {
    let value: string | undefined;

    if (field.metadataKey) {
      value = metadata[field.metadataKey] as string | undefined;
    }
    if (!value && field.projectKey) {
      value = project[field.projectKey] as string | undefined;
    }

    if (value) {
      const escaped = escapeLatexArg(value);
      // Match the \command{...} pattern and replace the argument
      const regex = new RegExp(
        `(\\\\${field.command})\\{[^}]*\\}`,
        "m"
      );
      tex = tex.replace(regex, `$1{${escaped}}`);
    } else {
      warnings.push(`Missing metadata: ${field.command}`);
    }
  }

  // Uncomment and set co-guide if provided
  if (metadata.co_guide_name) {
    const escaped = escapeLatexArg(metadata.co_guide_name);
    tex = tex.replace(/^%\\cosupervisorname\{[^}]*\}/m, `\\cosupervisorname{${escaped}}`);
    tex = tex.replace(/^%\\cosupervisordesignation\{[^}]*\}/m, "\\cosupervisordesignation{Associate Professor}");
  }

  // Uncomment and set institute if provided
  if (metadata.institute_name) {
    const escaped = escapeLatexArg(metadata.institute_name);
    tex = tex.replace(/^%\\institutename\{[^}]*\}/m, `\\institutename{${escaped}}`);
  }

  return { tex, warnings };
}
