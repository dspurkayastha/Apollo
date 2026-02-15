import { z } from "zod";

export const datasetUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  content_type: z.enum([
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]),
});

export const datasetColumnsSchema = z.object({
  columns: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["numeric", "categorical", "date", "text"]),
      role: z
        .enum(["outcome", "predictor", "group", "time", "event", "ignore"])
        .optional(),
    })
  ),
});

export const datasetGenerateSchema = z.object({
  sample_size: z.number().int().min(10).max(1000).optional(),
  variables: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        type: z.enum(["numeric", "categorical", "date"]),
        categories: z.array(z.string()).optional(),
        range: z.tuple([z.number(), z.number()]).optional(),
      })
    )
    .optional(),
});

export type DatasetUploadInput = z.infer<typeof datasetUploadSchema>;
export type DatasetColumnsInput = z.infer<typeof datasetColumnsSchema>;
export type DatasetGenerateInput = z.infer<typeof datasetGenerateSchema>;
