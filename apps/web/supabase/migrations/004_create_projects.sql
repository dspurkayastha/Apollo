-- 004: Create projects table
-- Rollback: DROP TABLE IF EXISTS public.projects CASCADE;

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  organisation_id UUID REFERENCES public.organisations(id),
  status TEXT NOT NULL DEFAULT 'sandbox' CHECK (status IN ('sandbox', 'licensed', 'completed', 'archived')),
  license_id UUID UNIQUE REFERENCES public.thesis_licenses(id),
  title TEXT NOT NULL DEFAULT '',
  synopsis_text TEXT,
  study_type TEXT,
  university_type TEXT CHECK (university_type IN ('wbuhs', 'ssuhs', 'generic')),
  metadata_json JSONB NOT NULL DEFAULT '{}',
  current_phase INTEGER NOT NULL DEFAULT 0,
  phases_completed INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_organisation_id ON public.projects(organisation_id);

-- Add FK from thesis_licenses.project_id to projects
ALTER TABLE public.thesis_licenses
  ADD CONSTRAINT fk_thesis_licenses_project
  FOREIGN KEY (project_id) REFERENCES public.projects(id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Users can view own projects
CREATE POLICY "Users can view own projects"
  ON public.projects FOR SELECT TO authenticated
  USING (
    user_id IN (
      SELECT u.id FROM public.users u
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

-- Users can insert own projects
CREATE POLICY "Users can create own projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (
      SELECT u.id FROM public.users u
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

-- Users can update own projects
CREATE POLICY "Users can update own projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (
    user_id IN (
      SELECT u.id FROM public.users u
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT u.id FROM public.users u
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

-- Users can delete own projects
CREATE POLICY "Users can delete own projects"
  ON public.projects FOR DELETE TO authenticated
  USING (
    user_id IN (
      SELECT u.id FROM public.users u
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

-- Admins can read all projects in their organisation
CREATE POLICY "Admins can view org projects"
  ON public.projects FOR SELECT TO authenticated
  USING (
    organisation_id IN (
      SELECT u.organisation_id FROM public.users u
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
        AND u.role = 'admin'
    )
  );

-- Supervisors can read shared project sections (via supervisor_id field in metadata)
CREATE POLICY "Supervisors can view shared projects"
  ON public.projects FOR SELECT TO authenticated
  USING (
    metadata_json->>'supervisor_user_id' IN (
      SELECT u.id::text FROM public.users u
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
        AND u.role = 'supervisor'
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
