import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  validationError,
  internalError,
  queueFull,
} from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { analysisCreateSchema, REQUIRED_PARAMS, type AnalysisType } from "@/lib/validation/analysis-schemas";
import { tryAcquire, release } from "@/lib/compute/semaphore";
import { inngest } from "@/lib/inngest/client";
import { executeAnalysis } from "@/lib/r-plumber/analysis-runner";
import type { Analysis } from "@/lib/types/database";

// ── GET /api/projects/:id/analyses — List analyses ──────────────────────────

export async function GET(
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
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    const { data: analyses, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch analyses:", error);
      return internalError();
    }

    return NextResponse.json({ data: analyses as Analysis[] });
  } catch (err) {
    console.error("Unexpected error in GET analyses:", err);
    return internalError();
  }
}

// ── POST /api/projects/:id/analyses — Run analysis ──────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

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
    const parsed = analysisCreateSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("Invalid analysis parameters", {
        issues: parsed.error.issues,
      });
    }

    // Validate required parameters for this analysis type
    const analysisType = parsed.data.analysis_type as AnalysisType;
    const requiredParams = REQUIRED_PARAMS[analysisType] ?? [];
    const missingParams = requiredParams.filter(
      (key) => {
        const val = parsed.data.parameters[key as keyof typeof parsed.data.parameters];
        return !val || (typeof val === "string" && val.trim() === "");
      }
    );
    if (missingParams.length > 0) {
      return validationError(
        `${analysisType} analysis requires: ${missingParams.join(", ")}`,
        { missing: missingParams }
      );
    }

    // Verify dataset exists, belongs to this project, and has data
    const { data: dataset } = await supabase
      .from("datasets")
      .select("id, row_count, rows_json")
      .eq("id", parsed.data.dataset_id)
      .eq("project_id", id)
      .single();

    if (!dataset) return notFound("Dataset not found");

    if (!dataset.row_count || dataset.row_count === 0) {
      return validationError("Dataset has no rows. Please re-upload the dataset file.");
    }

    const hasRows = Array.isArray(dataset.rows_json) && (dataset.rows_json as unknown[]).length > 0;
    if (!hasRows) {
      return validationError(
        "Dataset has no stored row data. Please delete this dataset and generate or upload a new one."
      );
    }

    // Try to acquire compute semaphore
    const semResult = tryAcquire("analysis", id, authResult.user.id);
    if (!semResult.acquired) {
      return queueFull(
        semResult.estimatedWaitMs
          ? Math.ceil(semResult.estimatedWaitMs / 1000)
          : undefined
      );
    }

    // Create analysis record
    const { data: analysis, error } = await supabase
      .from("analyses")
      .insert({
        project_id: id,
        dataset_id: parsed.data.dataset_id,
        analysis_type: parsed.data.analysis_type,
        parameters_json: parsed.data.parameters,
        results_json: {},
        figures_urls: [],
        status: "pending",
      })
      .select("*")
      .single();

    if (error || !analysis) {
      console.error("Failed to create analysis:", error);
      return internalError();
    }

    // Run analysis asynchronously — prefer Inngest, fall back to inline execution
    const jobId = semResult.jobId!;

    if (process.env.INNGEST_EVENT_KEY) {
      // Inngest is configured — dispatch via durable workflow
      try {
        await inngest.send({
          name: "analysis/run.requested",
          data: {
            analysisId: analysis.id,
            projectId: id,
            jobId,
          },
        });
      } catch (inngestErr) {
        console.warn("Inngest dispatch failed, falling back to inline execution:", inngestErr);
        // Fall back to inline execution
        runAnalysisInline(analysis.id, jobId);
      }
    } else {
      // No Inngest — run inline (fire-and-forget)
      runAnalysisInline(analysis.id, jobId);
    }

    return NextResponse.json(
      { data: analysis as Analysis },
      { status: 202 }
    );
  } catch (err) {
    console.error("Unexpected error in POST analyses:", err);
    return internalError();
  }
}

// ── Inline analysis runner (fallback when Inngest is unavailable) ────────────

function runAnalysisInline(analysisId: string, jobId: string): void {
  // Fire-and-forget: run in background, release semaphore when done
  void (async () => {
    try {
      await executeAnalysis(analysisId);
    } catch (err) {
      console.error(`Inline analysis ${analysisId} failed:`, err);
    } finally {
      release(jobId);
    }
  })();
}
