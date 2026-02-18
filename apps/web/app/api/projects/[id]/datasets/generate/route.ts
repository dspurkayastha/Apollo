import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  validationError,
  internalError,
  rateLimited,
} from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { datasetGenerateSchema } from "@/lib/validation/dataset-schemas";
import { generateDataset } from "@/lib/datasets/generate";
import type { Dataset } from "@/lib/types/database";

// ── POST /api/projects/:id/datasets/generate — AI-generate a dataset ────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    // Rate limit check
    const rateCheck = await checkRateLimit(authResult.user.id);
    if (!rateCheck.allowed) {
      return rateLimited(rateCheck.retryAfterSeconds);
    }

    const { id } = await params;
    const supabase = createAdminSupabaseClient();

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    const body = await request.json();
    const parsed = datasetGenerateSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("Invalid generation parameters", {
        issues: parsed.error.issues,
      });
    }

    // Generate dataset via AI
    const generated = await generateDataset({
      projectId: id,
      ...parsed.data,
    });

    // Store file URL reference
    const fileUrl = `datasets/${id}/${Date.now()}_generated.csv`;

    const columnsJson = generated.columns.map((c) => ({
      name: c.name,
      type: c.type,
    }));

    const { data: dataset, error } = await supabase
      .from("datasets")
      .insert({
        project_id: id,
        file_url: fileUrl,
        row_count: generated.rowCount,
        columns_json: columnsJson,
        rows_json: generated.rows,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Failed to insert generated dataset:", error);
      return internalError();
    }

    // Reset analysis plan if dataset changed (columns may differ)
    await supabase
      .from("projects")
      .update({ analysis_plan_status: "pending", analysis_plan_json: [] })
      .eq("id", id)
      .neq("analysis_plan_status", "pending");

    return NextResponse.json(
      {
        data: {
          ...(dataset as Dataset),
          preview: {
            headers: generated.columns.map((c) => c.name),
            rows: generated.rows.slice(0, 10),
            totalRows: generated.rowCount,
          },
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Unexpected error in POST datasets/generate:", err);
    return internalError();
  }
}
