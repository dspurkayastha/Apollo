import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  validationError,
  internalError,
  rateLimited,
  badRequest,
} from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAnthropicClient } from "@/lib/ai/client";
import { recordTokenUsage } from "@/lib/ai/token-budget";
import { ANALYSIS_PLANNING_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  analysisPlanSchema,
} from "@/lib/validation/analysis-plan-schemas";

// ── GET /api/projects/:id/analyses/plan — Get current analysis plan ──────────

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
      .select("id, analysis_plan_json, analysis_plan_status")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    return NextResponse.json({
      data: {
        plan: project.analysis_plan_json ?? [],
        status: project.analysis_plan_status ?? "pending",
      },
    });
  } catch (err) {
    console.error("Unexpected error in GET analysis plan:", err);
    return internalError();
  }
}

// ── POST /api/projects/:id/analyses/plan — Generate AI analysis plan ─────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const rateCheck = await checkRateLimit(authResult.user.id);
    if (!rateCheck.allowed) return rateLimited(rateCheck.retryAfterSeconds);

    const { id } = await params;
    const supabase = createAdminSupabaseClient();

    const { data: project } = await supabase
      .from("projects")
      .select("id, synopsis_text, study_type, metadata_json, analysis_plan_status")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    // Guard: cannot regenerate an approved plan (analyses may have already run)
    if (project.analysis_plan_status === "approved") {
      return badRequest(
        "Analysis plan is already approved. Reset the plan status before regenerating."
      );
    }

    // Pre-flight: at least one dataset must exist
    const { data: datasets } = await supabase
      .from("datasets")
      .select("id, columns_json, rows_json, row_count")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!datasets || datasets.length === 0) {
      return badRequest(
        "Upload or generate a dataset before creating an analysis plan."
      );
    }

    const dataset = datasets[0];
    const columns = (dataset.columns_json ?? []) as { name: string; type: string }[];

    // Fetch ROL section (Phase 4) for context
    const { data: rolSection } = await supabase
      .from("sections")
      .select("latex_content")
      .eq("project_id", id)
      .eq("phase_number", 4)
      .single();

    // Extract objectives from metadata
    const metadata = project.metadata_json as Record<string, unknown> | null;
    const objectives = (metadata?.objectives as string[]) ?? [];

    // Set status to "planning" while AI generates
    await supabase
      .from("projects")
      .update({ analysis_plan_status: "planning" })
      .eq("id", id);

    // Build user prompt
    let userPrompt = `Study type: ${project.study_type ?? "Observational"}\n\n`;

    if (project.synopsis_text) {
      userPrompt += `Synopsis:\n${project.synopsis_text}\n\n`;
    }

    if (objectives.length > 0) {
      userPrompt += `Study objectives:\n${objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}\n\n`;
    }

    if (rolSection?.latex_content) {
      userPrompt += `Review of Literature findings (for expected effect sizes and prevalence):\n${rolSection.latex_content}\n\n`;
    }

    userPrompt += `Dataset columns (${columns.length} columns, ${dataset.row_count ?? 0} rows):\n`;
    for (const col of columns) {
      userPrompt += `- ${col.name} (${col.type})\n`;
    }

    userPrompt += "\nGenerate the analysis plan as a JSON array.";

    // Call Claude Haiku for planning
    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: ANALYSIS_PLANNING_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    // Record token usage
    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    void recordTokenUsage(
      id,
      6,
      inputTokens,
      outputTokens,
      "claude-haiku-4-5-20251001"
    ).catch(console.error);

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      await supabase
        .from("projects")
        .update({ analysis_plan_status: "pending" })
        .eq("id", id);
      return internalError("AI returned no text content");
    }

    // Parse AI response
    let planRaw: unknown;
    try {
      let jsonText = textBlock.text.trim();
      jsonText = jsonText.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "");
      planRaw = JSON.parse(jsonText);
    } catch {
      await supabase
        .from("projects")
        .update({ analysis_plan_status: "pending" })
        .eq("id", id);
      return internalError("AI returned invalid JSON for analysis plan");
    }

    const planResult = analysisPlanSchema.safeParse(planRaw);
    if (!planResult.success) {
      await supabase
        .from("projects")
        .update({ analysis_plan_status: "pending" })
        .eq("id", id);
      return internalError("AI analysis plan failed validation");
    }

    // Save plan and set status to "review"
    const { error: updateError } = await supabase
      .from("projects")
      .update({
        analysis_plan_json: planResult.data as unknown as Record<string, unknown>[],
        analysis_plan_status: "review",
      })
      .eq("id", id);

    if (updateError) {
      console.error("Failed to save analysis plan:", updateError);
      return internalError();
    }

    return NextResponse.json({
      data: {
        plan: planResult.data,
        status: "review",
      },
    });
  } catch (err) {
    console.error("Unexpected error in POST analysis plan:", err);
    return internalError();
  }
}

// ── PUT /api/projects/:id/analyses/plan — Student edits to plan ──────────────

export async function PUT(
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
      .select("id, analysis_plan_status")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    if (project.analysis_plan_status !== "review") {
      return badRequest(
        "Analysis plan can only be edited when in review status."
      );
    }

    const body = await request.json();
    const planResult = analysisPlanSchema.safeParse(body.plan);
    if (!planResult.success) {
      return validationError("Invalid analysis plan", {
        issues: planResult.error.issues,
      });
    }

    const { error: updateError } = await supabase
      .from("projects")
      .update({
        analysis_plan_json: planResult.data as unknown as Record<string, unknown>[],
      })
      .eq("id", id);

    if (updateError) {
      console.error("Failed to update analysis plan:", updateError);
      return internalError();
    }

    return NextResponse.json({
      data: {
        plan: planResult.data,
        status: "review",
      },
    });
  } catch (err) {
    console.error("Unexpected error in PUT analysis plan:", err);
    return internalError();
  }
}
