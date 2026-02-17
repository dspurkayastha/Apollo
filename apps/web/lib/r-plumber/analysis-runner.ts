import * as Sentry from "@sentry/nextjs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import os from "os";
import { callRPlumber, RPlumberError } from "./client";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  ANALYSIS_TIMEOUTS,
  REQUIRED_PARAMS,
  type AnalysisType,
} from "@/lib/validation/analysis-schemas";
import type { Analysis } from "@/lib/types/database";

/** Base directory for figure file storage (dev: tmpdir, prod: R2) */
const FIGURES_BASE_DIR = path.join(os.tmpdir(), "apollo-figures");

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

  // Pre-flight: validate data is not empty
  if (datasetRows.length === 0) {
    throw new Error(
      `Cannot run ${analysisType} analysis: dataset has no rows. ` +
      "Please re-upload the dataset file."
    );
  }

  // Pre-flight: validate required parameters are present
  const requiredParams = REQUIRED_PARAMS[analysisType] ?? [];
  const missingParams = requiredParams.filter(
    (key) => !params[key] || (typeof params[key] === "string" && params[key].trim() === "")
  );
  if (missingParams.length > 0) {
    throw new Error(
      `Cannot run ${analysisType} analysis: missing required parameters: ${missingParams.join(", ")}. ` +
      "Please specify the required column mappings."
    );
  }

  // Pre-flight: validate that referenced columns exist in the dataset
  const dataColumns = Object.keys(datasetRows[0] ?? {});
  const columnParams = ["outcome", "predictor", "group", "time", "event"] as const;
  for (const key of columnParams) {
    const colName = params[key] as string | undefined;
    if (colName && colName.trim() !== "" && !colName.includes(",")) {
      // Single column reference — check it exists (skip comma-separated predictors)
      if (!dataColumns.includes(colName)) {
        throw new Error(
          `Column "${colName}" (${key}) not found in dataset. ` +
          `Available columns: ${dataColumns.join(", ")}`
        );
      }
    }
  }

  // Build the request body — only include defined parameters
  const requestBody: Record<string, unknown> = {
    data: datasetRows,
    confidence_level: params.confidence_level ?? 0.95,
  };
  // Only add non-empty string parameters to avoid sending undefined/null to R
  for (const key of columnParams) {
    const val = params[key] as string | undefined;
    if (val && val.trim() !== "") {
      requestBody[key] = val;
    }
  }
  // Pass figure preferences if present
  const figPrefs = params.figure_preferences as Record<string, unknown> | undefined;
  if (figPrefs) {
    if (figPrefs.chart_type && figPrefs.chart_type !== "auto") {
      requestBody.chart_type = figPrefs.chart_type;
    }
    if (figPrefs.colour_scheme && figPrefs.colour_scheme !== "default") {
      requestBody.colour_scheme = figPrefs.colour_scheme;
    }
  }

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

  // Process figures — decode base64 and write to disk + insert DB record
  const figureUrls: string[] = [];
  const supabase = createAdminSupabaseClient();

  for (const fig of rResult.figures ?? []) {
    if (!fig || !fig.base64) continue;

    const figureUrl = `figures/${analysis.project_id}/${analysis.id}/${fig.filename}`;
    figureUrls.push(figureUrl);

    // Write decoded figure file to disk so LaTeX compile can find it
    try {
      const figDir = path.join(
        FIGURES_BASE_DIR,
        analysis.project_id,
        analysis.id
      );
      await mkdir(figDir, { recursive: true });
      const figPath = path.join(figDir, fig.filename);
      const buffer = Buffer.from(fig.base64, "base64");
      await writeFile(figPath, buffer);
    } catch (err) {
      console.warn(`Failed to write figure file ${figureUrl}:`, err);
    }

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

    // Use stored rows_json — fail if missing (dataset must be re-uploaded)
    const datasetRows = dataset.rows_json as Record<string, unknown>[] | null;
    if (!datasetRows || datasetRows.length === 0) {
      throw new Error(
        `Dataset ${typedAnalysis.dataset_id} has no stored data (rows_json is empty). ` +
        "The dataset file may need to be re-uploaded."
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
