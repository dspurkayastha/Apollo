import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, internalError } from "@/lib/api/errors";
import { checkLicenceGate } from "@/lib/api/licence-gate";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { assembleThesisContent } from "@/lib/latex/assemble";
import type { Project, Section, Citation, Abbreviation } from "@/lib/types/database";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const gateResult = await checkLicenceGate(id, authResult.user.id);
    if (gateResult instanceof NextResponse) return gateResult;

    // Block downloads for licensed projects before Phase 6b (DECISIONS.md 8.4)
    if (
      gateResult.status === "licensed" &&
      (gateResult.currentPhase < 6 ||
        (gateResult.currentPhase === 6 && gateResult.analysisPlanStatus !== "approved"))
    ) {
      return NextResponse.json(
        {
          error: {
            code: "DOWNLOAD_RESTRICTED",
            message: "Download available from Phase 6b onwards. Use the preview panel.",
          },
        },
        { status: 403 }
      );
    }

    const supabase = createAdminSupabaseClient();

    // Fetch project, sections, citations, abbreviations for assembly
    const [projectRes, sectionsRes, citationsRes, abbreviationsRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase
        .from("sections")
        .select("*")
        .eq("project_id", id)
        .in("status", ["approved", "review"])
        .order("phase_number"),
      supabase.from("citations").select("*").eq("project_id", id),
      supabase.from("abbreviations").select("*").eq("project_id", id),
    ]);

    if (!projectRes.data) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        { status: 404 }
      );
    }

    // Assemble chapters for DOCX
    const project = projectRes.data as Project;
    const sections = (sectionsRes.data ?? []) as Section[];
    const citations = (citationsRes.data ?? []) as Citation[];
    const abbreviations = (abbreviationsRes.data ?? []) as Abbreviation[];

    // For DOCX, we compile all chapter LaTeX into a single body
    // In production, this would call pandoc in Docker
    // For now, return a simplified text export
    const { chapterFiles } = assembleThesisContent(
      "", // Template not needed for chapter extraction
      project,
      sections,
      citations,
      abbreviations
    );

    // Combine all chapters into a single LaTeX body
    const fullBody = Object.entries(chapterFiles)
      .filter(([, content]) => content.trim())
      .map(([path, content]) => `%% ${path}\n${content}`)
      .join("\n\n");

    // Return as plain text for now — pandoc conversion requires Docker
    const safeFilename = (project.title || "thesis").replace(/[^\w\s.-]/g, "_");
    return new NextResponse(fullBody, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFilename}.tex"; filename*=UTF-8''${encodeURIComponent(safeFilename)}.tex`,
      },
    });
  } catch (err) {
    console.error("DOCX export error:", err);
    return internalError();
  }
}
