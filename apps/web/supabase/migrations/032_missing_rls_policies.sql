-- Phase 11: Missing RLS policies and citations unique constraint
-- Items: 11.11 (RLS gaps) + 11.8 prerequisite (citations upsert)

-- D1a: datasets UPDATE policy (owner only)
CREATE POLICY "Users can update their own datasets"
  ON public.datasets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = datasets.project_id
      AND p.user_id = auth.uid()
    )
  );

-- D1b: compilations UPDATE policy (owner only)
CREATE POLICY "Users can update their own compilations"
  ON public.compilations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = compilations.project_id
      AND p.user_id = auth.uid()
    )
  );

-- D1c: compilations DELETE policy (owner only)
CREATE POLICY "Users can delete their own compilations"
  ON public.compilations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = compilations.project_id
      AND p.user_id = auth.uid()
    )
  );

-- D1d: review_comments INSERT policy (service role only)
-- review_comments are inserted by external reviewers via API routes
-- that validate tokens. RLS INSERT blocks browser-client INSERT.
-- API routes use admin client (bypasses RLS).
CREATE POLICY "review_comments INSERT via service role only"
  ON public.review_comments FOR INSERT
  WITH CHECK (false);

-- D1e: citations unique constraint for pre-seed upsert (C1 prerequisite)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'citations_project_id_cite_key_key'
  ) THEN
    ALTER TABLE public.citations
      ADD CONSTRAINT citations_project_id_cite_key_key
      UNIQUE (project_id, cite_key);
  END IF;
END $$;
