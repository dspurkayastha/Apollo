import * as Sentry from "@sentry/nextjs";
import { callRPlumber, RPlumberError } from "./client";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  ANALYSIS_TIMEOUTS,
  type AnalysisType,
} from "@/lib/validation/analysis-schemas";
import type { Analysis } from "@/lib/types/database";

/** R Plumber response shape (consistent across all endpoints) */
export interface RAnalysisResponse {
  summary: Record<string, unknown>;
  table_latex: string;
  figures: { filename: string; base64: string }[];
  warnings: string[];
  r_script: string;
}

/** Result of running an analysis */
export interface AnalysisResult {
  results_json: Record<string, unknown>;
  figures_urls: string[];
  r_script: string;
  warnings: string[];
}

/** Map analysis type to R Plumber endpoint */
const ENDPOINT_MAP: Record<AnalysisType, string> = {
  descriptive: "/descriptive",
  "chi-square": "/chi-square",
  "t-test": "/t-test",
  correlation: "/correlation",
  survival: "/survival",
  roc: "/roc",
  logistic: "/logistic",
  kruskal: "/kruskal",
  "meta-analysis": "/meta-analysis",
};

/**
 * Run a statistical analysis by dispatching to the correct R Plumber endpoint.
 * Updates the analysis record in the database with results.
 */
export async function runAnalysis(
  analysis: Analysis,
  datasetRows: Record<string, unknown>[]
): Promise<AnalysisResult> {
  const analysisType = analysis.analysis_type as AnalysisType;
  const endpoint = ENDPOINT_MAP[analysisType];
  const timeout = ANALYSIS_TIMEOUTS[analysisType] ?? 30_000;
  const params = analysis.parameters_json;

  if (!endpoint) {
    throw new Error(`Unknown analysis type: ${analysisType}`);
  }

  // Build the request body
  const requestBody: Record<string, unknown> = {
    data: datasetRows,
    outcome: params.outcome,
    predictor: params.predictor,
    group: params.group,
    time: params.time,
    event: params.event,
    confidence_level: params.confidence_level ?? 0.95,
  };

  const { data: rResult } = await Sentry.startSpan(
    {
      name: `r-plumber.${analysisType}`,
      op: "r.analysis",
      attributes: {
        "analysis.type": analysisType,
        "analysis.endpoint": endpoint,
        "analysis.timeout_ms": timeout,
        "analysis.id": analysis.id,
        "project.id": analysis.project_id,
      },
    },
    () => callRPlumber<RAnalysisResponse>(endpoint, requestBody, timeout)
  );

  // Process figures — store base64 references (real R2 upload in production)
  const figureUrls: string[] = [];
  const supabase = createAdminSupabaseClient();

  for (const fig of rResult.figures ?? []) {
    if (!fig || !fig.base64) continue;

    const figureUrl = `figures/${analysis.project_id}/${analysis.id}/${fig.filename}`;
    figureUrls.push(figureUrl);

    // Insert figure record
    await supabase.from("figures").insert({
      project_id: analysis.project_id,
      figure_type: analysisType,
      source_tool: "ggplot2",
      source_code: rResult.r_script,
      file_url: figureUrl,
      caption: `${analysisType} analysis — ${fig.filename}`,
      label: `fig:${analysisType}-${fig.filename.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-]/g, "-")}`,
      width_pct: 100,
      dpi: 300,
      format: "pdf",
    });
  }

  return {
    results_json: {
      summary: rResult.summary,
      table_latex: rResult.table_latex,
    },
    figures_urls: figureUrls,
    r_script: rResult.r_script ?? "",
    warnings: rResult.warnings ?? [],
  };
}

/**
 * Execute analysis end-to-end: fetch data, run R, update DB status.
 */
export async function executeAnalysis(analysisId: string): Promise<void> {
  const supabase = createAdminSupabaseClient();

  // Update status to running
  await supabase
    .from("analyses")
    .update({ status: "running" })
    .eq("id", analysisId);

  try {
    // Fetch analysis + dataset
    const { data: analysis, error: fetchErr } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", analysisId)
      .single();

    if (fetchErr || !analysis) {
      throw new Error(`Analysis ${analysisId} not found`);
    }

    const typedAnalysis = analysis as Analysis;

    if (!typedAnalysis.dataset_id) {
      throw new Error("Analysis has no associated dataset");
    }

    // Fetch dataset with stored rows
    const { data: dataset } = await supabase
      .from("datasets")
      .select("*")
      .eq("id", typedAnalysis.dataset_id)
      .single();

    if (!dataset) {
      throw new Error(`Dataset ${typedAnalysis.dataset_id} not found`);
    }

    // Use stored rows_json — falls back to empty array if not yet migrated
    const datasetRows = (dataset.rows_json as Record<string, unknown>[] | null) ?? [];
    if (datasetRows.length === 0) {
      console.warn(
        `Dataset ${typedAnalysis.dataset_id} has no rows_json — analysis may produce empty results`
      );
    }

    const result = await runAnalysis(typedAnalysis, datasetRows);

    // Update analysis with results
    await supabase
      .from("analyses")
      .update({
        status: "completed",
        results_json: result.results_json,
        figures_urls: result.figures_urls,
        r_script: result.r_script,
      })
      .eq("id", analysisId);
  } catch (err) {
    const errorMessage =
      err instanceof RPlumberError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown error";

    await supabase
      .from("analyses")
      .update({
        status: "failed",
        results_json: { error: errorMessage },
      })
      .eq("id", analysisId);

    throw err;
  }
}
