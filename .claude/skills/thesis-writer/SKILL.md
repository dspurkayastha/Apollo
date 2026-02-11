---
name: thesis-writer
description: "Medical thesis writing following GOLD Standard methodology. Use when creating thesis chapters, sections, or any academic medical content. Handles Introduction, Review of Literature, Materials and Methods, Results, Discussion, Conclusion, and all supporting sections. Triggers on: thesis, chapter, section, review of literature, introduction, discussion, conclusion, materials and methods."
---

# Medical Thesis Writer

## When to Use
- Writing any thesis chapter or section
- Creating academic medical content
- Formatting citations in Vancouver style
- Building chronological literature tables
- Any academic writing task for the thesis

## Core Workflow
1. Read `guides/GOLD_Standard_Phased_Plan.md` for the relevant phase instructions
2. Confirm which university format is in use (check `\documentclass` in main.tex)
3. Read `input/synopsis.txt` for study design and objectives
4. Follow the Atomised Thinking Framework: Decompose → Research → Structure → Draft → Verify → QC → Deliver
4. Use web search for up-to-date references (2020-2026 preferred, seminal works any year)
5. Write in British English throughout

## Citation Rules
- Use `\cite{key}` for all inline citations — NEVER hardcode numbers
- Vancouver style: numeric, sequential, serialised across chapters
- Every factual claim, statistic, method, or comparison must have a citation
- Add new BibTeX entries to `output/thesis/references.bib` as you write
- Ensure bidirectional integrity: all `\cite{}` have matching bib entries, all bib entries are cited
- End Review of Literature with a chronological `\begin{longtable}` of all cited works

## Table Formatting
- Use `\begin{longtable}` for tables that may span multiple pages
- Set explicit column widths with `p{Xcm}` to prevent overfull hbox errors
- Use `booktabs` rules: `\toprule`, `\midrule`, `\bottomrule` — no vertical lines
- Caption above table with `\caption{}`, label below caption with `\label{tab:name}`
- For text-heavy cells, use `\raggedright` within `p{}` columns

## Writing Quality Standards
- Original paraphrasing (target <10% plagiarism)
- British English spelling: colour, behaviour, analyse, haemoglobin, oestrogen, centre
- Active voice preferred for methods; passive acceptable for results
- Avoid first person; use "The present study..." or "In this study..."
- Each paragraph should have a clear topic sentence

## Quality Checks Before Delivery
- [ ] All factual claims have citations
- [ ] British English spelling throughout
- [ ] No hardcoded citation numbers (only `\cite{key}`)
- [ ] Tables fit within margins (no overfull hbox)
- [ ] Cross-references use `\ref{}` or `\autoref{}`
- [ ] New BibTeX entries are complete (author, title, journal, year, volume, pages)
- [ ] Section word count meets GOLD Standard targets
