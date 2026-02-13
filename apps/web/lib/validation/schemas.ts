import { z } from "zod";

export const projectCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  university_type: z.enum(["wbuhs", "ssuhs", "generic"]),
});

export const projectMetadataSchema = z.object({
  candidate_name: z.string().max(200).optional(),
  guide_name: z.string().max(200).optional(),
  hod_name: z.string().max(200).optional(),
  department: z.string().max(200).optional(),
  degree: z.string().max(100).optional(),
  speciality: z.string().max(200).optional(),
  registration_no: z.string().max(50).optional(),
  session: z.string().max(50).optional(),
  year: z.string().max(10).optional(),
});

export const projectUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  synopsis_text: z.string().optional(),
  study_type: z.string().max(100).optional(),
  university_type: z.enum(["wbuhs", "ssuhs", "generic"]).optional(),
  metadata_json: projectMetadataSchema.optional(),
});

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectMetadataInput = z.infer<typeof projectMetadataSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
