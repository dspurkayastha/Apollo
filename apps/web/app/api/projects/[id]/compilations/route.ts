import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, notFound, internalError } from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Compilation } from "@/lib/types/database";

// ── GET /api/projects/:id/compilations — List compilation history ────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const supabase = createAdminSupabaseClient();

    // Verify project ownership
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    const { data: compilations, error } = await supabase
      .from("compilations")
      .select("id, project_id, trigger, status, pdf_url, warnings, errors, compile_time_ms, created_at")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Failed to fetch compilations:", error);
      return internalError();
    }

    return NextResponse.json({ data: compilations as Compilation[] });
  } catch (err) {
    console.error("Unexpected error in GET compilations:", err);
    return internalError();
  }
}
