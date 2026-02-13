-- 005: Create sections table
-- Rollback: DROP TABLE IF EXISTS public.sections CASCADE;

CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_number INTEGER NOT NULL,
  phase_name TEXT NOT NULL,
  latex_content TEXT NOT NULL DEFAULT '',
  word_count INTEGER NOT NULL DEFAULT 0,
  citation_keys TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'review', 'approved')),
  ai_conversation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_sections_project_phase ON public.sections(project_id, phase_number);

ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project sections"
  ON public.sections FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can insert own project sections"
  ON public.sections FOR INSERT TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can update own project sections"
  ON public.sections FOR UPDATE TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can delete own project sections"
  ON public.sections FOR DELETE TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

-- Supervisors can read (not write) shared project sections
CREATE POLICY "Supervisors can view shared project sections"
  ON public.sections FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.metadata_json->>'supervisor_user_id' IN (
        SELECT u.id::text FROM public.users u
        WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
          AND u.role = 'supervisor'
      )
    )
  );

CREATE TRIGGER set_sections_updated_at
  BEFORE UPDATE ON public.sections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
