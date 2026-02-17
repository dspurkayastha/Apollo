import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  validationError,
  internalError,
} from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAnthropicClient } from "@/lib/ai/client";
import {
  autoDetectSchema,
  analysisTypes,
  REQUIRED_PARAMS,
} from "@/lib/validation/analysis-schemas";
import type { AnalysisRecommendation } from "@/lib/validation/analysis-schemas";

const PARAM_KEYS = ["outcome", "predictor", "group", "time", "event"] as const;

/** Normalise AI-generated parameters: arrays → first element, non-strings → drop */
function normaliseParameters(
  raw: Record<string, unknown> | undefined
): AnalysisRecommendation["parameters"] {
  if (!raw || typeof raw !== "object") return {};
  const result: Record<string, string> = {};
  for (const key of PARAM_KEYS) {
    const val = raw[key];
    if (typeof val === "string" && val.length > 0) {
      result[key] = val;
    } else if (Array.isArray(val) && val.length > 0 && typeof val[0] === "string") {
      result[key] = val[0];
    }
  }
  return result;
}

// ── POST /api/projects/:id/analyses/auto-detect ─────────────────────────────
// Accepts { dataset_id }, returns up to 5 AI-recommended analyses

export async function POST(
  request: NextRequest,
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
      .select("id, study_type, title")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    // Validate body
    const body = await request.json();
    const parsed = autoDetectSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("Invalid parameters", {
        issues: parsed.error.issues,
      });
    }

    // Fetch dataset — include rows_json to verify data is available
    const { data: dataset } = await supabase
      .from("datasets")
      .select("id, columns_json, row_count, rows_json, file_url")
      .eq("id", parsed.data.dataset_id)
      .eq("project_id", id)
      .single();

    if (!dataset) return notFound("Dataset not found");

    // Pre-flight: verify the dataset actually has stored row data
    const hasRows = Array.isArray(dataset.rows_json) && (dataset.rows_json as unknown[]).length > 0;
    if (!hasRows) {
      return validationError(
        "Dataset has no stored row data. Please delete this dataset and generate or upload a new one."
      );
    }

    // Fetch Phase 0 synopsis section for context
    const { data: synopsisSection } = await supabase
      .from("sections")
      .select("latex_content")
      .eq("project_id", id)
      .eq("phase_number", 0)
      .maybeSingle();

    const columns = (dataset.columns_json ?? []) as { name: string; type: string }[];
    const columnsDescription = columns
      .map((c) => `${c.name} (${c.type})`)
      .join(", ");

    const prompt = `You are a biostatistics expert helping a medical thesis student choose statistical analyses.

Study type: ${project.study_type ?? "unknown"}
Dataset: ${dataset.row_count} rows, columns: ${columnsDescription}
${synopsisSection?.latex_content ? `Synopsis context: ${synopsisSection.latex_content.slice(0, 1500)}` : ""}

Available analysis types: ${analysisTypes.join(", ")}

Recommend up to 5 analyses from the available types. For each, provide:
- analysis_type: exactly one of the available types
- rationale: 1-2 sentences explaining why this analysis suits the data
- parameters: map dataset columns to roles (outcome, predictor, group, time, event) — use exact column names
- confidence: "high", "medium", or "low"
- suggested_figures: array of 1-3 objects with { chart_type, description } — recommend appropriate visualisations. Available chart_type values: bar, box, scatter, line, forest, kaplan-meier, heatmap, violin

Order by confidence (highest first). Only recommend analyses that genuinely suit the data columns and study type.

Respond with ONLY a JSON array of recommendations, no markdown fences or other text.`;

    const anthropic = getAnthropicClient();
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      msg.content[0].type === "text" ? msg.content[0].text.trim() : "";

    let recommendations: AnalysisRecommendation[] = [];
    try {
      // Strip markdown fences if AI wrapped output in ```json ... ```
      const cleaned = text
        .replace(/```json?\s*\n?/gi, "")
        .replace(/```\s*$/gm, "")
        .trim();

      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // Fallback: try extracting a JSON array from the text
        const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          parsed = JSON.parse(arrayMatch[0]);
        }
      }

      if (Array.isArray(parsed)) {
        const columnNames = columns.map((c) => c.name);

        recommendations = parsed
          .filter(
            (r: Record<string, unknown>) =>
              typeof r.analysis_type === "string" &&
              analysisTypes.includes(r.analysis_type as (typeof analysisTypes)[number])
          )
          .map((r: Record<string, unknown>) => ({
            analysis_type: r.analysis_type as AnalysisRecommendation["analysis_type"],
            rationale: typeof r.rationale === "string" ? r.rationale : "",
            confidence: (["high", "medium", "low"].includes(r.confidence as string)
              ? r.confidence
              : "medium") as AnalysisRecommendation["confidence"],
            // Normalise parameters: AI may return arrays — take first element
            parameters: normaliseParameters(
              r.parameters as Record<string, unknown> | undefined
            ),
          }))
          // Drop recommendations missing required parameters
          .filter((rec) => {
            const required = REQUIRED_PARAMS[rec.analysis_type] ?? [];
            const params = rec.parameters as Record<string, string | undefined>;
            for (const key of required) {
              const val = params[key];
              if (!val || val.trim() === "") return false;
              // Also verify the column actually exists in the dataset
              if (!columnNames.includes(val)) return false;
            }
            return true;
          })
          .slice(0, 5);
      }
    } catch {
      // All parsing failed — return empty recommendations instead of 500
      console.warn("Failed to parse AI recommendations, returning empty:", text.slice(0, 200));
    }

    return NextResponse.json({ data: recommendations });
  } catch (err) {
    console.error("Auto-detect error:", err);

    // Provide more specific error responses
    if (err instanceof Error) {
      if (err.message.includes("timeout") || err.message.includes("ETIMEDOUT")) {
        return NextResponse.json(
          { error: { code: "GATEWAY_TIMEOUT", message: "AI recommendation timed out — please try again" } },
          { status: 504 }
        );
      }
      if (err.message.includes("API") || err.message.includes("rate")) {
        return NextResponse.json(
          { error: { code: "BAD_GATEWAY", message: "AI service temporarily unavailable" } },
          { status: 502 }
        );
      }
    }

    return internalError();
  }
}
