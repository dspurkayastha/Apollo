import { z } from "zod";

export const sectionUpdateSchema = z.object({
  latex_content: z.string().optional(),
  rich_content_json: z.record(z.unknown()).optional(),
  status: z.enum(["draft", "generating", "review", "approved"]).optional(),
});

export const sectionApproveSchema = z.object({
  // No body required — the approve action is triggered by the route itself.
  // Optional comment for audit trail.
  comment: z.string().max(1000).optional(),
});

export const generateRequestSchema = z.object({
  // Phase 0: synopsis text is read from the project
  // Other phases may include additional parameters
  instructions: z.string().max(5000).optional(),
});

export type SectionUpdateInput = z.infer<typeof sectionUpdateSchema>;
export type SectionApproveInput = z.infer<typeof sectionApproveSchema>;
export type GenerateRequestInput = z.infer<typeof generateRequestSchema>;
