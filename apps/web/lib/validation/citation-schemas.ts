import { z } from "zod";

export const citationCreateSchema = z
  .object({
    doi: z.string().max(500).trim().optional(),
    pmid: z.string().max(50).trim().optional(),
    cite_key: z.string().min(1).max(200).trim().optional(),
    bibtex_entry: z.string().max(10_000).trim().optional(),
  })
  .refine(
    (data) => data.doi || data.pmid || data.bibtex_entry,
    "Provide doi, pmid, or bibtex_entry"
  );

export const citationUpdateSchema = z.object({
  bibtex_entry: z.string().max(10_000).trim().optional(),
  provenance_tier: z.enum(["A", "B", "C", "D"]).optional(),
  evidence_type: z.enum(["doi", "pmid", "isbn", "url", "manual"]).optional(),
  evidence_value: z.string().max(1000).trim().optional(),
  attested: z.boolean().optional(),
});

export const citationSearchSchema = z.object({
  q: z.string().min(2).max(500).trim(),
  source: z.enum(["crossref", "pubmed"]).default("pubmed"),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export type CitationCreateInput = z.infer<typeof citationCreateSchema>;
export type CitationUpdateInput = z.infer<typeof citationUpdateSchema>;
export type CitationSearchInput = z.infer<typeof citationSearchSchema>;
