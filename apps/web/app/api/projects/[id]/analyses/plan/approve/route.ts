import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  internalError,
  badRequest,
} from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { PlannedAnalysis } from "@/lib/validation/analysis-plan-schemas";

// ── POST /api/projects/:id/analyses/plan/approve — Approve the analysis plan ─

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const supabase = createAdminSupabaseClient();

    const { data: project } = await supabase
      .from("projects")
      .select("id, analysis_plan_json, analysis_plan_status")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    if (project.analysis_plan_status !== "review") {
      return badRequest(
        "Analysis plan must be in review status before approval."
      );
    }

    const plan = (project.analysis_plan_json ?? []) as unknown as PlannedAnalysis[];

    // Validate at least one non-skipped analysis
    const activeAnalyses = plan.filter((p) => p.status !== "skipped");
    if (activeAnalyses.length === 0) {
      return badRequest(
        "Analysis plan must contain at least one non-skipped analysis."
      );
    }

    // Validate column references still exist in the latest dataset
    const { data: datasets } = await supabase
      .from("datasets")
      .select("columns_json")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!datasets || datasets.length === 0) {
      return badRequest("No dataset found. Upload a dataset before approving the plan.");
    }

    const columns = (datasets[0].columns_json ?? []) as { name: string; type: string }[];
    const columnNames = new Set(columns.map((c) => c.name));

    const staleRefs: string[] = [];
    for (const analysis of activeAnalyses) {
      const vars = analysis.variables;
      for (const [key, value] of Object.entries(vars)) {
        if (value && !columnNames.has(value)) {
          staleRefs.push(`${analysis.id}.${key}="${value}"`);
        }
      }
    }

    if (staleRefs.length > 0) {
      return badRequest(
        `Dataset columns changed --- regenerate or update the plan. Stale references: ${staleRefs.join(", ")}`
      );
    }

    // Approve the plan
    const { error: updateError } = await supabase
      .from("projects")
      .update({ analysis_plan_status: "approved" })
      .eq("id", id);

    if (updateError) {
      console.error("Failed to approve analysis plan:", updateError);
      return internalError();
    }

    return NextResponse.json({
      data: {
        plan,
        status: "approved",
      },
    });
  } catch (err) {
    console.error("Unexpected error in POST analysis plan approve:", err);
    return internalError();
  }
}
