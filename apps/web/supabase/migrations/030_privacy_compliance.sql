-- Migration 030: Privacy & Compliance (Phase 9)
-- Adds deletion tracking, AI consent, analytics consent columns to users.
-- Adds ON DELETE CASCADE to all foreign keys that block user deletion.
-- Fixes audit_log FKs (item 9.7) AND projects/thesis_licenses/review_tokens user FKs.

-- Users: deletion tracking + consent
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_consent_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS analytics_consent BOOLEAN DEFAULT FALSE;

-- ── Fix projects.user_id FK (missing CASCADE blocks user deletion) ──
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_user_id_fkey;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ── Fix thesis_licenses.user_id FK (missing CASCADE blocks user deletion) ──
ALTER TABLE public.thesis_licenses
  DROP CONSTRAINT IF EXISTS thesis_licenses_user_id_fkey;

ALTER TABLE public.thesis_licenses
  ADD CONSTRAINT thesis_licenses_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ── Fix review_tokens.created_by FK (missing CASCADE blocks user deletion) ──
ALTER TABLE public.review_tokens
  DROP CONSTRAINT IF EXISTS review_tokens_created_by_fkey;

ALTER TABLE public.review_tokens
  ADD CONSTRAINT review_tokens_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;

-- ── Audit log: add ON DELETE CASCADE for project_id (9.7) ──
ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_project_id_fkey;

ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- ── Audit log: add ON DELETE CASCADE for user_id (9.7) ──
ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_user_id_fkey;

ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
