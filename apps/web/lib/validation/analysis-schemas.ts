import { z } from "zod";

export const analysisTypes = [
  "descriptive",
  "chi-square",
  "t-test",
  "correlation",
  "survival",
  "roc",
  "logistic",
  "kruskal",
  "meta-analysis",
] as const;

export type AnalysisType = (typeof analysisTypes)[number];

export const analysisCreateSchema = z.object({
  dataset_id: z.string().uuid(),
  analysis_type: z.enum(analysisTypes),
  parameters: z.object({
    outcome: z.string().optional(),
    predictor: z.string().optional(),
    group: z.string().optional(),
    time: z.string().optional(),
    event: z.string().optional(),
    confidence_level: z.number().min(0.8).max(0.99).default(0.95),
  }),
});

export type AnalysisCreateInput = z.infer<typeof analysisCreateSchema>;

export const autoDetectSchema = z.object({
  dataset_id: z.string().uuid(),
});

export type AutoDetectInput = z.infer<typeof autoDetectSchema>;

export interface AnalysisRecommendation {
  analysis_type: AnalysisType;
  rationale: string;
  parameters: {
    outcome?: string;
    predictor?: string;
    group?: string;
    time?: string;
    event?: string;
  };
  confidence: "high" | "medium" | "low";
}

/** Timeout per analysis type in milliseconds */
export const ANALYSIS_TIMEOUTS: Record<AnalysisType, number> = {
  descriptive: 15_000,
  "chi-square": 30_000,
  "t-test": 30_000,
  correlation: 30_000,
  survival: 45_000,
  roc: 45_000,
  logistic: 45_000,
  kruskal: 30_000,
  "meta-analysis": 60_000,
};
