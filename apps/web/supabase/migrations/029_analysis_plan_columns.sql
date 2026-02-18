-- Migration 029: Add analysis plan columns (Phase 6a/6b split)
-- Adds sub-phase state for Phase 6: analysis_plan_json stores the AI-generated
-- plan, analysis_plan_status gates between 6a (planning) and 6b (execution).

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS analysis_plan_json jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS analysis_plan_status text DEFAULT 'pending'
    CHECK (analysis_plan_status IN ('pending', 'planning', 'review', 'approved'));

COMMENT ON COLUMN public.projects.analysis_plan_json IS
  'AI-generated analysis plan: array of { analysis_type, variables, rationale, objective, suggested_figures }';
COMMENT ON COLUMN public.projects.analysis_plan_status IS
  'Sub-phase gate for Phase 6a/6b. Must be "approved" before Results generation.';
