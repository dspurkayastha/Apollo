import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, notFound, internalError } from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const supabase = createAdminSupabaseClient();

    // Verify project exists and belongs to user
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (projectError || !project) {
      return notFound("Project not found");
    }

    const { data: sections, error } = await supabase
      .from("sections")
      .select("*")
      .eq("project_id", id)
      .order("phase_number", { ascending: true });

    if (error) {
      console.error("Failed to fetch sections:", error);
      return internalError("Failed to fetch sections");
    }

    return NextResponse.json({ data: sections });
  } catch (err) {
    console.error("Unexpected error in GET /api/projects/[id]/sections:", err);
    return internalError();
  }
}
