# Apollo Web SaaS: Lessons Learned

> Seeded from the CLI thesis pipeline experience. Update as new lessons emerge.

## LaTeX Compilation

### DOI underscores crash vancouver.bst
- **Symptom**: "Missing $ inserted" error on bibliography lines
- **Cause**: `doi = {10.1016/j.surg_2024}` — underscores trigger math mode
- **Fix**: Remove `doi` field entirely, or use `note = {DOI: 10.xxx\_yyy}`
- **Web app impact**: The citation insertion system must strip DOI fields from BibTeX entries or escape underscores before writing to `references.bib`

### Certificate/declaration variable scoping
- **Symptom**: "itle" instead of "Title", truncated names on certificates
- **Cause**: `\def\@variablename{#1}` loses scope with `\@` prefix
- **Fix**: Use `\renewcommand{\variablenametext}{#1}` pattern — avoid `\@` prefix entirely
- **Web app impact**: The metadata form → LaTeX generation must use the harmonised CLS API commands, never raw `\def`

### Page number positioning
- **Fix**: `\fancyfoot[R]{\thepage}` for bottom-right (SSKM uses bottom-centre, SSUHS uses bottom-right with dept footer)
- **Web app impact**: Handled by CLS files — no app-level concern, but verify in compile tests

### Table overfull hbox
- **Fix**: Use `p{Xcm}` column specifiers instead of `l`, `c`, `r`. Total width must not exceed `\textwidth` (~16cm for A4 with 2.5cm margins)
- **Web app impact**: The table generation system must calculate column widths. Default to even distribution with `\raggedright` in text-heavy cells

### hyperref pageanchor warnings
- **Cause**: Roman → Arabic page numbering transition creates duplicate page destinations
- **Fix**: `\hypersetup{pageanchor=true}` in preamble, `\phantomsection` before transitions
- **Web app impact**: Include in the LaTeX template preamble by default

### Longtable caption placement
- **Fix**: Caption and `\label` go in the FIRST head, not after `\endlastfoot`
- **Web app impact**: Table generation must place captions correctly

## Statistical Analysis (R)

### Normality testing before parametric tests
- Always run Shapiro-Wilk before choosing t-test vs Mann-Whitney
- The web app's analysis wizard must auto-select the correct test

### gtsummary for descriptive statistics
- Produces publication-quality tables directly
- Use `tbl_summary()` with `by` parameter for group comparisons
- Export as LaTeX via `as_gt() %>% as_latex()`

### Figure DPI and format
- Always output 300 DPI PDF for publication quality
- Use `ggsave(width=6, height=4, dpi=300, device="pdf")`
- The R Plumber API must enforce these defaults

### Data verification is non-negotiable
- ALL numbers in Results, Discussion, Conclusion, and Abstract must match the dataset
- The web app should auto-cross-check: extract numbers from generated text and compare against analysis results

## Citation Management

### Bidirectional integrity
- Every `\cite{key}` must have a corresponding bib entry
- Every bib entry should be cited somewhere (warn on orphans)
- The web app enforces this by construction: Tier A-C always write both `\cite{}` and bib entry simultaneously

### Vancouver (ICMJE) serialisation
- Citations must be numbered sequentially as they first appear in text
- If Introduction uses [1]-[20], next section starts at [21]
- The web app handles this via `serial_number` in the citations table

### Provenance tiers learned the hard way
- AI-generated citations are frequently fabricated (Tier D)
- DOI/PMID auto-lookup catches most (→ Tier A)
- Students must confirm anything that fails lookup (→ Tier B/C)
- Never let Tier D citations reach the LaTeX compiler

## Workflow Patterns

### "Think and Plan thrice before executing once"
- Read all relevant files before modifying anything
- Understand existing patterns before suggesting changes
- Verify changes after making them

### Progressive disclosure works
- Students don't need to see LaTeX — the form-based editor is the default
- Advanced users can opt into source view
- Error messages should be human-readable, not raw LaTeX errors

### Synopsis is the single source of truth
- Materials & Methods must follow the approved synopsis exactly
- Aims & Objectives are extracted from synopsis, not invented
- Study type detection drives the entire downstream pipeline

## Infrastructure

### Docker isolation is essential for LaTeX/R
- No network access for compile containers (`--network=none`)
- Read-only filesystem except `/tmp`
- Memory limits (1GB for LaTeX, 500MB for R)
- Timeout enforcement (120s LaTeX, 15-60s R depending on analysis type)

### Free tier limitations to watch
- Supabase free: 500MB database, 50K MAU, 7-day backups
- Cloudflare R2 free: 10GB storage, zero egress
- Sentry free: 5K errors/month, 10K transactions/month (sample at 20%)
- PostHog free: 1M events/month (capture only key events)
- Resend free: 3K emails/month
