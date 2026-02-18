-- Migration 031: Database Audit Fixes
-- Fixes identified in comprehensive database audit (Phase 9 supplement)
--
-- Fixes applied:
--   H1:  thesis_licenses.project_id FK NO ACTION → SET NULL (unblocks project hard-delete)
--   H1b: figures.section_id FK NO ACTION → CASCADE (unblocks section cascade from project delete)
--   H2:  Enable RLS on processed_webhooks (defense-in-depth)
--   S1:  Set search_path = '' on all 9 public functions (6 SECURITY DEFINER + 3 trigger)
--   S2:  analyses.dataset_id FK NO ACTION → SET NULL (unblocks dataset replacement)
--   P2:  Add 6 missing FK indexes
--   P3:  Drop redundant idx_processed_webhooks_event_id

-- ============================================================
-- H1: thesis_licenses.project_id → projects.id: NO ACTION → SET NULL
-- Blocks project hard-delete for licensed projects (9.9 / 9.2)
-- ============================================================
ALTER TABLE public.thesis_licenses
  DROP CONSTRAINT IF EXISTS fk_thesis_licenses_project;
ALTER TABLE public.thesis_licenses
  ADD CONSTRAINT fk_thesis_licenses_project
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

-- ============================================================
-- H1b: figures.section_id → sections.id: NO ACTION → CASCADE
-- Blocks section deletion (and therefore project CASCADE chain)
-- Figures belong to sections — delete them together
-- ============================================================
ALTER TABLE public.figures
  DROP CONSTRAINT IF EXISTS figures_section_id_fkey;
ALTER TABLE public.figures
  ADD CONSTRAINT figures_section_id_fkey
    FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE CASCADE;

-- ============================================================
-- H2: Enable RLS on processed_webhooks (defense-in-depth)
-- Table is server-only, but RLS adds a safety net.
-- Mitigation plan says "intentional" — this is a hardening enhancement.
-- ============================================================
ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Server-only: no direct access"
  ON public.processed_webhooks FOR ALL
  USING (false);

-- ============================================================
-- S1: Set search_path = '' on all public functions
-- Prevents search_path hijacking (Supabase security best practice)
-- All functions use schema-qualified references or only NEW/OLD/now()
-- ============================================================
-- SECURITY DEFINER functions (highest priority)
ALTER FUNCTION public.attach_licence_to_project(uuid, uuid, uuid) SET search_path = '';
ALTER FUNCTION public.audit_trigger_func() SET search_path = '';
ALTER FUNCTION public.get_current_user_id() SET search_path = '';
ALTER FUNCTION public.get_current_user_org_id() SET search_path = '';
ALTER FUNCTION public.get_current_user_role() SET search_path = '';
ALTER FUNCTION public.is_current_user_admin() SET search_path = '';
-- Non-SECURITY DEFINER trigger functions (lower risk, clears advisor warnings)
ALTER FUNCTION public.prevent_identity_change() SET search_path = '';
ALTER FUNCTION public.enforce_transfer_cooldown() SET search_path = '';
ALTER FUNCTION public.set_updated_at() SET search_path = '';

-- ============================================================
-- S2: analyses.dataset_id → datasets.id: NO ACTION → SET NULL
-- Unblocks independent dataset replacement without losing analysis records
-- (Project cascade deletion already works via analyses.project_id CASCADE)
-- ============================================================
ALTER TABLE public.analyses
  DROP CONSTRAINT IF EXISTS analyses_dataset_id_fkey;
ALTER TABLE public.analyses
  ADD CONSTRAINT analyses_dataset_id_fkey
    FOREIGN KEY (dataset_id) REFERENCES public.datasets(id) ON DELETE SET NULL;

-- ============================================================
-- P2: Add indexes on unindexed foreign key columns
-- Improves CASCADE delete performance and JOIN queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_analyses_dataset_id
  ON public.analyses(dataset_id);
CREATE INDEX IF NOT EXISTS idx_citations_attested_by_user_id
  ON public.citations(attested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_figures_section_id
  ON public.figures(section_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_review_token_id
  ON public.review_comments(review_token_id);
CREATE INDEX IF NOT EXISTS idx_review_tokens_created_by
  ON public.review_tokens(created_by);
CREATE INDEX IF NOT EXISTS idx_sections_ai_conversation_id
  ON public.sections(ai_conversation_id);

-- ============================================================
-- P3: Drop redundant index (covered by unique constraint)
-- idx_processed_webhooks_event_id duplicates unique constraint index
-- ============================================================
DROP INDEX IF EXISTS public.idx_processed_webhooks_event_id;
