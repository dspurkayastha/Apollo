# Thesis Generation Pipeline: Export & Replication Guide

## For Claude Code / Cowork Setup

**Author**: Dev (exported from Claude.ai Project)  
**Date**: February 2026  
**Purpose**: Replicate the GOLD Standard Medical Thesis workflow with a different topic

---

## 1. What Can and Cannot Be Exported

### ✅ CAN Be Exported (and how)

| Asset | Method | Location |
|-------|--------|----------|
| All Project Knowledge files (.md, .tex, .cls, .bst, .bib, .txt, .pdf) | Download from Claude.ai Project → "Project knowledge" panel | `/mnt/project/` files |
| Custom Project Instructions | Copy from Claude.ai Project → "Instructions" field | Text you typed at top of project |
| GOLD Standard Phased Plan | Already a standalone `.md` file — fully portable | `GOLD_Standard_Medical_Thesis_Phased_Plan_v2_WBUHS.md` |
| Thesis Writing Guide | Already portable | `GOLD_Standard_Thesis_Writing_Guide_WBUHS.txt` |
| LaTeX template + class file | Download directly | `main.tex`, `sskm-thesis.cls` |
| Bibliography style + references | Download directly | `vancouver.bst`, `template-references.bib` |
| University rules PDF | Download directly | `UniversityDissertationRules.pdf` |
| Synopsis template structure | Download directly | `SYNOPSIS.txt` |
| This lessons-learned document | You're reading it | This file |

### ❌ CANNOT Be Directly Exported

| Asset | Workaround |
|-------|-----------|
| Full chat history with Claude | Use this Lessons Learned doc as a condensed substitute |
| Claude's "memories" of your preferences | Encode as explicit instructions in CLAUDE.md |
| Intermediate debugging sessions | Key fixes documented in Section 5 below |
| The exact Claude.ai skill files (r-stats, latex, python-ds, etc.) | These are built into Claude Code already; create custom skills for thesis-specific logic |

---

## 2. Target Architecture: Claude Code Pipeline

### Directory Structure

```
medical-thesis-pipeline/
├── CLAUDE.md                          # ← THE MOST IMPORTANT FILE (master instructions)
├── .claude/
│   ├── settings.json                  # Claude Code settings
│   └── skills/
│       ├── thesis-writer/
│       │   └── SKILL.md               # Thesis writing skill
│       ├── biostatistics/
│       │   └── SKILL.md               # Statistical analysis skill
│       └── latex-thesis/
│           └── SKILL.md               # LaTeX compilation skill
├── templates/
│   ├── main.tex                       # LaTeX thesis template
│   ├── sskm-thesis.cls                # Custom document class
│   ├── vancouver.bst                  # Vancouver bibliography style
│   └── template-references.bib        # Starter bibliography
├── guides/
│   ├── GOLD_Standard_Phased_Plan.md   # Master phased plan
│   ├── Thesis_Writing_Guide.txt       # Writing guide
│   ├── UniversityDissertationRules.pdf
│   └── lessons_learned.md             # THIS FILE (critical fixes & patterns)
├── input/
│   ├── synopsis.txt                   # YOUR NEW TOPIC synopsis
│   ├── literature_review.md           # Pre-gathered literature (optional)
│   └── dataset.csv                    # Your research data (or synthetic)
├── output/
│   ├── thesis/                        # Final compiled thesis
│   ├── figures/                       # Generated R figures
│   ├── stats/                         # Statistical analysis outputs
│   └── packages/                      # Deliverable zip packages
└── scripts/
    ├── generate_figures.R             # R script for all figures
    ├── run_statistics.R               # Full statistical analysis
    ├── compile_thesis.sh              # LaTeX compilation script
    └── full_pipeline.sh               # End-to-end automation
```

---

## 3. The CLAUDE.md File (Heart of the Pipeline)

This is what Claude Code reads at session start. Create this file in your project root:

```markdown
# Medical Thesis Generation Pipeline

## Project Overview
AI-assisted MD/MS thesis generation following GOLD Standard methodology.
Target: WBUHS (West Bengal University of Health Sciences) dissertation format.

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
4. **Bidirectional citation integrity** — all \cite{} → bib entries; all bib entries → used in text
5. **Serialised inline citations** — if Introduction has refs [1]-[20], next section starts at [21]
6. **Vancouver style** for all citations (numeric, sequential)
7. **Tables**: Use longtable for multi-page, adjust column widths to prevent overfull hbox
8. **Figures**: Generate via R scripts with EMBEDDED data (no external CSV dependency)
9. **Review of Literature MUST end** with a chronological longtable of all cited works
10. **British English**: colour, behaviour, analyse, haemoglobin, oestrogen

## Key Directories
- `templates/` — LaTeX template files (DO NOT modify originals; copy to output/)
- `guides/` — GOLD Standard plan, writing guide, university rules
- `input/` — Synopsis, data, literature
- `output/thesis/` — Working thesis files (edit these)
- `output/figures/` — R-generated figures (PDF format)
- `scripts/` — R and shell scripts

## Workflow (Phased Approach)
Follow `guides/GOLD_Standard_Phased_Plan.md` strictly. Phases:
- Phase 0: Orientation (read ALL files)
- Phase 1: Front Matter
- Phase 2: Introduction
- Phase 3: Aims and Objectives
- Phase 4: Review of Literature (+ chronological citation longtable at end)
- Phase 5: Materials and Methods (FOLLOW SYNOPSIS EXACTLY)
- Phase 6a: Dataset Creation / Import
- Phase 6b: Statistical Analysis + Results (use R, report per biostatistics best practices)
- Phase 7: Discussion
- Phase 8: Conclusion
- Phase 9: References (Vancouver, all serialised)
- Phase 10: Appendices
- Phase 11: Final QC and Assembly

## Statistical Analysis
- Use R with: tidyverse, gtsummary, ggplot2, survival, pROC, tableone, exact2x2
- Generate publication-quality figures (300 DPI, PDF output)
- R scripts MUST have embedded data (no external file dependency)
- Tests: Chi-square/Fisher's exact for categorical, t-test/Mann-Whitney for continuous
- Significance level: p < 0.05
- Report: test statistic, degrees of freedom, exact p-value, effect size, 95% CI

## LaTeX Compilation
```bash
# Preferred method
latexmk -pdf -interaction=nonstopmode output/thesis/main.tex

# Manual method
cd output/thesis/
pdflatex main.tex
bibtex main
pdflatex main.tex
pdflatex main.tex
```

## Known Issues & Fixes (CRITICAL — Read before compilation)
See `guides/lessons_learned.md` for:
- DOI fields with underscores crash vancouver.bst → remove DOI or use note field
- Page numbers: fancyfoot[R] not [C] for bottom-right positioning
- Certificate pages: use \renewcommand not \def for metadata variables
- \@ prefix variables cause scoping issues in .cls → use plain \variablenametext
- Missing $ errors from underscores in bibliography DOI fields
- hyperref pageanchor warnings → add pageanchor=true in preamble

## Atomised Thinking Framework
For EVERY section: Decompose → Research → Structure → Draft → Verify → QC → Deliver
"Think and Plan thrice before executing once"

## For Different Topics
1. Replace `input/synopsis.txt` with new synopsis
2. Update `input/dataset.csv` with new data
3. Update `input/literature_review.md` if pre-gathered
4. Templates, .cls, .bst, and guides remain UNCHANGED
5. Run through all 12 phases sequentially
```

---

## 4. Custom Skills for Claude Code

### 4.1 Thesis Writer Skill

Create `.claude/skills/thesis-writer/SKILL.md`:

```markdown
---
name: thesis-writer
description: "Medical thesis writing following GOLD Standard methodology. Use when creating thesis chapters, sections, or any academic medical content. Handles Introduction, Review of Literature, Materials and Methods, Results, Discussion, Conclusion, and all supporting sections."
---

# Medical Thesis Writer

## When to Use
- Writing any thesis chapter or section
- Creating academic medical content
- Formatting citations in Vancouver style
- Building chronological literature tables

## Core Workflow
1. Read `guides/GOLD_Standard_Phased_Plan.md` for the relevant phase
2. Read `input/synopsis.txt` for study design and objectives
3. Follow the Atomised Thinking Framework: Decompose → Research → Structure → Draft → Verify → QC → Deliver
4. Use web search for up-to-date references (2020-2026 preferred)
5. Write in British English throughout

## Citation Rules
- Use `\cite{key}` for all inline citations
- Vancouver style: numeric, sequential, serialised across chapters
- Every claim must have a citation
- Add new references to `references.bib` as you write
- End Review of Literature with chronological longtable of all cited works

## Table Formatting
- Use `\begin{longtable}` for multi-page tables
- Set explicit column widths with `p{Xcm}` to prevent overfull hbox
- Use `booktabs` rules: \toprule, \midrule, \bottomrule
- Caption above table, label below caption

## Quality Checks Before Delivery
- [ ] All claims cited
- [ ] British English spelling
- [ ] No hardcoded citation numbers
- [ ] Tables fit within margins
- [ ] Cross-references use \ref{} or \autoref{}
```

### 4.2 Biostatistics Skill

Create `.claude/skills/biostatistics/SKILL.md`:

```markdown
---
name: biostatistics
description: "Rigorous biostatistical analysis for clinical research. Use when performing statistical tests, generating publication-quality figures, creating Table 1, or analysing clinical datasets. Specialised for observational studies, comparative analyses, and surgical outcomes research."
---

# Biostatistics for Clinical Research

## When to Use
- Analysing clinical research datasets
- Generating statistical figures for thesis
- Creating Table 1 (demographics/baseline characteristics)
- Running hypothesis tests for study objectives
- Generating R scripts with embedded data

## R Package Requirements
```r
required_packages <- c(
  "tidyverse", "gtsummary", "ggplot2", "tableone",
  "survival", "survminer", "pROC", "exact2x2",
  "car", "lmtest", "broom", "scales", "patchwork",
  "knitr", "kableExtra", "RColorBrewer", "ggpubr"
)
```

## Statistical Test Selection
| Data Type | Groups | Test |
|-----------|--------|------|
| Categorical | 2 | Chi-square (n≥5/cell) or Fisher's exact |
| Categorical | >2 | Chi-square or Fisher-Freeman-Halton |
| Continuous (normal) | 2 | Independent t-test |
| Continuous (non-normal) | 2 | Mann-Whitney U |
| Continuous (normal) | >2 | One-way ANOVA + post-hoc Tukey |
| Continuous (non-normal) | >2 | Kruskal-Wallis + Dunn's test |
| Ordinal | 2 | Mann-Whitney U |
| Correlation | - | Pearson (normal) or Spearman (non-normal) |

## Figure Standards
- Output: PDF format, 300 DPI minimum
- Dimensions: width=6.5in (single column), height contextual
- Theme: `theme_minimal()` or `theme_classic()` with modifications
- Colours: Use colourblind-friendly palettes (viridis, RColorBrewer Set2)
- Labels: Title, axis labels, units, significance annotations
- ALL data MUST be embedded in the R script (no external CSV calls)

## Reporting Standards
- Report: test statistic, df, exact p-value, 95% CI, effect size
- Use APA-style for tables (no vertical lines, minimal horizontal)
- Significance: * p<0.05, ** p<0.01, *** p<0.001
- Always check assumptions before parametric tests (Shapiro-Wilk, Levene's)
```

### 4.3 LaTeX Thesis Skill

Create `.claude/skills/latex-thesis/SKILL.md`:

```markdown
---
name: latex-thesis
description: "LaTeX thesis compilation, debugging, and formatting for Indian medical university theses. Use when compiling .tex files, fixing compilation errors, formatting tables/figures, or working with the sskm-thesis.cls custom class."
---

# LaTeX Thesis Compilation & Debugging

## When to Use
- Compiling thesis with pdflatex/latexmk
- Debugging compilation errors
- Formatting tables to prevent overfull hbox
- Working with sskm-thesis.cls document class
- Managing BibTeX with vancouver.bst

## Compilation Command
```bash
cd output/thesis/
latexmk -pdf -interaction=nonstopmode main.tex
```

## CRITICAL KNOWN ISSUES (from previous thesis builds)

### 1. DOI Underscores Crash vancouver.bst
DOI fields containing underscores (e.g., `10.1016/j.surg_2024`) cause "Missing $ inserted" errors because vancouver.bst outputs DOIs without escaping special characters.
**Fix**: Remove DOI field entirely, or move to `note = {DOI: 10.1016/j.surg\_2024}` with manual escaping.

### 2. Certificate/Declaration Pages Show Truncated Text
Using `\def\@variablename{#1}` causes scoping issues.
**Fix**: Use `\renewcommand{\variablenametext}{#1}` — avoid the `\@` prefix entirely.

### 3. Page Number Positioning
Default is bottom-center. For bottom-right:
**Fix**: In sskm-thesis.cls, change all `\fancyfoot[C]` to `\fancyfoot[R]`.

### 4. hyperref pageanchor Warnings
Duplicate page destinations from Roman→Arabic numbering switch.
**Fix**: Add `\hypersetup{pageanchor=true}` in preamble.

### 5. Undefined References
Cross-references like `\ref{fig:study_flow}` may not match actual labels.
**Fix**: Always verify label names exist. Use `grep -r "\\label{" output/thesis/` to list all labels.

### 6. Overfull hbox in Tables
**Fix**: Use `p{Xcm}` column specifiers instead of `l`, `c`, `r`. Calculate widths to sum to ≤ \textwidth minus column separators.

### 7. Bibliography Entries Unreferenced Warning
**Fix**: Ensure every `\cite{key}` has a matching bib entry AND every bib entry is cited. Run: `grep -oP '\\cite\{[^}]+\}' main.tex | sort -u` to list all citations used.

## Table Width Calculator
For a 6.3in text width with n columns:
- 2 columns: p{3.0cm} + p{10.0cm}
- 3 columns: p{2.5cm} + p{5.0cm} + p{5.0cm}
- 4 columns: p{2.0cm} + p{3.5cm} + p{3.5cm} + p{3.5cm}
Adjust as needed. Total should be ≤ 16cm (≈6.3in).
```

---

## 5. Lessons Learned (Critical Fixes & Patterns)

This section encodes ALL debugging knowledge from 5+ chat sessions into actionable rules.

### 5.1 LaTeX/BibTeX Issues

| Issue | Root Cause | Fix | Phase |
|-------|-----------|-----|-------|
| "Missing $ inserted" on bibliography lines | DOI fields with underscores in .bib | Remove DOI field or use `note` field with escaped underscores | Phase 9 |
| 251 undefined citations | Missing bibtex compilation step | Run full: pdflatex → bibtex → pdflatex × 2 | Phase 11 |
| Certificate shows "itle" instead of "Title" | `\@` prefix variable scoping in .cls | Use `\renewcommand{\variablenametext}` pattern | Phase 1 |
| Vertical spacing overflow on front pages | Too many `\vspace{}` commands | Use `\vfill` for natural distribution | Phase 1 |
| Signature blocks misaligned | Complex tabular environments | Use `\flushright` with `\parbox{}` | Phase 1 |
| Duplicate page destinations warning | Roman→Arabic page number transition | `\hypersetup{pageanchor=true}` | Phase 11 |
| Page numbers bottom-centre not bottom-right | Default fancyhdr setting | Change `\fancyfoot[C]` to `\fancyfoot[R]` in .cls | Phase 1 |
| Longtable exceeds margins | No explicit column widths | Use `p{Xcm}` specifiers | Phase 4, 6b |
| Front matter pages overflow vertically | Dense content with double-spacing | Wrap certificates/declarations in `\begin{singlespace}...\end{singlespace}` | Phase 1 |
| Title page missing logos | Only one logo included | BOTH university AND institute logos required, placed between university text and candidate info | Phase 1 |
| Title page logos mispositioned | Logo block at wrong vertical position | Logos go BETWEEN university name text and candidate/guide block | Phase 1 |
| Candidate/guide block not centred | Fixed `\vspace{}` causes uneven spacing | Use dual `\vfill` (before and after) for natural vertical centering | Phase 1 |

### 5.2 Statistical Analysis Patterns

| Pattern | Implementation | Notes |
|---------|---------------|-------|
| Normality testing before parametric tests | Shapiro-Wilk on each continuous variable | If p < 0.05, use non-parametric alternative |
| Small cell counts in contingency tables | Use Fisher's exact instead of Chi-square | When any expected count < 5 |
| Multiple group comparisons | ANOVA/Kruskal-Wallis + post-hoc | Bonferroni correction for multiple testing |
| Effect size reporting | Cohen's d for t-tests, Cramér's V for chi-square | Always include alongside p-value |
| Confidence intervals | 95% CI for all key estimates | Report as (lower, upper) |

### 5.3 Dataset Generation Rules

| Rule | Rationale |
|------|-----------|
| Stratified sampling preserves proportions | When reducing sample size, maintain original category ratios |
| Indian hospital demographic distributions | Use realistic distributions for BMI, age, ASA grades for Indian population |
| Timing categories must be clinically sensible | Early (<2 weeks), Intermediate (2-6 weeks), Late (>6 weeks) for post-ERCP intervals |
| Complication rates per published literature | Match Clavien-Dindo distribution to published rates for the specific procedure |
| All codes documented in data dictionary | Binary (0/1), categorical codes, scoring systems — all defined |

### 5.4 Workflow Patterns

| Pattern | Application |
|---------|------------|
| "Think and Plan thrice before executing once" | Before any code/LaTeX generation, outline approach |
| Phase Gate validation | Don't proceed to Phase N+1 until Phase N passes QC |
| Atomic file delivery | Each deliverable is self-contained with all dependencies |
| R scripts with embedded data | No external CSV dependency — data is hardcoded in script |
| Fresh web search for every cited claim | Ensures up-to-date references, <10% plagiarism |
| Data verification before finalising | ALL numbers in thesis (Results, Discussion, Conclusion, Abstract) must match dataset.csv — run Python cross-check script |
| India-relevant content only | Expansions/additions must reference Indian studies, demographics, healthcare context — no Western-centric filler |
| Cite software correctly | R → `rcoreteam2024` (not textbook); always cite exact version of all software used |
| No DOI fields in references.bib | Underscores in DOI crash vancouver.bst — omit DOI entirely or use `note = {DOI: ...}` with escaped underscores |
| ROL must include open-access figures | Download CC BY 4.0 figures from PMC articles (anatomy, classification, surgical techniques) with full attribution captions |
| Full compilation cycle after bib changes | ALWAYS run pdflatex → bibtex → pdflatex × 2 after adding/changing any bibliography entry |
| Visual PDF verification after compilation | Render PDF to images and visually inspect title page, certificates, page numbers, tables, figures |
| Use background subagents for research | Launch parallel agents for web search, image sourcing, literature review while continuing main work |
| Phase 12 QA as formal step | Adjudicator-style review: formatting compliance, data consistency, citation audit, structural completeness |
| University selection at session start | Determine SSKM vs SSUHS format before any work; set `\documentclass` accordingly |

---

## 6. Step-by-Step Setup for Claude Code

### Prerequisites
- Claude Code installed (`npm install -g @anthropic-ai/claude-code`)
- Claude Max or Pro subscription
- Node.js 18+, R 4.4+, TeX Live 2025, Python 3.11+

### Setup Commands

```bash
# 1. Create project directory
mkdir -p medical-thesis-pipeline/{templates,guides,input,output/{thesis,figures,stats,packages},scripts,.claude/skills/{thesis-writer,biostatistics,latex-thesis}}

# 2. Copy all template files from your Claude.ai project download
cp main.tex medical-thesis-pipeline/templates/
cp sskm-thesis.cls medical-thesis-pipeline/templates/
cp vancouver.bst medical-thesis-pipeline/templates/
cp template-references.bib medical-thesis-pipeline/templates/

# 3. Copy guide files
cp GOLD_Standard_Medical_Thesis_Phased_Plan_v2_WBUHS.md medical-thesis-pipeline/guides/GOLD_Standard_Phased_Plan.md
cp GOLD_Standard_Thesis_Writing_Guide_WBUHS.txt medical-thesis-pipeline/guides/
cp UniversityDissertationRules.pdf medical-thesis-pipeline/guides/
cp THIS_FILE.md medical-thesis-pipeline/guides/lessons_learned.md

# 4. Place CLAUDE.md in root (copy Section 3 of this document)
# 5. Place skill files (copy Section 4 of this document)
# 6. Place YOUR new synopsis in input/
cp your_new_synopsis.txt medical-thesis-pipeline/input/synopsis.txt

# 7. Initialise and start
cd medical-thesis-pipeline
claude
```

### First Prompt to Claude Code

```
Read the CLAUDE.md file, then read guides/GOLD_Standard_Phased_Plan.md completely.
Read input/synopsis.txt for my research topic.
Read guides/lessons_learned.md for critical fixes.

Now execute the full thesis pipeline starting from Phase 0.
Work through each phase sequentially, following the phase gate rules.
Generate all LaTeX, R scripts, figures, and compile the final thesis.
Present each phase's output for my review before proceeding.
```

---

## 7. Step-by-Step Setup for Cowork

### Current Limitations (as of Feb 2026)
- Cowork is macOS only, Claude Max ($100-200/mo) required
- No Projects integration yet (cannot use Claude.ai Projects directly)
- No memory between sessions
- Best for: file organisation, document processing, R script execution

### Cowork Approach

1. **Create the same directory structure** as Section 2
2. **Point Cowork at the `medical-thesis-pipeline/` folder**
3. **Use a Cowork Plugin** (recommended):

Create a thesis-pipeline plugin:
```
/plugins create thesis-pipeline
```
Configure it with the CLAUDE.md contents and skill definitions.

4. **Cowork execution**: Because Cowork can run shell commands and R scripts, it can:
   - Execute R scripts for figure generation
   - Run latexmk for compilation
   - Organise outputs into proper folders
   - But: it cannot do multi-turn iterative writing as effectively as Claude Code

### Recommendation
**Claude Code is significantly better suited** for this pipeline than Cowork because:
- Thesis writing requires iterative, multi-step code generation
- LaTeX debugging needs terminal-level access and iteration
- Statistical analysis benefits from REPL-style interaction
- Cowork excels at file management, not complex multi-phase generation

---

## 8. The "Walk Away and Come Back" Pipeline Script

For maximum automation with Claude Code, use this orchestration script:

```bash
#!/bin/bash
# full_pipeline.sh — End-to-end thesis generation
# Usage: Place synopsis.txt and dataset.csv in input/, then run this script

set -e

echo "=== Medical Thesis Full Pipeline ==="
echo "Starting at $(date)"

# Phase 0-1: Setup and Front Matter
claude --print "Read CLAUDE.md and all guide files. Execute Phase 0 (Orientation) and Phase 1 (Front Matter). Copy templates to output/thesis/ and generate all front matter pages. Save to output/thesis/main.tex" --allowedTools "Read,Write,Bash"

# Phase 2-3: Introduction and Aims
claude --print "Execute Phase 2 (Introduction) and Phase 3 (Aims and Objectives). Write these chapters with proper citations. Update references.bib. Save LaTeX to output/thesis/" --allowedTools "Read,Write,Bash,WebSearch"

# Phase 4: Review of Literature
claude --print "Execute Phase 4 (Review of Literature). Write comprehensive review with current citations. Include chronological longtable of all cited works at end. Update references.bib." --allowedTools "Read,Write,Bash,WebSearch"

# Phase 5: Materials and Methods
claude --print "Execute Phase 5 (Materials and Methods). Follow input/synopsis.txt EXACTLY. Cite all methods, software, scoring systems." --allowedTools "Read,Write,Bash,WebSearch"

# Phase 6a: Dataset
claude --print "Execute Phase 6a. Import or generate dataset. Create data dictionary. Validate all variables." --allowedTools "Read,Write,Bash"

# Phase 6b: Statistical Analysis + Results
claude --print "Execute Phase 6b. Run complete statistical analysis using R. Generate all figures as PDF to output/figures/. Write Results chapter with embedded R data scripts. Save R scripts to scripts/." --allowedTools "Read,Write,Bash"

# Phase 7-8: Discussion and Conclusion
claude --print "Execute Phase 7 (Discussion) and Phase 8 (Conclusion). Compare findings with literature. Cite all comparisons." --allowedTools "Read,Write,Bash,WebSearch"

# Phase 9-10: References and Appendices
claude --print "Execute Phase 9 (References — verify bidirectional integrity) and Phase 10 (Appendices). Ensure all citations serialised in Vancouver style." --allowedTools "Read,Write,Bash"

# Phase 11: Final QC and Compilation
claude --print "Execute Phase 11 (Final QC). Run all quality checks from GOLD Standard plan. Fix any compilation errors using lessons_learned.md. Compile final PDF with latexmk. Package deliverables into output/packages/." --allowedTools "Read,Write,Bash"

echo "=== Pipeline Complete at $(date) ==="
echo "Final thesis: output/thesis/main.pdf"
echo "Figures: output/figures/"
echo "R scripts: scripts/"
echo "Package: output/packages/"
```

### Important Caveats for "Walk Away" Mode
1. **Web search for references**: Claude Code needs internet access for citation gathering
2. **Human review points**: The script above runs sequentially but ideally you should review each phase
3. **Token limits**: Long phases (especially Phase 4 and 6b) may require multiple sessions
4. **Compilation errors**: Phase 11 may need multiple iterations; Claude Code handles this well with its iterative debugging capability

---

## 9. Checklist: What to Download from Claude.ai Project

### From the Project Knowledge Panel
Download every file:
- [ ] `GOLD_Standard_Medical_Thesis_Phased_Plan_v2_WBUHS.md`
- [ ] `GOLD_Standard_Thesis_Writing_Guide_WBUHS.txt`
- [ ] `main.tex`
- [ ] `sskm-thesis.cls`
- [ ] `vancouver.bst`
- [ ] `template-references.bib`
- [ ] `UniversityDissertationRules.pdf`
- [ ] `SYNOPSIS.txt` (for reference structure — replace with new topic)
- [ ] `Post_ERCP_Literature_Review_Report.md` (for reference format — replace with new topic)
- [ ] `comprehensive_literature_synthesis.md` (for reference format)
- [ ] `Key_Evidence_Summary_Tables.md` (for reference format)
- [ ] `Clinical_Implications_Study_Design.md` (for reference format)
- [ ] `Quick_Reference_Clinical_Guide.md` (for reference format)

### From the Project Instructions Field
- [ ] Copy the entire "Custom Instructions" text from your Project settings

### From This Guide
- [ ] This file (`Thesis_Pipeline_Export_Guide.md`)
- [ ] CLAUDE.md content (Section 3)
- [ ] Three skill files (Section 4)

### From Chat Outputs (if saved)
- [ ] Final compiled thesis PDF
- [ ] R scripts with embedded data
- [ ] Statistical analysis report
- [ ] Dataset CSV with codebook

---

## 10. Adapting for a Different Topic

### CRITICAL: Clean Output First
**Before starting a new topic, you MUST clear the previous thesis output.** If you skip this, Claude will find the old thesis in `output/thesis/` and try to edit it instead of starting fresh.

```bash
# Run the cleanup script (use --force for non-interactive mode)
./scripts/cleanup_for_new_topic.sh --force
```

This script:
- Deletes ALL files in `output/thesis/` (tex, bib, pdf, aux, figures, data — everything)
- Deletes ALL files in `output/figures/` (R-generated figures)
- Deletes ALL files in `output/stats/` (statistical outputs)
- Copies fresh templates from `templates/` → `output/thesis/` (main.tex, cls, bst, references.bib, logos)
- Preserves `.gitkeep` files and directory structure

### Step-by-Step for a New Topic
| Step | Action |
|------|--------|
| 0 | **Run `scripts/cleanup_for_new_topic.sh --force`** |
| 1 | Select university format (`\documentclass{sskm-thesis}` or `\documentclass{ssuhs-thesis}`) |
| 2 | Replace `input/synopsis.txt` with new topic synopsis |
| 3 | Replace `input/dataset.csv` with new research data (or leave empty for synthetic) |
| 4 | (Optional) Add pre-gathered literature to `input/literature_review.md` |
| 5 | Start Claude and run through all 12 phases sequentially |

### What Changes
| File | Action |
|------|--------|
| `input/synopsis.txt` | Replace entirely with new topic synopsis |
| `input/dataset.csv` | Replace with new research data |
| `input/literature_review.md` | Replace or leave empty (Claude will generate) |
| `output/thesis/main.tex` | Regenerated from template by cleanup script |
| `references.bib` | Reset to template-references.bib by cleanup script |
| `output/thesis/figures/` | Cleared by cleanup script |
| `output/figures/` | Cleared by cleanup script |
| `output/stats/` | Cleared by cleanup script |

### What Stays the Same
| File | Reason |
|------|--------|
| `CLAUDE.md` | Pipeline instructions are topic-agnostic |
| `GOLD_Standard_Phased_Plan.md` | Already designed to be topic-agnostic |
| `Thesis_Writing_Guide.txt` | University formatting rules don't change |
| `templates/` (all files) | Master templates — never modified, only copied |
| `sskm-thesis.cls` / `ssuhs-thesis.cls` | Document class is topic-independent |
| `vancouver.bst` | Citation style is fixed |
| `UniversityDissertationRules.pdf` | University rules are constant |
| All three `.claude/skills/` | Skills are methodology-based, not topic-based |
| `lessons_learned.md` | LaTeX fixes apply regardless of topic |
| `scripts/` (all scripts) | Orchestration is phase-based, not topic-based |

### The Minimum You Need for a New Topic
1. A synopsis document (study design, objectives, methods)
2. A dataset (real CSV or instructions for synthetic generation)
3. This pipeline package (unchanged)

That's it. Run cleanup, drop in your synopsis and data, start Claude.

---

## 11. Cost & Time Estimates

| Component | Claude Code | Cowork |
|-----------|-------------|--------|
| Subscription | Pro ($20/mo) or Max ($100-200/mo) | Max only ($100-200/mo) |
| Estimated tokens per full thesis | ~500K-1M input, ~200K-400K output | Similar |
| Approximate sessions | 5-10 sessions over 2-3 days | Not recommended for full pipeline |
| Best model | Claude Opus 4.5 or Sonnet 4.5 | Same |
| R/LaTeX execution | Native terminal access ✅ | File-based execution ✅ |
| Web search for refs | Available ✅ | Available via Chrome extension |
| Iterative debugging | Excellent ✅ | Limited ❌ |

---

## 12. Summary: Best Strategy

### 🏆 Recommended: Claude Code (Terminal)

1. Download all project files from Claude.ai
2. Set up directory structure per Section 2
3. Create CLAUDE.md per Section 3
4. Create skills per Section 4
5. Place new synopsis + data in `input/`
6. Run `claude` and give it the first prompt from Section 6
7. Review each phase, approve, proceed
8. Final compilation and packaging at Phase 11

### 🥈 Alternative: Cowork + Claude Code Hybrid

- Use **Cowork** for: file organisation, running R scripts, compiling LaTeX
- Use **Claude Code** for: writing thesis content, debugging, statistical analysis
- Use **Claude.ai web** for: iterative discussion and planning (if needed)

### ❌ Not Recommended: Cowork Alone

Cowork currently lacks the multi-turn iterative depth needed for full thesis generation. It's excellent for executing individual tasks but the 12-phase pipeline requires sustained context that Claude Code handles better.
