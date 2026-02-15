import { z } from "zod";

export const abbreviationCreateSchema = z.object({
  short_form: z.string().min(1).max(20).trim(),
  long_form: z.string().min(1).max(500).trim(),
});

export const abbreviationUpdateSchema = z.object({
  short_form: z.string().min(1).max(20).trim().optional(),
  long_form: z.string().min(1).max(500).trim().optional(),
});

export type AbbreviationCreateInput = z.infer<typeof abbreviationCreateSchema>;
export type AbbreviationUpdateInput = z.infer<typeof abbreviationUpdateSchema>;
