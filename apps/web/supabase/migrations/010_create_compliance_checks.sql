-- 010: Create compliance_checks table
-- Rollback: DROP TABLE IF EXISTS public.compliance_checks CASCADE;

CREATE TABLE public.compliance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  guideline_type TEXT NOT NULL CHECK (guideline_type IN ('CONSORT', 'STROBE', 'PRISMA', 'STARD', 'CARE')),
  checklist_json JSONB NOT NULL DEFAULT '[]',
  overall_score NUMERIC,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_compliance_checks_project_id ON public.compliance_checks(project_id);

ALTER TABLE public.compliance_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project compliance checks"
  ON public.compliance_checks FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can insert own project compliance checks"
  ON public.compliance_checks FOR INSERT TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can update own project compliance checks"
  ON public.compliance_checks FOR UPDATE TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );
