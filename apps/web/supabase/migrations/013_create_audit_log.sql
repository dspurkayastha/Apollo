-- 013: Create audit_log table
-- Rollback: DROP TABLE IF EXISTS public.audit_log CASCADE;

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  project_id UUID REFERENCES public.projects(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value_json JSONB,
  new_value_json JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_project_id ON public.audit_log(project_id);
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs (for their org)
CREATE POLICY "Admins can view org audit logs"
  ON public.audit_log FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.organisation_id IN (
        SELECT u.organisation_id FROM public.users u
        WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
          AND u.role = 'admin'
      )
    )
  );

-- Service role inserts only (via triggers)
-- No INSERT policy for authenticated users
