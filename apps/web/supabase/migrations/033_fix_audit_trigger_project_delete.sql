-- Migration 033: Fix audit trigger FK violation on project DELETE
--
-- Bug: AFTER DELETE trigger on projects inserts a new audit_log row with
-- project_id = OLD.id. But the project was just deleted, so the FK
-- constraint audit_log_project_id_fkey rejects the INSERT (409 Conflict).
-- CASCADE only removes existing audit_log rows, not new ones from triggers.
--
-- Fix: Set project_id = NULL for project DELETE audit entries.
-- The deleted project's ID is still captured in entity_id and old_value_json.

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
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
  -- For project DELETE, the row no longer exists so FK would block the insert.
  -- Record the deletion with project_id = NULL (OLD.id is captured in entity_id).
  IF TG_TABLE_NAME = 'projects' THEN
    IF TG_OP = 'DELETE' THEN
      v_project_id := NULL;
    ELSE
      v_project_id := COALESCE(NEW.id, OLD.id);
    END IF;
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
