-- Migration 030: Privacy & Compliance (Phase 9)
-- Adds deletion tracking, AI consent, analytics consent columns to users.
-- Adds ON DELETE CASCADE to all foreign keys that reference users.id or projects.id
-- so that account/project deletion cascades cleanly.

-- 1. Users: deletion tracking + consent columns
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_consent_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS analytics_consent BOOLEAN DEFAULT FALSE;

-- 2. Fix projects.user_id FK (missing CASCADE blocks user deletion)
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_user_id_fkey;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 3. Fix thesis_licenses.user_id FK (missing CASCADE blocks user deletion)
ALTER TABLE public.thesis_licenses
  DROP CONSTRAINT IF EXISTS thesis_licenses_user_id_fkey;
ALTER TABLE public.thesis_licenses
  ADD CONSTRAINT thesis_licenses_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 4. Fix citations.attested_by_user_id FK (SET NULL — preserve citation data on user deletion)
ALTER TABLE public.citations
  DROP CONSTRAINT IF EXISTS citations_attested_by_user_id_fkey;
ALTER TABLE public.citations
  ADD CONSTRAINT citations_attested_by_user_id_fkey
    FOREIGN KEY (attested_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- 5. Audit log: ON DELETE CASCADE for project_id (item 9.7)
ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_project_id_fkey;
ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- 6. Audit log: ON DELETE CASCADE for user_id (item 9.7)
ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_user_id_fkey;
ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
