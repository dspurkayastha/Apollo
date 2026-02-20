import type { ProjectMetadata, UniversityType } from "@/lib/types/database";

export function generateTitlePageHtml(
  metadata: ProjectMetadata,
  title: string,
  universityType: UniversityType | null,
  isSandbox: boolean
): string {
  const universityName =
    universityType === "wbuhs"
      ? "The West Bengal University of Health Sciences"
      : universityType === "ssuhs"
        ? "Srimanta Sankaradeva University of Health Sciences"
        : "University";

  const universityLocation =
    universityType === "wbuhs"
      ? "Kolkata, West Bengal"
      : universityType === "ssuhs"
        ? "Guwahati, Assam"
        : "";

  const sandboxOverlay = isSandbox
    ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:72px;font-weight:bold;color:rgba(200,0,0,0.12);pointer-events:none;white-space:nowrap;z-index:10;">SANDBOX</div>`
    : "";

  const candidateDesignation = metadata.speciality
    ? `Postgraduate Trainee, ${escapeHtml(metadata.speciality)}`
    : "Postgraduate Trainee";

  const instituteName = metadata.institute_name
    ? escapeHtml(metadata.institute_name)
    : metadata.department
      ? escapeHtml(metadata.department)
      : "Department";

  return `
<div style="position:relative;width:100%;max-width:595px;min-height:842px;margin:0 auto;padding:72px 64px;font-family:'Times New Roman','Noto Serif',Georgia,serif;border:1px solid hsl(240 4% 22%);background:hsl(240 6% 6%);color:hsl(0 0% 95%);box-sizing:border-box;line-height:1.5;">
  ${sandboxOverlay}

  <div style="text-align:center;display:flex;flex-direction:column;min-height:698px;">

    <!-- University Name -->
    <div style="margin-bottom:24px;">
      <p style="font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin:0;line-height:1.4;">
        ${escapeHtml(universityName)}
      </p>
      ${universityLocation ? `<p style="font-size:12px;margin:4px 0 0;color:hsl(0 0% 70%);">${escapeHtml(universityLocation)}</p>` : ""}
    </div>

    <hr style="border:none;border-top:1.5px solid hsl(0 0% 40%);margin:0 30px 28px;" />

    <!-- Thesis Title -->
    <div style="margin-bottom:32px;padding:0 16px;">
      <h1 style="font-size:20px;font-weight:700;text-transform:uppercase;line-height:1.5;margin:0;letter-spacing:0.3px;">
        ${escapeHtml(title || "Thesis Title")}
      </h1>
    </div>

    <!-- Submission Text -->
    <div style="margin-bottom:12px;">
      <p style="font-size:13px;margin:0;color:hsl(0 0% 75%);">
        A dissertation submitted in partial fulfilment of the requirements<br />for the degree of
      </p>
    </div>

    <!-- Degree -->
    <div style="margin-bottom:8px;">
      <p style="font-size:16px;font-weight:700;margin:0;">
        ${escapeHtml(metadata.degree || "M.D. / M.S.")}
        ${metadata.speciality ? ` (${escapeHtml(metadata.speciality)})` : ""}
      </p>
    </div>

    <!-- TO University -->
    <div style="margin-bottom:36px;">
      <p style="font-size:13px;margin:0 0 6px;color:hsl(0 0% 75%);">to</p>
      <p style="font-size:14px;font-weight:700;margin:0;">
        ${escapeHtml(universityName)}
      </p>
    </div>

    <!-- Candidate / Guide Table -->
    <div style="display:flex;justify-content:space-between;text-align:left;margin:0 0 auto;padding:0 8px;">
      <div style="max-width:48%;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px;color:hsl(24 95% 53%);">Candidate</p>
        <p style="font-size:14px;font-weight:700;margin:0 0 2px;">${escapeHtml(metadata.candidate_name || "Candidate Name")}</p>
        <p style="font-size:11px;margin:0 0 2px;color:hsl(0 0% 70%);">${escapeHtml(candidateDesignation)}</p>
        <p style="font-size:11px;margin:0 0 2px;color:hsl(0 0% 70%);">Reg. No.: ${escapeHtml(metadata.registration_no || "\u2014")}</p>
        ${metadata.session ? `<p style="font-size:11px;margin:0;color:hsl(0 0% 70%);">Session: ${escapeHtml(metadata.session)}</p>` : ""}
      </div>
      <div style="max-width:48%;text-align:right;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px;color:hsl(24 95% 53%);">Guide</p>
        <p style="font-size:14px;font-weight:700;margin:0 0 2px;">${escapeHtml(metadata.guide_name || "Guide Name")}</p>
        <p style="font-size:11px;margin:0 0 2px;color:hsl(0 0% 70%);">${escapeHtml(instituteName)}</p>
        ${metadata.co_guide_name ? `
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:12px 0 6px;color:hsl(24 95% 53%);">Co-Guide</p>
        <p style="font-size:14px;font-weight:700;margin:0;">${escapeHtml(metadata.co_guide_name)}</p>
        ` : ""}
        ${metadata.hod_name ? `
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:12px 0 6px;color:hsl(24 95% 53%);">Head of Department</p>
        <p style="font-size:14px;font-weight:700;margin:0;">${escapeHtml(metadata.hod_name)}</p>
        ` : ""}
      </div>
    </div>

    <!-- Footer: Department / Institution / Year -->
    <div style="margin-top:auto;padding-top:24px;border-top:1px solid hsl(0 0% 25%);">
      <p style="font-size:13px;margin:0 0 4px;">${escapeHtml(instituteName)}</p>
      ${universityLocation ? `<p style="font-size:12px;margin:0 0 8px;color:hsl(0 0% 70%);">${escapeHtml(universityLocation)}</p>` : ""}
      <p style="font-size:13px;font-weight:600;margin:0;">
        ${escapeHtml(metadata.year || new Date().getFullYear().toString())}
      </p>
    </div>

  </div>
</div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
