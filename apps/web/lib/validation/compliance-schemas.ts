import { z } from "zod";

export const guidelineTypes = [
  "CONSORT",
  "STROBE",
  "PRISMA",
  "STARD",
  "CARE",
] as const;

export type GuidelineTypeEnum = (typeof guidelineTypes)[number];

export const complianceRunSchema = z.object({
  guideline_type: z.enum(guidelineTypes),
});

export type ComplianceRunInput = z.infer<typeof complianceRunSchema>;
