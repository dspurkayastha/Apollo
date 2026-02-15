import { z } from "zod";

export const figureUploadSchema = z.object({
  caption: z.string().min(1).max(500),
  label: z
    .string()
    .min(1)
    .max(100)
    .regex(/^fig:[a-z0-9-]+$/, "Label must match fig:lowercase-dashes"),
  section_id: z.string().uuid().optional(),
  width_pct: z.number().int().min(25).max(100).default(100),
});

export const mermaidGenerateSchema = z.object({
  source_code: z.string().min(10).max(5000),
  caption: z.string().min(1).max(500),
  label: z
    .string()
    .min(1)
    .max(100)
    .regex(/^fig:[a-z0-9-]+$/, "Label must match fig:lowercase-dashes"),
  figure_type: z.string().default("flowchart"),
});

export type FigureUploadInput = z.infer<typeof figureUploadSchema>;
export type MermaidGenerateInput = z.infer<typeof mermaidGenerateSchema>;
