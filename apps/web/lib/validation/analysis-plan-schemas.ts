import { z } from "zod";
import { analysisTypes } from "./analysis-schemas";

export const plannedAnalysisSchema = z.object({
  id: z.string(),
  objective: z.string(),
  analysis_type: z.enum(analysisTypes),
  rationale: z.string(),
  variables: z.object({
    outcome: z.string().optional(),
    predictor: z.string().optional(),
    group: z.string().optional(),
    time: z.string().optional(),
    event: z.string().optional(),
  }),
  suggested_figures: z
    .array(
      z.object({
        chart_type: z.string(),
        description: z.string(),
      })
    )
    .default([]),
  status: z
    .enum(["planned", "running", "completed", "failed", "skipped"])
    .default("planned"),
});

export type PlannedAnalysis = z.infer<typeof plannedAnalysisSchema>;

export const analysisPlanSchema = z.array(plannedAnalysisSchema).min(1).max(15);
export type AnalysisPlan = z.infer<typeof analysisPlanSchema>;
