import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, notFound, internalError } from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Analysis } from "@/lib/types/database";

// ── GET /api/projects/:id/analyses/:analysisId — Get analysis result ────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; analysisId: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id, analysisId } = await params;
    const supabase = createAdminSupabaseClient();

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    const { data: analysis, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", analysisId)
      .eq("project_id", id)
      .single();

    if (error || !analysis) return notFound("Analysis not found");

    return NextResponse.json({ data: analysis as Analysis });
  } catch (err) {
    console.error("Unexpected error in GET analysis:", err);
    return internalError();
  }
}
