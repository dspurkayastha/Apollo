-- Deduplicate (keep most recent per project+guideline)
DELETE FROM public.compliance_checks a
USING public.compliance_checks b
WHERE a.project_id = b.project_id
  AND a.guideline_type = b.guideline_type
  AND a.last_checked_at < b.last_checked_at;

ALTER TABLE public.compliance_checks
  ADD CONSTRAINT uq_compliance_project_guideline UNIQUE (project_id, guideline_type);
