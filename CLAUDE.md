# Medical Thesis Generation Pipeline

## Project Overview
AI-assisted MD/MS thesis generation following GOLD Standard methodology.
Supports two university formats (selected at session start):
- **SSKM/WBUHS** — IPGMER & SSKM Hospital, West Bengal University of Health Sciences, Kolkata
- **SSUHS** — Srimanta Sankaradeva University of Health Sciences, Silchar/Guwahati, Assam

Both use a **harmonised API** — switching requires changing only the `\documentclass` line.

## Quick Facts
- **Stack**: LaTeX (pdflatex), R (4.4+), Python (3.11+), BibTeX
- **Citation Style**: Vancouver (ICMJE) via BibTeX with vancouver.bst
- **Language**: British English throughout
- **Plagiarism Target**: <10%
- **Compilation**: `latexmk -pdf main.tex` or `pdflatex → bibtex → pdflatex × 2`

## CRITICAL RULES (NON-NEGOTIABLE)
1. **ALWAYS read `guides/GOLD_Standard_Phased_Plan.md` before writing ANY section**
2. **Synopsis governs Materials & Methods** — follow `input/synopsis.txt` exactly
3. **Every claim needs a citation** — use `\cite{key}` exclusively, never hardcode
4. **Bidirectional citation integrity** — all `\cite{}` → bib entries; all bib entries → used in text
5. **Serialised inline citations** — if Introduction has refs [1]-[20], next section starts at [21]
6. **Vancouver style** for all citations (numeric, sequential)
7. **Tables**: Use longtable for multi-page, adjust column widths with `p{Xcm}` to prevent overfull hbox
8. **Figures**: Generate via R scripts with EMBEDDED data (no external CSV dependency)
9. **Review of Literature MUST end** with a chronological longtable of all cited works
10. **British English**: colour, behaviour, analyse, haemoglobin, oestrogen
11. **Data verification**: ALL thesis numbers MUST match `dataset.csv` — run Python verification before finalising (cross-check Results, Discussion, Conclusion, Abstract)
12. **India-relevant content**: All expansions/additions must reference Indian studies, demographics, and healthcare context — no superfluous Western-centric filler
13. **Cite software correctly**: R → `rcoreteam2024` (not textbook citations); always cite exact version used
14. **No DOI fields in references.bib**: Underscores in DOI crash `vancouver.bst` — omit DOI or use `note = {DOI: 10.xxx\_yyy}`
15. **ROL must include open-access figures**: EHS classification, abdominal wall anatomy, mesh positions, etc. from CC BY 4.0 PMC articles with proper attribution captions

## Key Directories
- `templates/` — LaTeX template files (DO NOT modify originals; copy to output/thesis/)
  - `sskm-thesis.cls` — WBUHS/Kolkata format (Director, REFERENCES, bottom-centre pages)
  - `ssuhs-thesis.cls` — SSUHS/Assam format (Principal, BIBLIOGRAPHY, bottom-right pages + dept footer)
  - `main.tex` — Topic-agnostic template (works with either cls)
  - `logo/` — University and institute logos (sskm-logo.png, ssuhs-logo.png, wbuhs-logo.pdf)
- `guides/` — GOLD Standard plan, writing guide, university rules, lessons learned
- `input/` — Synopsis, data, literature review
- `output/thesis/` — Working thesis files (edit these)
- `output/figures/` — R-generated figures (PDF format)
- `output/stats/` — Statistical analysis outputs
- `scripts/` — R and shell scripts for analysis and compilation (`full_pipeline.sh` handles university selection)

## Workflow (Phased Approach)
Follow `guides/GOLD_Standard_Phased_Plan.md` strictly. Phases:
- Phase 0: Orientation (read ALL files first)
- Phase 1: Front Matter (certificates, declarations, contents)
- Phase 2: Introduction (~1500 words, well-cited)
- Phase 3: Aims and Objectives (from synopsis)
- Phase 4: Review of Literature (comprehensive, + chronological citation longtable at end)
- Phase 5: Materials and Methods (FOLLOW SYNOPSIS EXACTLY, cite all methods/software/scores)
- Phase 6a: Dataset Creation / Import
- Phase 6b: Statistical Analysis + Results (use R, report per biostatistics best practices)
- Phase 7: Discussion (compare with published literature)
- Phase 8: Conclusion (concise, objective-mapped)
- Phase 9: References (Vancouver, all serialised, bidirectional integrity)
- Phase 10: Appendices (proforma, consent form, master chart)
- Phase 11: Final QC and Assembly (compilation, error fixes, packaging)
- Phase 12: Adjudicator QA Evaluation (university compliance, content QA, consistency audit)

## Statistical Analysis
- Use R with: tidyverse, gtsummary, ggplot2, survival, pROC, tableone, exact2x2
- Generate publication-quality figures (300 DPI, PDF output)
- R scripts MUST have embedded data (no external file dependency for portability)
- Tests: Chi-square/Fisher's exact for categorical, t-test/Mann-Whitney for continuous
- Check normality (Shapiro-Wilk) before parametric tests
- Significance level: p < 0.05
- Report: test statistic, degrees of freedom, exact p-value, effect size, 95% CI

## LaTeX Compilation
```bash
cd output/thesis/
latexmk -pdf -interaction=nonstopmode main.tex
# OR manual (REQUIRED after any .bib change):
pdflatex -interaction=nonstopmode main.tex
bibtex main
pdflatex -interaction=nonstopmode main.tex
pdflatex -interaction=nonstopmode main.tex
```

### Post-Compilation Visual Verification (MANDATORY)
After every compilation, render the PDF to images and visually inspect key pages:
```bash
# Render specific pages for visual check
pdftoppm -png -f 1 -l 5 main.pdf /tmp/thesis_check   # title + front matter
# Then read the images to verify layout, logos, page numbers, spacing
```
Check: title page logos, certificate formatting, page numbers at bottom-right, table widths, figure rendering.

### Parallel Subagents for Research Tasks
Use background subagents for time-consuming research (literature search, image sourcing, web fetches) while continuing main work. Launch with `run_in_background: true` and collect results when ready.

## Known Issues & Fixes (MUST READ)
See `guides/lessons_learned.md` for critical compilation fixes including:
- DOI underscores crashing vancouver.bst
- Certificate variable scoping in .cls files
- Page number positioning (must be bottom-right via `\fancyfoot[R]`)
- Table width calculations
- hyperref pageanchor warnings

### Formatting Rules (learned from production builds)
- **Page numbers**: Bottom-right corner (`\fancyfoot[R]`), NOT bottom-centre
- **Front matter pages**: Wrap dense pages (certificates, declarations) in `\begin{singlespace}...\end{singlespace}` to prevent vertical overflow
- **Title page logos**: BOTH university logo AND institute logo must appear, positioned between the university name text and the candidate/guide info block
- **Vertical centering**: Use dual `\vfill` (before and after candidate/guide block) on the title page for natural vertical distribution

## Atomised Thinking Framework
For EVERY section: Decompose → Research → Structure → Draft → Verify → QC → Deliver
**"Think and Plan thrice before executing once"**

## Phase Gate Rule
Do NOT proceed to Phase N+1 until Phase N passes all QC checks.

## University Format Selection
At the start of each session, determine which university format to use:
1. Run `scripts/full_pipeline.sh` (interactive menu), OR
2. Manually set `\documentclass{sskm-thesis}` or `\documentclass{ssuhs-thesis}` in `output/thesis/main.tex`

Both cls files share the same harmonised API:
- **Metadata pattern**: `\newcommand{\variablenametext}{default}` + `\newcommand{\variablename}[1]{\renewcommand{\variablenametext}{#1}}`
- **NEVER** use `\def\@variable` (causes certificate truncation bug)
- **Unified commands**: `\supervisorname`, `\institutionheadname`, `\maketitlepage`, `\makeguidecertificate`, etc.
- **Aliases**: `\guidename` = `\supervisorname`, `\directorname` = `\principalname` = `\institutionheadname`

## For Different Topics
0. **CLEAN OUTPUT FIRST**: Run `scripts/cleanup_for_new_topic.sh --force` to delete all previous thesis content and copy fresh templates. This removes everything in `output/thesis/`, `output/figures/`, `output/stats/` and copies clean templates from `templates/`.
1. Select university format: set `\documentclass{sskm-thesis}` or `\documentclass{ssuhs-thesis}` in `output/thesis/main.tex`
2. Replace `input/synopsis.txt` with new synopsis
3. Replace `input/dataset.csv` with new data (or leave empty — Claude will generate synthetic data in Phase 6a)
4. Update literature in `input/` if pre-gathered
5. Templates, .cls, .bst, and guides remain UNCHANGED
6. Run through all 12 phases sequentially

**WARNING**: If you skip Step 0, Claude will find the previous thesis in `output/thesis/` and try to edit it instead of starting fresh. Always clean first.

## File Access Notes
   - Do NOT attempt to read `guides/UniversityDissertationRules.pdf` directly as PDF
   - Use `pdftotext` to convert it first, or refer to the formatting rules already documented in CLAUDE.md and guides/GOLD_Standard_Phased_Plan.md
