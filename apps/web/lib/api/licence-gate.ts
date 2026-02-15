import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import type { ProjectStatus } from "@/lib/types/database";

/**
 * Check that a project is licensed or completed before allowing export.
 * Returns null if authorised, or a 402 response if not.
 */
export async function checkLicenceGate(
  projectId: string,
  userId: string
): Promise<{ status: ProjectStatus } | NextResponse> {
  const supabase = createAdminSupabaseClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, status, user_id")
    .eq("id", projectId)
    .single();

  if (!project) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      { status: 404 }
    );
  }

  if (project.user_id !== userId) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      { status: 404 }
    );
  }

  const status = project.status as ProjectStatus;
  if (status !== "licensed" && status !== "completed") {
    return NextResponse.json(
      {
        error: {
          code: "PAYMENT_REQUIRED",
          message: "A thesis licence is required to export. Purchase a licence to unlock exports.",
          action: "purchase_licence",
        },
      },
      { status: 402 }
    );
  }

  return { status };
}
