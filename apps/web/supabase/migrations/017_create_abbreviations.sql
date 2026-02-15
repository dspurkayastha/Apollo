-- 017: Create abbreviations table
-- Rollback: DROP TABLE IF EXISTS public.abbreviations CASCADE;

CREATE TABLE public.abbreviations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  short_form TEXT NOT NULL,
  long_form TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, short_form)
);

CREATE INDEX idx_abbreviations_project_id ON public.abbreviations(project_id);

ALTER TABLE public.abbreviations ENABLE ROW LEVEL SECURITY;

-- Users can view abbreviations for their own projects
CREATE POLICY "Users can view own abbreviations"
  ON public.abbreviations FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.user_id = public.get_current_user_id()
    )
  );

-- Users can create abbreviations for their own projects
CREATE POLICY "Users can create own abbreviations"
  ON public.abbreviations FOR INSERT TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.user_id = public.get_current_user_id()
    )
  );

-- Users can update abbreviations for their own projects
CREATE POLICY "Users can update own abbreviations"
  ON public.abbreviations FOR UPDATE TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.user_id = public.get_current_user_id()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.user_id = public.get_current_user_id()
    )
  );

-- Users can delete abbreviations for their own projects
CREATE POLICY "Users can delete own abbreviations"
  ON public.abbreviations FOR DELETE TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.user_id = public.get_current_user_id()
    )
  );

-- Auto-update updated_at
CREATE TRIGGER set_abbreviations_updated_at
  BEFORE UPDATE ON public.abbreviations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Audit trigger (uses audit_trigger_func from migration 014)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger_func') THEN
    CREATE TRIGGER abbreviations_audit
      AFTER INSERT OR UPDATE OR DELETE ON public.abbreviations
      FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
  END IF;
END;
$$;
