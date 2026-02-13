-- 007: Create datasets table
-- Rollback: DROP TABLE IF EXISTS public.datasets CASCADE;

CREATE TABLE public.datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  row_count INTEGER,
  columns_json JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_datasets_project_id ON public.datasets(project_id);

ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project datasets"
  ON public.datasets FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can insert own project datasets"
  ON public.datasets FOR INSERT TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can delete own project datasets"
  ON public.datasets FOR DELETE TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );
