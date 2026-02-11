
# GOLD Standard Medical Thesis Writing Plan

## Master Instruction Set for AI-Assisted MD/MS Thesis Development

**Version**: 2.1 | **Last Updated**: December 2025  
**Target**: WBUHS (The West Bengal University of Health Sciences) Modern Medicine dissertation format + equivalent Indian medical universities  
**Citation Style**: Vancouver (ICMJE) via BibTeX  
**Language**: British English

---

## Table of Contents

1. [Document Purpose and Scope](#1-document-purpose-and-scope)
2. [Pre-Requisites Checklist](#2-pre-requisites-checklist)
3. [Formatting Specifications Summary](#3-formatting-specifications-summary)
4. [Phased Writing Plan Overview](#4-phased-writing-plan-overview)
5. [Phase 0: Project Orientation](#phase-0-project-orientation)
6. [Phase 1: Front Matter](#phase-1-front-matter)
7. [Phase 2: Introduction](#phase-2-introduction)
8. [Phase 3: Aims and Objectives](#phase-3-aims-and-objectives)
9. [Phase 4: Review of Literature](#phase-4-review-of-literature)
10. [Phase 5: Materials and Methods](#phase-5-materials-and-methods)
11. [Phase 6a: Dataset Creation (Synthetic Cohort Excel)](#phase-6a-dataset-creation-synthetic-cohort-excel)
12. [Phase 6b: Statistical Analysis + Results Writing (Thesis)](#phase-6b-statistical-analysis--results-writing-thesis)
13. [Phase 7: Discussion](#phase-7-discussion)
14. [Phase 8: Conclusion](#phase-8-conclusion)
15. [Phase 9: References](#phase-9-references)
16. [Phase 10: Appendices](#phase-10-appendices)
17. [Phase 11: Final Assembly and Quality Assurance](#phase-11-final-assembly-and-quality-assurance)
18. [Phase 12: Adjudicator QA Evaluation](#phase-12-adjudicator-qa-evaluation)
19. [BibTeX Citation System](#bibtex-citation-system)
19. [Statistical Analysis Guidelines](#statistical-analysis-guidelines)
20. [Quality Control Checklist](#quality-control-checklist)
21. [LaTeX Commands Quick Reference](#latex-commands-quick-reference)

---


## 1. Document Purpose and Scope

### 1.1 Purpose

This document serves as a **master instruction set** for AI-assisted medical thesis writing. It is **topic-agnostic** and applicable to any MD/MS/DM/MCh/MDS thesis under SSUHS or WBUHS (select at session start). When provided alongside:

- `main.tex` (LaTeX thesis template)
- `sskm-thesis.cls` or `ssuhs-thesis.cls` (custom document class — choose one)
- `template-references.bib` (starter bibliography)
- `vancouver.bst` (Vancouver bibliography style)
- Topic-specific synopsis/protocol
- Research data (CSV/Excel)

...this plan enables systematic, high-quality thesis development that meets university standards.

### 1.2 Core Principles

| # | Principle | Description |
|---|-----------|-------------|
| 1 | **GOLD Standard Guide Supersedes All** | University-specific formatting takes precedence |
| 2 | **Synopsis Governs Methods** | Materials & Methods follows approved protocol exactly |
| 3 | **Evidence-Based Writing** | Every claim requires citation; no unsupported statements |
| 4 | **Bidirectional Citation Integrity** | All `\cite{}` commands â†’ bib entries; all bib entries â†’ used in text |
| 5 | **BibTeX for Citations** | Use `\cite{key}` exclusively; never hardcode numbers |
| 6 | **<10% Plagiarism Target** | Original paraphrasing with proper attribution |
| 7 | **British English Throughout** | colour, behaviour, analyse, haemoglobin, oestrogen |
| 8 | **Widow/Orphan Control** | Use `\needspace{}` before major sections |

### 1.3 Atomised Thinking Framework

For each phase, the AI agent must:

1. **Decompose** â€“ Break the section into discrete subtasks
2. **Research** â€“ Gather current literature via web search when needed
3. **Structure** â€“ Outline content before writing
4. **Draft** â€“ Write with `\cite{key}` inline
5. **Verify** â€“ Check citation bidirectionality and format compliance
6. **QC** â€“ Run quality control checks before delivery
7. **Deliver** â€“ Present LaTeX-ready content with BibTeX entries

### 1.4 Phase Gate Rule (Validation-first)

**Before starting ANY phase**, the AI agent must run a **Phase Gate**:

1. **Validate all prior phases** against their deliverables checklist.
2. **Think ultra hard**: identify concrete ways to improve what was done earlier (structure, logic, compliance, citations, clarity, figures/tables).
3. **Implement improvements** (or explicitly log them as â€œdeferred with reasonâ€).
4. **Declare pass/fail** for the gate; **only then** proceed with the current phase.

This rule applies to *every* phase, including Phase 0.


---

## 2. Pre-Requisites Checklist

### 2.1 Required Files

| File | Purpose | Required |
|------|---------|----------|
| `main.tex` | Main thesis document template | âœ" |
| `sskm-thesis.cls` OR `ssuhs-thesis.cls` | Document class with formatting (choose one) | âœ" |
| `vancouver.bst` | Vancouver bibliography style for BibTeX | âœ“ |
| `template-references.bib` | Starter bibliography database | âœ“ |
| `GOLD_Standard_Thesis_Writing_Guide.docx` | Primary formatting reference | âœ“ |
| `Synopsis/Protocol.docx` | Approved protocol/synopsis | âœ“ |
| `Universityguidelines.pdf` | Official university format specs | Optional |
| `Example-Thesis.pdf` | Reference thesis for style | Optional |

### 2.2 Required Information from User

| Information | Used In | When to Request |
|-------------|---------|-----------------|
| Candidate full name | Front matter, certificates | Phase 0 |
| Registration number | Title page, declaration | Phase 0 |
| Guide name and designation | Certificates | Phase 0 |
| Co-guide name (if applicable) | Certificates | Phase 0 |
| HOD name and designation | Certificates | Phase 0 |
| Principal name and designation | Endorsement | Phase 0 |
| Department name | Throughout | Phase 0 |
| IHEC approval number and date | Methods, Ethics statement | Phase 5 |
| Submission month and year | Front matter | Phase 0 |
| Academic session | Title page | Phase 0 |
| Research data (CSV/Excel) | Results | Phase 6 |
| Specific acknowledgements | Acknowledgements | Phase 1 |

### 2.3 Information Derivable from Synopsis

- Study title
- Aims and objectives
- Study design
- Study setting and duration
- Sample size and calculation
- Inclusion/exclusion criteria
- Data collection methods
- Statistical analysis plan
- Ethical considerations framework

---

## 3. Formatting Specifications Summary

### 3.1 Document Format (WBUHS Mandatory â€“ when WBUHS ruleset active)

| Element | Specification |
|---------|---------------|
| Font | Times New Roman |
| Font size | 12 pt main text; 14 pt headings |
| Spacing | Double-spacing (main text); single-spacing (footnotes + references) |
| Margins | 1.0 inch on all sides |
| Alignment | Justified (not left-aligned) |
| Paragraph indent | 0.5 inch first-line indent |
| Page numbers | **Bottom-right corner** (via `\fancyfoot[R]`); Times New Roman 12 pt |

### 3.2 Pagination Rules

| Section | Page Numbering |
|---------|----------------|
| Front Cover â†’ List of Abbreviations | NOT numbered |
| Introduction â†’ Bibliography | Arabic (1, 2, 3...) starting at Page 1 |
| Annexures | Separate section with page numbers |
| Page number position | **Right bottom corner** (cls: `\fancyfoot[R]`, NOT `\fancyfoot[C]`) |

### 3.3 Section Word/Page Limits

| Chapter | Pages | Words | Tense |
|---------|-------|-------|-------|
| Introduction | 3-4 | 750-1000 | Present |
| Aims and Objectives | 1-2 | 200-350 | Present |
| Review of Literature | 10-15 | 3,500-4,000 | Past/Present |
| Materials and Methods | 5-10 | 1,500-2,500 | Past |
| Results and Analysis | 15-20 | 4,000-5,000 | Past |
| Discussion | 8-10 | 2,500-3,500 | Present/Past |
| Summary and Conclusion | 2-3 | 500-750 | Present |
| **TOTAL** | **50-75** | **15,000-20,000** | - |

**Maximum**: 100 pages, 30,000 words (excludes bibliography, annexures, preliminaries)

---

## 4. Phased Writing Plan Overview

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    THESIS DEVELOPMENT PHASES                      â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                   â”‚
â”‚  PHASE 0: Project Orientation                                     â”‚
â”‚     â””â”€â”€ Review files, gather missing info, understand scope       â”‚
â”‚                           â†“                                       â”‚
â”‚  PHASE 1: Front Matter                                            â”‚
â”‚     â””â”€â”€ Certificates, declarations, TOC, lists                    â”‚
â”‚                           â†“                                       â”‚
â”‚  PHASE 2: Introduction                          [Refs 1-N]        â”‚
â”‚     â””â”€â”€ Disease burden, rationale, research question              â”‚
â”‚                           â†“                                       â”‚
â”‚  PHASE 3: Aims and Objectives                   [No new refs]     â”‚
â”‚     â””â”€â”€ Primary aim, objectives with PICO                         â”‚
â”‚                           â†“                                       â”‚
â”‚  PHASE 4: Review of Literature                  [Refs N+1-P]      â”‚
â”‚     â””â”€â”€ Comprehensive review + Longtable of citations             â”‚
â”‚                           â†“                                       â”‚
â”‚  PHASE 5: Materials and Methods                 [Refs P+1-Q]      â”‚
â”‚     â””â”€â”€ Follow synopsis exactly, ethics statement                 â”‚
â”‚                           â†“                                       â”‚
â”‚  PHASE 6: Results and Analysis                  [Refs Q+1-R]      â”‚
â”‚     â””â”€â”€ Statistical analysis from data, tables, figures           â”‚
â”‚                           â†“                                       â”‚
â”‚  PHASE 7: Discussion                            [Refs R+1-S]      â”‚
â”‚     â””â”€â”€ Compare with literature, limitations, implications        â”‚
â”‚                           â†“                                       â”‚
â”‚  PHASE 8: Summary and Conclusion                [No new refs]     â”‚
â”‚     â””â”€â”€ Structured summary, data-driven conclusions               â”‚
â”‚                           â†“                                       â”‚
â”‚  PHASE 9: Bibliography                                            â”‚
â”‚     â””â”€â”€ BibTeX compilation, citation verification                 â”‚
â”‚                           â†“                                       â”‚
â”‚  PHASE 10: Annexures                                              â”‚
â”‚     â””â”€â”€ Ethics certificate, consent forms, proforma, master chart â”‚
â”‚                           â†“                                       â”‚
â”‚  PHASE 11: Final QC and Assembly                                  â”‚
â”‚     â””â”€â”€ Compile, verify, format check, plagiarism check           â”‚
â”‚                                                                   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## Phase 0: Project Orientation

### 0.0 FIRST: Clean Output for New Topic
**If starting a new topic** (different from the previous thesis), run the cleanup script BEFORE anything else:
```bash
./scripts/cleanup_for_new_topic.sh --force
```
This deletes all previous thesis content from `output/thesis/`, `output/figures/`, `output/stats/` and copies fresh templates. **Skipping this step will cause Claude to find and edit the old thesis instead of starting fresh.**

If this is a **continuation** of the same topic (resuming work), skip the cleanup.

### 0.1 Objectives
- Understand the research topic and scope
- Identify all available source materials
- Gather missing information from user
- Set up document structure

### 0.2 Actions

1. **Verify clean workspace** â€" Confirm `output/thesis/main.tex` is the fresh template (not a previous topic's thesis). If it contains chapter content from a different topic, STOP and run `scripts/cleanup_for_new_topic.sh --force`
2. **Review synopsis** â€" Extract aims, objectives, methodology
3. **Check data availability** â€" Confirm research data is ready for Phase 6
4. **Gather metadata** â€" Request missing information per Section 2.2
5. **Select university format** â€" Set `\documentclass{sskm-thesis}` or `\documentclass{ssuhs-thesis}` in `output/thesis/main.tex`
6. **Set up files** â€" Populate metadata commands in main.tex preamble

### 0.3 Deliverables
- Clean workspace verified (no stale content from previous topic)
- Completed metadata in `main.tex` preamble
- Understanding of research scope
- List of any missing materials

---

## Phase 1: Front Matter

### 1.1 Objectives
- Generate all certificate pages
- Set up table of contents structure
- Create lists (figures, tables, abbreviations)

### 1.2 Mandatory Sequence (WBUHS Modern Medicine)

| # | Section | Notes |
|---|---------|-------|
| 1 | Title Page | Title, candidate, guide/coâ€‘guide, course, institution, department, submission date |
| 2 | Certificates | Guide (+ coâ€‘guide if any), HOD, Head of Institution, **IEC certificate** |
| 3 | Candidate Declaration | Originality declaration |
| 4 | Acknowledgements | Manual content |
| 5 | Table of Contents | `\tableofcontents` |
| 6 | Structured Abstract | â‰¤1000 words; structured |

**Note:** WBUHS places â€œList of Additional Figures/Tablesâ€ and â€œList of Abbreviationsâ€ later in the thesis (after Conclusion and before References). Generate them during Final Assembly.

### 1.2b Formatting Notes for Front Matter
- **Singlespace dense pages**: Wrap certificates, declarations, and acknowledgements in `\begin{singlespace}...\end{singlespace}` to prevent vertical overflow (double-spacing causes text to spill onto next page)
- **Title page logos**: Include BOTH university and institute logos, positioned between the university name text and the candidate/guide information block
- **Vertical centering**: Use dual `\vfill` (before and after candidate/guide block) on the title page for natural distribution

### 1.3 Abstract Requirements

- **Word count**: â‰¤1000 words (WBUHS).
- **Structure**: Background, Objectives, Methods, Results, Conclusion
- **NO CITATIONS** allowed
- **Keywords**: 4-6 MeSH terms

### 1.4 Abbreviations

- List ALL abbreviations used in thesis
- Alphabetical order
- Use longtable for multi-page lists
- Standard abbreviations (MRI, CT, ECG) still need listing

### 1.5 TOC Entries

Ensure these sections appear in TOC:
```latex
\addcontentsline{toc}{chapter}{Abstract}
\addcontentsline{toc}{chapter}{List of Tables}
\addcontentsline{toc}{chapter}{List of Figures}
\addcontentsline{toc}{chapter}{List of Abbreviations}
```

---

## Phase 2: Introduction

### 2.1 Objectives
- Establish disease burden and significance
- Present rationale for the study
- State research question

### 2.2 Structure

1. **Global burden** (cite epidemiological data)
2. **Indian/regional context** (ICMR, state-level data)
3. **Clinical significance** (complications, mortality)
4. **Current assessment methods** (limitations)
5. **Your proposed marker/intervention** (rationale)
6. **Knowledge gap** (what is unknown)
7. **Research question** (clear statement)

### 2.3 Writing Rules

- Present tense throughout
- Every factual claim requires `\cite{key}`
- Define abbreviations at first use
- 500-750 words (2-3 pages)
- British English

### 2.4 BibTeX Entries Required

Typical Introduction needs 10-15 references:
- Disease burden statistics (WHO, GBD, ICMR)
- Regional epidemiology
- Clinical significance studies
- Current guidelines
- Your specific marker/intervention background

---

## Phase 3: Aims and Objectives

### 3.1 Objectives
- State clear, measurable research aims
- Define primary and secondary objectives

### 3.2 Structure

```latex
\section*{Aim}
[Single overarching aim statement]

\section*{Primary Objective}
[Main hypothesis-driven objective]

\section*{Secondary Objectives}
\begin{enumerate}
    \item [Objective 1]
    \item [Objective 2]
    \item [Objective 3]
\end{enumerate}

\section*{Research Hypothesis} % Optional
[Null and alternative hypotheses if applicable]
```

### 3.3 Writing Rules

- Present tense
- Action verbs: determine, evaluate, compare, assess, correlate
- PICO format where applicable
- 150-200 words (1 page)
- Usually NO new citations (derived from synopsis)

---

## Phase 4: Review of Literature

### Phase Gate (must-pass)
- Validate Phases 0â€“3 deliverables are complete and compliant.
- Think ultra hard: apply improvements (structure, logic, citations) before writing the ROL.

### 4.X Figures to complement the ROL (mandatory)
- Think ultra hard: propose evidence-synthesis figures that strengthen the ROL (e.g., PRISMA-style flow, study timeline, evidence gap map, forest-plot-style summary where appropriate).
- Provide **R code** (to be included into the single comprehensive figures script) that can generate these figures from a structured extraction table.


### 4.0b Open-Access Figures for ROL (mandatory)
Include high-quality open-access figures from CC BY 4.0 PMC articles to illustrate key concepts:
- **Anatomy**: Cross-sectional diagrams, relevant anatomical illustrations
- **Classification systems**: EHS classification, scoring systems, staging diagrams
- **Surgical techniques**: Mesh positions, operative approaches, procedural steps
- **Source**: Download from PMC articles with CC BY 4.0 licence; include full attribution in captions: `(Reproduced from Author et al.\ \cite{key}, \textcopyright~The Author(s) YEAR, CC~BY~4.0)`
- **Placement**: Insert figures at logical points within the ROL text, near the relevant discussion

### 4.1 Objectives
- Comprehensive review of relevant literature
- Identify knowledge gaps
- Justify the current study

### 4.2 Suggested Structure

```
4.1 Historical Perspective
4.2 Epidemiology
    4.2.1 Global Burden
    4.2.2 Indian Epidemiology
4.3 Pathophysiology
4.4 Clinical Features and Diagnosis
4.5 Current Assessment Methods
    4.5.1 [Existing scoring systems]
    4.5.2 [Existing biomarkers]
4.6 [Your Study Focus Area]
    4.6.1 [Background of your marker/intervention]
    4.6.2 [Prior studies]
4.7 Indian Studies
4.8 Gaps in Current Knowledge
```

### 4.3 MANDATORY: Summary Longtable

At the end of Review of Literature, include a chronological summary table:

```latex
\section*{Summary of Studies Reviewed}

\begin{longtable}{|p{0.4cm}|p{2.5cm}|p{1.0cm}|p{2.0cm}|p{1.3cm}|p{4.2cm}|}
\caption{Chronological Summary of Studies Cited in Review of Literature}
\label{tab:lit_review_summary}\\
\hline
\textbf{Sl.} & \textbf{Author(s)} & \textbf{Year} & \textbf{Study Design} & \textbf{Sample} & \textbf{Key Findings} \\
\hline
\endfirsthead
% ... continuation headers ...
\endhead
\endfoot
\endlastfoot

1 & Pugh et al.\cite{pugh1973} & 1973 & Case series & 38 & Original CTP score \\
\hline
% Continue for ALL studies cited
\end{longtable}
```

### 4.4 Writing Rules

- Past tense for reported findings
- Present tense for established facts
- 2,500-3,500 words (10-15 pages)
- Prioritise studies from last 5-10 years
- Include landmark historical studies
- EVERY claim needs `\cite{key}`

---

## Phase 5: Materials and Methods

### 5.1 Objectives
- Document methodology reproducibly
- Follow approved synopsis EXACTLY
- Include ethics statement

### 5.2 NBEMS Mandatory Components (12 Sections)

| # | Section | Content |
|---|---------|---------|
| 1 | Study Setting | Institution, departments |
| 2 | Study Duration | Total duration, data collection period |
| 3 | Study Design | With STROBE/CONSORT reference |
| 4 | Study Population | Source, target, accessible |
| 5 | Sample Size Calculation | Formula, parameters, result |
| 6 | Sampling Method | Consecutive/random/stratified |
| 7 | Selection Criteria | Inclusion AND Exclusion |
| 8 | Data Collection | Procedures, instruments |
| 9 | Outcome Measures | Primary and secondary |
| 10 | Statistical Analysis | Software, tests, significance level |
| 11 | Ethical Considerations | IHEC approval, consent, confidentiality |
| 12 | Operational Definitions | If needed |

### 5.3 Ethics Statement Template

```latex
This study was approved by the Institutional Human Ethics Committee (IHEC) 
of Silchar Medical College and Hospital, Silchar, Assam 
(IHEC Approval No. SMCH/IHEC/[[YEAR]]/[[NUMBER]] dated [[DD/MM/YYYY]]). 
The study was conducted in accordance with the Indian Council of Medical 
Research (ICMR) National Ethical Guidelines for Biomedical and Health 
Research Involving Human Participants (2017)\cite{icmr2017} and the 
Declaration of Helsinki.\cite{wma2013}
```

### 5.4 Writing Rules

- Past tense throughout
- 1,500-2,500 words (5-10 pages)
- Follow synopsis verbatim for procedures
- Cite software, statistical methods, guidelines

---

## Phase 6a: Dataset Creation (Synthetic Cohort Excel)

### Phase Gate (must-pass)
- Validate Phases 0â€“5 deliverables are complete and compliant.
- Think ultra hard and apply improvements before proceeding.

### 6a.1 Aim
Create a **synthetic dataset Excel file** with:
- adequate granularity + correct columns to fulfil all objectives
- a clear data dictionary + codebook sheet(s)
- derived/score columns where needed
- **plausible** synthetic values matching an Indian hospital cohort
- rigorous validation for correctness, plausibility, and completeness

### 6a.2 Must-read inputs (repeat as needed)
1. **Synopsis**: especially **Aims & Objectives** + **Materials & Methods**
2. Any approved proforma/CRF (if present)

### 6a.3 Instructions (do not skip)
1. Orient thoroughly with Synopsis Aims/Objectives and Methods.
2. Think ultra hard: list every variable needed for each objective + every analysis planned in Methods.
3. Design the dataset workbook:
   - `data` (one row per patient/encounter)
   - `data_dictionary` (name, label, type, unit, allowed range, missing coding, source)
   - `codes` (all categorical codebooks)
   - optional `derived_columns` (explicit definitions/formulas)
4. Generate plausible synthetic values across all rows/columns (no impossible/negative/contradictory values).
5. Validate rigorously (completion, plausibility, internal consistency, and objective coverage).

### 6a.4 Deliverables
- `synthetic_dataset.xlsx` (preferred) / or `.csv` + dictionary sheets
- Validation log: checks run + issues fixed

---

## Phase 6b: Statistical Analysis + Results Writing (Thesis)

### Phase Gate (must-pass)
- Validate Phase 6a dataset is correct, plausible, and complete.
- Think ultra hard: improve dataset/derived variables BEFORE analysing.

### 6b.1 Aim
Perform the analyses required by the Synopsis/Methods, generate the full set of tables/figures, and write **Chapter 5: Results** in LaTeX.

### 6b.2 Must-read inputs (repeat as needed)
1. Synopsis: **Aims & Objectives** + **Materials & Methods**
2. `synthetic_dataset.xlsx/.csv`
3. Thesis LaTeX template (selected .cls file)

### 6b.3 Instructions (do not skip)
1. Map each objective â†’ endpoint(s) â†’ analysis (exactly per Methods).
2. Think ultra hard: enumerate ALL analyses needed to satisfy ALL objectives (primary + secondary + subgroup + sensitivity where relevant).
3. Run analyses and export outputs reproducibly.
4. Think ultra hard: decide what tables/figures best communicate the breadth and depth of findings.
5. Generate tables/figures and then write the Results chapter in LaTeX.

### 6b.4 R scripting requirement (global)
- All analyses + figures must run from **one comprehensive R script** (e.g., `thesis_results_and_figures.R`) using current packages.
- The script must: read data â†’ run analyses â†’ export tables/figures to `/outputs/` â†’ print a concise run log.

### 6b.5 Deliverables
- `thesis_results_and_figures.R`
- `/outputs/` folder (tables + figures)
- LaTeX-ready `\chapter{Results}` content

---

## Phase 7: Discussion

### 7.1 Objectives
- Interpret findings in context of literature
- Discuss strengths and limitations
- Suggest implications and future directions

### 7.2 Structure

```
7.1 Summary of Key Findings
7.2 Comparison with Literature â€“ Primary Outcome
    7.2.1 [Aspect 1]
    7.2.2 [Aspect 2]
7.3 Comparison with Literature â€“ Secondary Outcomes
    7.3.1 [Secondary Outcome 1]
    7.3.2 [Secondary Outcome 2]
7.4 Mechanistic Explanation (if applicable)
7.5 Strengths of the Study
7.6 Limitations of the Study
7.7 Clinical Implications
7.8 Future Directions
```

### 7.3 Writing Rules

- Present/past tense mixed
- Compare findings with specific studies using `\cite{key}`
- Be thorough and honest about limitations
- Use `\needspace{4\baselineskip}` before each major section
- 2,000-2,500 words (8-10 pages)
- NO new data â€“ only interpret existing results

---

## Phase 8: Conclusion

### 8.1 Objectives
- Provide structured summary
- State data-driven conclusions
- Make recommendations

### 8.2 Structure

```latex
\section{Summary}

\subsection{Background}
[2-3 sentences]

\subsection{Objectives}
[Primary and key secondary objectives]

\subsection{Methods}
[Study design, setting, sample size, key methods]

\subsection{Results}
[Key findings with specific numbers]

\section{Conclusions}

Based on the findings of this study, we conclude that:

\begin{enumerate}
\item [Conclusion 1 â€“ directly from results]
\item [Conclusion 2 â€“ directly from results]
\item [Conclusion 3 â€“ directly from results]
\end{enumerate}

\section{Recommendations}

\begin{enumerate}
\item [Recommendation 1]
\item [Recommendation 2]
\item [Recommendation 3]
\end{enumerate}
```

### 8.3 Writing Rules

- Present tense
- NO new citations
- Conclusions must arise DIRECTLY from your data
- No extrapolation or speculation
- 500-750 words (2-3 pages)
- Use `\needspace{4\baselineskip}` before Conclusions and Recommendations

---

## Phase 9: References

### 9.1 Objectives
- Compile complete reference list
- Verify citation integrity
- Generate properly formatted bibliography

### 9.2 BibTeX Compilation Sequence

```bash
pdflatex main.tex     # Generate .aux with \citation commands
bibtex main           # Process .aux, create .bbl from .bib
pdflatex main.tex     # Incorporate .bbl into document
pdflatex main.tex     # Resolve all cross-references
```

### 9.3 Citation Verification Checklist

- [ ] All `\cite{key}` commands have corresponding .bib entries
- [ ] No duplicate entries in .bib file
- [ ] No unused entries in .bib file
- [ ] Consistent citation key format (authorYEAR)
- [ ] All DOIs included where available
- [ ] Special characters properly escaped

### 9.4 Bibliography TOC Entry

```latex
\backmatter
\clearpage
\bibliography{references}
\addcontentsline{toc}{chapter}{Bibliography}
```

---

## Phase 10: Appendices

### 10.1 Mandatory Annexures (SSUHS)

| Annexure | Content | Format |
|----------|---------|--------|
| I | IHEC Clearance Certificate | PDF attachment |
| II | Plagiarism Certificate | PDF attachment (<10%) |
| III | Informed Consent Form | LaTeX content |
| IV | Patient Information Sheet | LaTeX content |
| V | Proforma/Case Record Form | LaTeX content |
| VI | Master Chart | PDF attachment or longtable |

**All Annexures should be properly fleshed out with adequate and complete content and proper Formatting**
Annexures iii,iv,v, should have adequate content, proper format.
### 10.2 PDF Attachment Method

```latex
\chapter*{ANNEXURE I: IHEC CLEARANCE CERTIFICATE}
\addcontentsline{toc}{chapter}{Annexure I: IHEC Clearance Certificate}

\includepdf[pages=-]{annexures/ihec_certificate.pdf}
```

### 10.3 Master Chart Options

**Option A: PDF attachment**
```latex
\includepdf[pages=-,landscape]{annexures/master_chart.pdf}
```

**Option B: Landscape longtable**
```latex
\begin{landscape}
\begin{longtable}{|c|c|c|c|...|}
% Table content
\end{longtable}
\end{landscape}
```

---

## Phase 11: Final Assembly and Quality Assurance

### 11.1 Pre-Compilation Checklist

#### Document Structure
- [ ] All chapters present in correct sequence
- [ ] `\frontmatter`, `\mainmatter`, `\backmatter`, `\annexurematter` commands in place
- [ ] `\clearpage` before major divisions

#### Citations
- [ ] All `\cite{}` commands resolve without errors
- [ ] No "undefined citation" warnings
- [ ] Bibliography appears in correct location
- [ ] TOC entry for Bibliography

#### Cross-References
- [ ] All `\ref{}` commands resolve
- [ ] No "undefined reference" warnings
- [ ] Tables/figures appear near their first reference

#### Page Layout
- [ ] Widow/orphan penalties active
- [ ] `\needspace{}` before major sections
- [ ] No overfull hbox warnings (check longtable widths)
- [ ] Figures not exceeding margins

### 11.2 Quality Control Commands

Add these to preamble for widow/orphan control:
```latex
\widowpenalty=10000
\clubpenalty=10000
\displaywidowpenalty=10000
\predisplaypenalty=10000
\postdisplaypenalty=10000
```

Add this package for header protection:
```latex
\usepackage{needspace}
```

Usage before sections:
```latex
\needspace{4\baselineskip}
\section{Section Title}
```

### 11.3 Final Compilation Sequence

```bash
# Full compilation with bibliography
pdflatex main.tex
bibtex main
pdflatex main.tex
pdflatex main.tex

# Or using latexmk
latexmk -pdf main.tex
```

### 11.4 Post-Compilation Checks

- [ ] Page numbers correct (preliminaries unnumbered, main text from 1)
- [ ] Page numbers at bottom-right (not bottom-centre)
- [ ] TOC complete with all sections
- [ ] LOT and LOF complete
- [ ] All figures render correctly
- [ ] No blank pages where unwanted
- [ ] Footer information correct

### 11.4b Visual PDF Verification (MANDATORY)
After every compilation, render the PDF to images and visually inspect key pages:
```bash
pdftoppm -png -f 1 -l 5 main.pdf /tmp/thesis_verify   # title + front matter
pdftoppm -png -f 50 -l 55 main.pdf /tmp/thesis_verify  # mid-document pages
```
Verify: title page layout (logos, centering), certificate formatting, page numbers at bottom-right, table column widths, figure rendering and captions.

### 11.5 Plagiarism Check

- Submit to Turnitin/iThenticate/ShodhShuddhi
- Target: <10% similarity (UGC Level 0)
- Attach certificate as Annexure II

---

## Phase 12: Adjudicator QA Evaluation

### Phase Gate (must-pass)
- Phase 11 must be complete with clean compilation (zero errors, zero undefined references).
- All prior phases must have passed their respective deliverable checklists.

### 12.1 Objectives
- Simulate a full adjudicator/examiner review of the thesis
- Verify compliance with ALL university-specific formatting mandates
- Ensure content consistency, factual accuracy, and internal coherence
- Identify and fix any issues before submission

### 12.2 Formatting Compliance Audit (University-Specific)

#### WBUHS Mandatory Checks
| # | Check | Specification | How to Verify |
|---|-------|---------------|---------------|
| 1 | Font | Times New Roman 12pt | cls: `\RequirePackage{mathptmx}`, `12pt` class option |
| 2 | Line spacing | Double-spacing (main text) | cls: `\doublespacing` |
| 3 | Margins | Left 1.5in (binding), others 1.0in | cls: `geometry` package settings |
| 4 | Alignment | Justified | cls: `\justifying` |
| 5 | Paragraph indent | 0.5 inch first-line | cls: `\setlength{\parindent}{0.5in}` |
| 6 | Page numbers | Bottom centre or top right | cls: `\fancyfoot` configuration |
| 7 | Front matter | NOT numbered | cls: `\pagenumbering{gobble}` in `\frontmatter` |
| 8 | Main matter | Arabic from Page 1 | cls: `\pagenumbering{arabic}` in `\mainmatter` |
| 9 | Heading size | 14pt for chapter titles | cls: `\Large` in `\titleformat{\chapter}` |
| 10 | Hyphenation | Disabled | cls: `\RequirePackage[none]{hyphenat}` |

### 12.3 Content Quality Audit

#### Word Count Verification
| Chapter | Target Words | Target Pages | Tense |
|---------|-------------|-------------|-------|
| Introduction | 750-1000 | 3-4 | Present |
| Aims and Objectives | 200-350 | 1-2 | Present |
| Review of Literature | 3,500-4,000 | 10-15 | Past/Present |
| Materials and Methods | 1,500-2,500 | 5-10 | Past |
| Results | 4,000-5,000 | 15-20 | Past |
| Discussion | 2,500-3,500 | 8-10 | Present/Past |
| Conclusion | 500-750 | 2-3 | Present |

**Note:** Word counts for Results chapter include table and figure content. Raw text word count may be lower if the chapter is data-intensive with many tables/figures.

#### Tense Consistency
- [ ] Introduction: Present tense for established facts
- [ ] ROL: Past tense for reported findings, present for established facts
- [ ] M&M: Past tense throughout
- [ ] Results: Past tense throughout
- [ ] Discussion: Mix of present (established facts) and past (study findings)
- [ ] Conclusion: Present tense

#### British English Check
- [ ] Verify: analyse (not analyze), colour (not color), behaviour (not behavior)
- [ ] Verify: haemoglobin, oestrogen, gynaecological, centre, metre, litre
- [ ] Verify: categorised, standardised, recognised, characterised

### 12.4 Citation and Reference Audit

- [ ] Bidirectional integrity: All `\cite{}` keys have matching `.bib` entries
- [ ] Bidirectional integrity: All `.bib` entries are cited in text
- [ ] No DOI fields in `.bib` (vancouver.bst crash prevention)
- [ ] R software properly cited (R Core Team, not a textbook)
- [ ] All software versions match actual installed versions
- [ ] Vancouver style rendering correctly (numeric, sequential)

### 12.5 Consistency Checks

- [ ] Patient counts consistent across Abstract, Results, and Conclusion
- [ ] Statistical values (p-values, OR, CI) consistent across Results and Discussion
- [ ] Study duration consistent across Abstract, M&M, and Results
- [ ] Institutional names consistent throughout (IPGME&R, SSKM, WBUHS)
- [ ] Candidate and guide names match across all certificates

### 12.5b Data Verification (MANDATORY)
ALL numbers in the thesis MUST match `dataset.csv`. Run a Python verification script to cross-check:
- Total patient count, group counts
- Demographic percentages and means
- All statistical results (p-values, OR, CI) cited in Results, Discussion, Conclusion, and Abstract
- Any discrepancy is a CRITICAL issue that must be fixed before sign-off

### 12.6 Table and Figure Audit

- [ ] All tables referenced in text before they appear
- [ ] All figures referenced in text before they appear
- [ ] Table captions above the table
- [ ] Figure captions below the figure
- [ ] No overfull hbox warnings (max 5pt tolerance)
- [ ] Column widths sum to less than text width
- [ ] All tables have `\toprule`, `\midrule`, `\bottomrule` (booktabs style)

### 12.7 Structural Completeness

- [ ] Title page with all metadata
- [ ] Declaration by candidate
- [ ] Certificate from Guide
- [ ] Certificate from Co-Guide (if applicable)
- [ ] Certificate from HOD
- [ ] Endorsement by Head of Institution
- [ ] IEC/IHEC certificate (placeholder acceptable if not yet available)
- [ ] Acknowledgements (placeholder acceptable if personal content pending)
- [ ] Table of Contents (auto-generated)
- [ ] Abstract (structured, no citations, keywords)
- [ ] All 7 chapters present and populated
- [ ] List of Figures, List of Tables
- [ ] List of Abbreviations (alphabetical, complete)
- [ ] References (Vancouver style)
- [ ] Consent form
- [ ] Data collection proforma
- [ ] Master chart (placeholder acceptable if final data pending)
- [ ] Plagiarism certificate (placeholder acceptable)

### 12.8 Deliverables

1. **QA Report**: Document all findings with severity (CRITICAL/WARNING/INFO)
2. **All CRITICAL issues fixed**: Compilation clean, formatting compliant
3. **Updated thesis PDF**: Final compiled version
4. **Sign-off**: Explicit pass/fail declaration

### 12.9 Automation Script

```python
# Citation integrity check
import re

with open('main.tex') as f:
    tex = f.read()
with open('references.bib') as f:
    bib = f.read()

cite_keys = set()
for m in re.finditer(r'\\cite\{([^}]+)\}', tex):
    for k in m.group(1).split(','):
        cite_keys.add(k.strip())

bib_keys = set(re.findall(r'^@\w+\{(\w+),', bib, re.MULTILINE))

missing = cite_keys - bib_keys
unused = bib_keys - cite_keys

print(f'Cited: {len(cite_keys)} | Bib entries: {len(bib_keys)}')
if missing: print(f'MISSING bib entries: {missing}')
if unused: print(f'UNUSED bib entries: {unused}')
if not missing and not unused: print('Bidirectional integrity: PASS')
```

---

## BibTeX Citation System

### Entry Types and Required Fields

#### Journal Article (Most Common)
```bibtex
@article{sharma2024,
  author = {Sharma, Rahul K and Gupta, Priya M and Singh, Arun},
  title = {Title in sentence case},
  journal = {Indian J Med Res},
  year = {2024},
  volume = {159},
  number = {3},
  pages = {245--252},
  doi = {10.4103/ijmr.ijmr_123_24}
}
```

#### Book
```bibtex
@book{harrison2022,
  author = {Kasper, Dennis L and Fauci, Anthony S},
  title = {Harrison's Principles of Internal Medicine},
  edition = {21st},
  publisher = {McGraw-Hill},
  year = {2022},
  address = {New York}
}
```

#### Book Chapter
```bibtex
@incollection{chapter2021,
  author = {Author, Name},
  title = {Chapter title},
  booktitle = {Book Title},
  editor = {Editor, Name},
  publisher = {Publisher},
  year = {2021},
  pages = {100--125}
}
```

#### Thesis
```bibtex
@phdthesis{candidate2022,
  author = {Candidate, Name},
  title = {Thesis title},
  school = {University Name},
  year = {2022},
  address = {City},
  note = {MD thesis}
}
```

#### Website/Online
```bibtex
@misc{who2024,
  author = {{World Health Organization}},
  title = {Page Title},
  year = {2024},
  url = {https://www.who.int/page},
  note = {Accessed: December 15, 2024}
}
```

### Citation Key Convention

Format: `firstauthorYEAR` or `firstauthorYEARa`, `firstauthorYEARb` for multiple papers

Examples:
- `sharma2024`
- `pugh1973`
- `devarbhavi2023`
- `gbd2020`

### Special Character Escaping

| Character | Escape | Example |
|-----------|--------|---------|
| % | \% | 95\% |
| & | \& | Smith \& Jones |
| _ | \_ | doi:10.1000/xyz\_123 |
| # | \# | Issue \#5 |
| $ | \$ | \$100 |
| { } | Keep capitals | {COVID-19}, {India} |

### Inline Citation Usage

```latex
% Single citation
...as reported previously.\cite{sharma2024}

% Multiple citations
...confirmed by several studies.\cite{huang2023,pugh1973,kamath2025}

% Author mention
According to Sharma et al.\cite{sharma2024}, the prevalence...

% In longtable
1 & Pugh et al.\cite{pugh1973} & 1973 & Case series & 38 & Key finding \\
```

---

## Statistical Analysis Guidelines

**Reproducibility rule:** All figures (including ROL figures) must be generated from **one comprehensive, up-to-date R script** (single entrypoint) using modern packages and a consistent modern sleek style guide. Avoid fragmented scripts.


### 18.1 Software Citation

```latex
Statistical analysis was performed using IBM SPSS Statistics 
version 25.0 (IBM Corp, Armonk, NY).\cite{ibmspss2017}
```

### 18.2 Test Selection Guide

| Data Type | Comparison | Test |
|-----------|------------|------|
| Continuous, normal | 2 groups | Independent t-test |
| Continuous, normal | >2 groups | One-way ANOVA |
| Continuous, non-normal | 2 groups | Mann-Whitney U |
| Continuous, non-normal | >2 groups | Kruskal-Wallis |
| Categorical | 2Ã—2 | Chi-square / Fisher's exact |
| Categorical | >2Ã—2 | Chi-square |
| Correlation, normal | 2 continuous | Pearson's r |
| Correlation, non-normal | 2 continuous | Spearman's Ï |

### 18.3 Reporting Standards

```latex
% Correlation
There was a strong positive correlation between X and Y 
($\rho$ = 0.771, 95\% CI: 0.689--0.834, p < 0.001).

% Group comparison
Group A had significantly higher values than Group B 
(32.27 $\pm$ 9.67 vs. 22.74 $\pm$ 9.63, p < 0.001).

% Chi-square
There was a significant association between X and Y 
($\chi^2$ = 15.23, df = 2, p = 0.002).
```

---

## Quality Control Checklist

### 19.1 Citation Audit Script

Run this to verify citation integrity:

```bash
# Extract all citation keys from .tex
grep -oE "\\\\cite\{[^}]+\}" main.tex | sed 's/\\cite{//;s/}//' | tr ',' '\n' | sort | uniq > tex_cites.txt

# Extract all keys from .bib
grep -o "@[a-z]*{[^,]*" references.bib | sed 's/@[a-z]*{//' | sort > bib_keys.txt

# Find citations missing from bib
comm -23 tex_cites.txt bib_keys.txt

# Find unused bib entries
comm -13 tex_cites.txt bib_keys.txt
```

### 19.2 Common Errors to Avoid

#### Writing Errors
- Using "I" instead of passive voice or "we"
- American spellings (color, analyze, organize)
- Starting sentences with abbreviations
- Using undefined abbreviations
- Hyphenating at line breaks

#### Statistical Errors
- Reporting p=0.000 (use p<0.001)
- Missing confidence intervals
- Using parametric tests on non-normal data
- Confusing statistical and clinical significance

#### Citation Errors
- Duplicate entries in .bib
- Missing citations (cited but not in list)
- Orphan references (in list but not cited)
- Inconsistent citation key format

#### Format Errors
- Tables/figures not referenced in text
- Caption below tables (should be above)
- Caption above figures (should be below)
- Missing units in tables
- Overfull hbox from wide tables

---

## LaTeX Commands Quick Reference

### Custom Commands (both cls files)

```latex
% Statistics
\pvalue{0.032}        â†’ p = 0.032
\pless{0.001}         â†’ p < 0.001
\ci{1.2}{3.4}         â†’ 95% CI [1.2, 3.4]
\meansd{45.2}{12.3}   â†’ 45.2 Â± 12.3
\medianiqr{42}{35-48} â†’ 42 (IQR: 35-48)

% Document structure
\frontmatter          â†’ No page numbers
\mainmatter           â†’ Arabic page numbers from 1
\backmatter           â†’ Bibliography style
\annexurematter       â†’ Annexure style

% Certificates (auto-generated)
\makeguidecertificate
\makehodcertificate
\makeprincipalcertificate
\makedeclaration
```

### Table Template

```latex
\begin{table}[htbp]
\centering
\caption{Title Above Table}
\label{tab:label}
\begin{tabular}{@{}llcc@{}}
\toprule
\textbf{Column 1} & \textbf{Column 2} & \textbf{Column 3} & \textbf{p-value} \\
\midrule
Row 1 & Data & Data & 0.XXX \\
Row 2 & Data & Data & 0.XXX \\
\bottomrule
\end{tabular}
\begin{tablenotes}
\small
\item Abbreviations: XX, XXX
\end{tablenotes}
\end{table}
```

### Figure Template

```latex
\begin{figure}[htbp]
\centering
\includegraphics[width=0.8\textwidth]{figures/filename.png}
\caption{Caption Below Figure}
\label{fig:label}
\end{figure}
```

### Longtable Template (for Literature Review Summary)

```latex
\begin{longtable}{|p{0.4cm}|p{2.5cm}|p{1.0cm}|p{2.0cm}|p{1.3cm}|p{4.2cm}|}
\caption{Table Title}
\label{tab:label}\\
\hline
\textbf{Sl.} & \textbf{Author(s)} & \textbf{Year} & \textbf{Design} & \textbf{n} & \textbf{Findings} \\
\hline
\endfirsthead
\multicolumn{6}{c}{{\tablename\ \thetable{} -- continued}} \\
\hline
\textbf{Sl.} & \textbf{Author(s)} & \textbf{Year} & \textbf{Design} & \textbf{n} & \textbf{Findings} \\
\hline
\endhead
\hline
\multicolumn{6}{r}{{Continued on next page}} \\
\endfoot
\hline
\endlastfoot

1 & Author\cite{key} & 2020 & Design & 100 & Finding \\
\hline

\end{longtable}
```

### Cross-Reference Commands

```latex
% Reference tables
As shown in Table~\ref{tab:demographics}...

% Reference figures
Figure~\ref{fig:scatter} demonstrates...

% Reference chapters
As discussed in Chapter~\ref{chap:methods}...

% Reference sections
See Section~\ref{sec:analysis} for details.
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | December 2024 | Initial release |
| 1.1 | December 2024 | Added BibTeX implementation, cross-reference rules |
| 2.0 | December 2024 | Topic-agnostic version; incorporated QC learnings; added widow/orphan control; needspace requirements; citation audit procedures; comprehensive Quality Control section |
| 2.1 | February 2026 | Added Phase 12: Adjudicator QA Evaluation; comprehensive university compliance audit, content quality verification, and consistency checks as a formal pipeline step |
| 2.2 | February 2026 | Added 15 production workflow corrections: formatting rules (page numbers, singlespace, logos, centering), content rules (data verification, India-relevant, software citations, DOI, ROL figures), workflow additions (QA phase, visual verification, subagents, university selection) |

---

**END OF DOCUMENT**

*This phased plan is designed to be used with the medical thesis LaTeX template package (main.tex + sskm-thesis.cls or ssuhs-thesis.cls + vancouver.bst + template-references.bib) and follows the GOLD Standard Thesis Writing Guide.*
