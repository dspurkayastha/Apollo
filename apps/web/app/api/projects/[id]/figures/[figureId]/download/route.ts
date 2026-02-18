import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, notFound, internalError } from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { generateDownloadUrl } from "@/lib/r2/client";

// ── GET /api/projects/:id/figures/:figureId/download — Signed download URL ───

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; figureId: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id, figureId } = await params;
    const supabase = createAdminSupabaseClient();

    // Verify project ownership
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    // Fetch figure and verify it belongs to this project
    const { data: figure } = await supabase
      .from("figures")
      .select("id, file_url, format")
      .eq("id", figureId)
      .eq("project_id", id)
      .single();

    if (!figure || !figure.file_url) return notFound("Figure not found");

    // Return URL in JSON or redirect based on query param
    const format = request.nextUrl.searchParams.get("format");
    const signedUrl = await generateDownloadUrl(figure.file_url);

    if (format === "url") {
      return NextResponse.json({ data: { url: signedUrl } });
    }

    // Default: redirect to signed URL
    return NextResponse.redirect(signedUrl, 302);
  } catch (err) {
    console.error("Unexpected error in GET figure download:", err);
    return internalError();
  }
}
