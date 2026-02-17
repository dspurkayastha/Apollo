-- 016: Create abbreviations table
-- Sprint 3-4: Abbreviation management for thesis front matter

CREATE TABLE IF NOT EXISTS abbreviations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  short_form TEXT NOT NULL,
  long_form TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (project_id, short_form)
);

-- Index for fast lookup by project
CREATE INDEX idx_abbreviations_project_id ON abbreviations(project_id);

-- RLS
ALTER TABLE abbreviations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project abbreviations"
  ON abbreviations FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own project abbreviations"
  ON abbreviations FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own project abbreviations"
  ON abbreviations FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own project abbreviations"
  ON abbreviations FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Audit trigger (reuses existing audit function if available)
CREATE OR REPLACE FUNCTION update_abbreviations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER abbreviations_updated_at
  BEFORE UPDATE ON abbreviations
  FOR EACH ROW
  EXECUTE FUNCTION update_abbreviations_updated_at();
