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
        ? "Sri Siddhartha University of Health Sciences"
        : "University";

  const headTitle =
    universityType === "ssuhs" ? "Principal" : "Director";

  const sandboxOverlay = isSandbox
    ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:72px;font-weight:bold;color:rgba(200,0,0,0.12);pointer-events:none;white-space:nowrap;z-index:10;">SANDBOX</div>`
    : "";

  return `
<div style="position:relative;width:100%;max-width:595px;min-height:842px;margin:0 auto;padding:60px 50px;font-family:'Times New Roman',serif;border:1px solid #ddd;background:#fff;box-sizing:border-box;">
  ${sandboxOverlay}
  <div style="text-align:center;">
    <h2 style="font-size:16px;text-transform:uppercase;margin:0 0 20px;">${universityName}</h2>
    <hr style="border:1px solid #333;margin:0 40px 30px;" />
    <h1 style="font-size:18px;font-weight:bold;text-transform:uppercase;line-height:1.4;margin:0 0 40px;padding:0 20px;">${escapeHtml(title || "Thesis Title")}</h1>
    <p style="font-size:14px;margin:0 0 30px;">A dissertation submitted in partial fulfilment of the requirements for the degree of</p>
    <p style="font-size:16px;font-weight:bold;margin:0 0 10px;">${escapeHtml(metadata.degree || "M.D. / M.S.")}</p>
    <p style="font-size:14px;margin:0 0 40px;">in</p>
    <p style="font-size:16px;font-weight:bold;margin:0 0 50px;">${escapeHtml(metadata.speciality || metadata.department || "Department")}</p>
  </div>
  <div style="display:flex;justify-content:space-between;margin-top:40px;">
    <div style="text-align:left;">
      <p style="font-size:12px;margin:0 0 4px;"><strong>Candidate:</strong></p>
      <p style="font-size:13px;margin:0 0 2px;">${escapeHtml(metadata.candidate_name || "Candidate Name")}</p>
      <p style="font-size:11px;color:#666;margin:0;">Reg. No: ${escapeHtml(metadata.registration_no || "—")}</p>
    </div>
    <div style="text-align:right;">
      <p style="font-size:12px;margin:0 0 4px;"><strong>Guide:</strong></p>
      <p style="font-size:13px;margin:0 0 2px;">${escapeHtml(metadata.guide_name || "Guide Name")}</p>
      <p style="font-size:12px;margin:0 0 10px;"><strong>HOD:</strong></p>
      <p style="font-size:13px;margin:0;">${escapeHtml(metadata.hod_name || "HOD Name")}</p>
    </div>
  </div>
  <div style="text-align:centre;margin-top:40px;">
    <p style="font-size:13px;margin:0 0 4px;">Under the ${headTitle}</p>
    <p style="font-size:13px;margin:0;">${escapeHtml(metadata.session || metadata.year || new Date().getFullYear().toString())}</p>
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
