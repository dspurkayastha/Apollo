import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, notFound, internalError } from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Figure } from "@/lib/types/database";

// ── GET /api/projects/:id/figures/:figureId — Get single figure ─────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; figureId: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id, figureId } = await params;
    const supabase = createAdminSupabaseClient();

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    const { data: figure, error } = await supabase
      .from("figures")
      .select("*")
      .eq("id", figureId)
      .eq("project_id", id)
      .single();

    if (error || !figure) return notFound("Figure not found");

    return NextResponse.json({ data: figure as Figure });
  } catch (err) {
    console.error("Unexpected error in GET figure:", err);
    return internalError();
  }
}

// ── DELETE /api/projects/:id/figures/:figureId — Delete figure ──────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; figureId: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id, figureId } = await params;
    const supabase = createAdminSupabaseClient();

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    const { error } = await supabase
      .from("figures")
      .delete()
      .eq("id", figureId)
      .eq("project_id", id);

    if (error) {
      console.error("Failed to delete figure:", error);
      return internalError();
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("Unexpected error in DELETE figure:", err);
    return internalError();
  }
}
