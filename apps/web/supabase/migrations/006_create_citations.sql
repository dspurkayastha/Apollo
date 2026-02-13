-- 006: Create citations table
-- Rollback: DROP TABLE IF EXISTS public.citations CASCADE;

CREATE TABLE public.citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  cite_key TEXT NOT NULL,
  bibtex_entry TEXT NOT NULL DEFAULT '',
  provenance_tier TEXT NOT NULL DEFAULT 'D' CHECK (provenance_tier IN ('A', 'B', 'C', 'D')),
  evidence_type TEXT CHECK (evidence_type IN ('doi', 'pmid', 'isbn', 'url', 'manual')),
  evidence_value TEXT,
  source_doi TEXT,
  source_pmid TEXT,
  attested_by_user_id UUID REFERENCES public.users(id),
  attested_at TIMESTAMPTZ,
  used_in_sections TEXT[] NOT NULL DEFAULT '{}',
  serial_number INTEGER,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_citations_project_id ON public.citations(project_id);
CREATE UNIQUE INDEX idx_citations_project_key ON public.citations(project_id, cite_key);
CREATE INDEX idx_citations_source_doi ON public.citations(source_doi) WHERE source_doi IS NOT NULL;
CREATE INDEX idx_citations_source_pmid ON public.citations(source_pmid) WHERE source_pmid IS NOT NULL;

ALTER TABLE public.citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project citations"
  ON public.citations FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can insert own project citations"
  ON public.citations FOR INSERT TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can update own project citations"
  ON public.citations FOR UPDATE TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

CREATE POLICY "Users can delete own project citations"
  ON public.citations FOR DELETE TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );
