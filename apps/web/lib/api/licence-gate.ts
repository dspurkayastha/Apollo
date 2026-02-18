import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { checkLicenceExpiry } from "./licence-expiry";
import type { ProjectStatus, AnalysisPlanStatus } from "@/lib/types/database";

/**
 * Check that a project is licensed or completed before allowing export.
 * Also verifies the licence hasn't expired.
 * Returns project status if authorised, or a 402/404 response if not.
 */
export async function checkLicenceGate(
  projectId: string,
  userId: string
): Promise<{ status: ProjectStatus; currentPhase: number; analysisPlanStatus: AnalysisPlanStatus } | NextResponse> {
  const supabase = createAdminSupabaseClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, status, user_id, license_id, current_phase, analysis_plan_status")
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

  // Check licence expiry for licensed (non-completed) projects
  if (status === "licensed" && project.license_id) {
    const expiry = await checkLicenceExpiry(project.license_id as string);
    if (expiry?.expired) {
      return NextResponse.json(
        {
          error: {
            code: "LICENCE_EXPIRED",
            message: "Your licence has expired. Please renew to continue exporting.",
            action: "renew_licence",
          },
        },
        { status: 402 }
      );
    }
  }

  return {
    status,
    currentPhase: project.current_phase as number,
    analysisPlanStatus: (project.analysis_plan_status ?? "pending") as AnalysisPlanStatus,
  };
}
