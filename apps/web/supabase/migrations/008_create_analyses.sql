-- 008: Create analyses table
-- Rollback: DROP TABLE IF EXISTS public.analyses CASCADE;

CREATE TABLE public.analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  dataset_id UUID REFERENCES public.datasets(id),
  analysis_type TEXT NOT NULL,
  parameters_json JSONB NOT NULL DEFAULT '{}',
  results_json JSONB NOT NULL DEFAULT '{}',
  figures_urls TEXT[] NOT NULL DEFAULT '{}',
  r_script TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analyses_project_id ON public.analyses(project_id);

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project analyses"
  ON public.analyses FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can insert own project analyses"
  ON public.analyses FOR INSERT TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can update own project analyses"
  ON public.analyses FOR UPDATE TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );
