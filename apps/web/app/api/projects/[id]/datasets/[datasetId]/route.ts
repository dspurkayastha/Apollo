import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, notFound, internalError } from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Dataset } from "@/lib/types/database";

// ── GET /api/projects/:id/datasets/:datasetId — Get single dataset ──────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; datasetId: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id, datasetId } = await params;
    const supabase = createAdminSupabaseClient();

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    const { data: dataset, error } = await supabase
      .from("datasets")
      .select("*")
      .eq("id", datasetId)
      .eq("project_id", id)
      .single();

    if (error || !dataset) return notFound("Dataset not found");

    return NextResponse.json({ data: dataset as Dataset });
  } catch (err) {
    console.error("Unexpected error in GET dataset:", err);
    return internalError();
  }
}

// ── DELETE /api/projects/:id/datasets/:datasetId — Delete dataset ───────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; datasetId: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id, datasetId } = await params;
    const supabase = createAdminSupabaseClient();

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    const { error } = await supabase
      .from("datasets")
      .delete()
      .eq("id", datasetId)
      .eq("project_id", id);

    if (error) {
      console.error("Failed to delete dataset:", error);
      return internalError();
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("Unexpected error in DELETE dataset:", err);
    return internalError();
  }
}
