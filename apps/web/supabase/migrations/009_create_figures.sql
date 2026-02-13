-- 009: Create figures table
-- Rollback: DROP TABLE IF EXISTS public.figures CASCADE;

CREATE TABLE public.figures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id),
  figure_type TEXT NOT NULL,
  source_tool TEXT NOT NULL CHECK (source_tool IN ('ggplot2', 'mermaid', 'tikz', 'upload')),
  source_code TEXT,
  file_url TEXT,
  caption TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  width_pct INTEGER NOT NULL DEFAULT 100,
  dpi INTEGER NOT NULL DEFAULT 300,
  format TEXT NOT NULL DEFAULT 'png' CHECK (format IN ('png', 'pdf', 'svg')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_figures_project_id ON public.figures(project_id);

ALTER TABLE public.figures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project figures"
  ON public.figures FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can insert own project figures"
  ON public.figures FOR INSERT TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can update own project figures"
  ON public.figures FOR UPDATE TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can delete own project figures"
  ON public.figures FOR DELETE TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );
