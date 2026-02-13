-- 014: Create audit triggers for projects, sections, thesis_licenses
-- Rollback: DROP FUNCTION IF EXISTS audit_trigger_func() CASCADE;

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_project_id UUID;
  v_action TEXT;
BEGIN
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
  END IF;

  -- Get user_id from the current JWT
  SELECT u.id INTO v_user_id
  FROM public.users u
  WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
  LIMIT 1;

  -- Get project_id depending on entity type
  IF TG_TABLE_NAME = 'projects' THEN
    v_project_id := COALESCE(NEW.id, OLD.id);
  ELSIF TG_TABLE_NAME IN ('sections', 'citations', 'datasets', 'analyses', 'figures') THEN
    v_project_id := COALESCE(NEW.project_id, OLD.project_id);
  ELSIF TG_TABLE_NAME = 'thesis_licenses' THEN
    v_project_id := COALESCE(NEW.project_id, OLD.project_id);
  END IF;

  INSERT INTO public.audit_log (user_id, project_id, action, entity_type, entity_id, old_value_json, new_value_json)
  VALUES (
    v_user_id,
    v_project_id,
    v_action,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Projects audit
CREATE TRIGGER audit_projects
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Sections audit
CREATE TRIGGER audit_sections
  AFTER INSERT OR UPDATE OR DELETE ON public.sections
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Thesis licenses audit
CREATE TRIGGER audit_thesis_licenses
  AFTER INSERT OR UPDATE OR DELETE ON public.thesis_licenses
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
