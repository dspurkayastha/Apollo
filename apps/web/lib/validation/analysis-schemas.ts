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

export const figurePreferencesSchema = z.object({
  chart_type: z.enum([
    "auto", "bar", "box", "scatter", "line", "forest",
    "kaplan-meier", "heatmap", "violin",
  ]).default("auto"),
  colour_scheme: z.enum(["default", "greyscale", "colourblind-safe"]).default("default"),
  include_table: z.boolean().default(true),
}).optional();

export const analysisRunSchema = analysisCreateSchema.extend({
  figure_preferences: figurePreferencesSchema,
});

export type AnalysisCreateInput = z.infer<typeof analysisCreateSchema>;
export type FigurePreferences = z.infer<typeof figurePreferencesSchema>;

export const autoDetectSchema = z.object({
  dataset_id: z.string().uuid(),
});

export type AutoDetectInput = z.infer<typeof autoDetectSchema>;

export interface SuggestedFigure {
  chart_type: string;
  description: string;
}

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
  suggested_figures?: SuggestedFigure[];
}

/** Required parameters per analysis type — used for pre-flight validation */
export const REQUIRED_PARAMS: Record<AnalysisType, readonly string[]> = {
  descriptive: [],                    // group is optional
  "chi-square": ["outcome", "predictor"],
  "t-test": ["outcome", "group"],
  correlation: ["outcome", "predictor"],
  survival: ["time", "event"],        // group is optional
  roc: ["outcome", "predictor"],
  logistic: ["outcome"],              // predictor is optional (falls back to all other cols)
  kruskal: ["outcome", "group"],
  "meta-analysis": [],                // validates column names (study, effect_size, se) in R
};

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
