---
name: latex-thesis
description: "LaTeX thesis compilation, debugging, and formatting for Indian medical university theses. Use when compiling .tex files, fixing compilation errors, formatting tables/figures, working with sskm-thesis.cls or ssuhs-thesis.cls, or resolving BibTeX/vancouver.bst issues. Triggers on: compile, latex, pdflatex, bibtex, error, overfull, hbox, undefined reference, missing, compilation."
---

# LaTeX Thesis Compilation & Debugging

## When to Use
- Compiling thesis with pdflatex or latexmk
- Debugging any LaTeX compilation errors
- Formatting tables to prevent overfull hbox
- Working with sskm-thesis.cls or ssuhs-thesis.cls document class
- Managing BibTeX with vancouver.bst
- Fixing cross-reference or citation issues

## Compilation Command
```bash
cd output/thesis/
# Preferred: automatic full compilation
latexmk -pdf -interaction=nonstopmode main.tex

# Manual: when you need control
pdflatex -interaction=nonstopmode main.tex
bibtex main
pdflatex -interaction=nonstopmode main.tex
pdflatex -interaction=nonstopmode main.tex

# Clean auxiliary files
latexmk -c main.tex
```

## CRITICAL KNOWN ISSUES (from production thesis builds)

### 1. DOI Underscores Crash vancouver.bst
**Symptom**: "Missing $ inserted" error pointing to bibliography lines.
**Cause**: DOI fields like `doi = {10.1016/j.surg_2024}` — underscores are math-mode subscript in LaTeX, and vancouver.bst outputs DOIs without escaping.
**Fix**: Remove the `doi` field entirely, OR move to:
```bibtex
note = {DOI: 10.1016/j.surg\_2024}
```

### 2. Certificate/Declaration Pages Show Truncated Text
**Symptom**: "itle" instead of "Title", "andidatename" instead of candidate's name.
**Cause**: `\def\@variablename{#1}` causes scoping issues — `\@` prefix variables lose scope.
**Fix**: Use `\renewcommand{\variablenametext}{#1}` — avoid `\@` prefix entirely in .cls.

### 3. Page Number Positioning
**Symptom**: Page numbers appear at bottom-centre.
**Fix**: In sskm-thesis.cls, change ALL instances of `\fancyfoot[C]` to `\fancyfoot[R]` for bottom-right.

### 4. hyperref pageanchor Warnings
**Symptom**: "pdfTeX warning (ext4): destination with the same identifier" — duplicate page destinations.
**Cause**: Roman → Arabic page numbering transition.
**Fix**: Add `\hypersetup{pageanchor=true}` in preamble, or `\phantomsection` before problematic transitions.

### 5. Undefined References
**Symptom**: `??` in output or undefined reference warnings.
**Fix**: Verify label names exist. Diagnostic command:
```bash
grep -rn "\\\\label{" output/thesis/*.tex | sort
grep -oP '\\\\ref\{[^}]+\}' output/thesis/*.tex | sort -u
```

### 6. Overfull hbox in Tables
**Symptom**: Text extends beyond right margin in tables.
**Fix**: Replace `l`, `c`, `r` column specifiers with `p{Xcm}`:
- For \textwidth ≈ 16cm (A4 with 2.5cm margins):
  - 2 columns: `p{3.0cm} + p{12.0cm}`
  - 3 columns: `p{2.5cm} + p{6.0cm} + p{6.5cm}`
  - 4 columns: `p{2.0cm} + p{4.0cm} + p{4.5cm} + p{4.5cm}`
- Add `\raggedright` in text-heavy cells
- For longtable, set widths in header definition

### 7. Bibliography Unreferenced Entries
**Symptom**: Warnings about unreferenced bibliography entries.
**Fix**: Ensure bidirectional integrity:
```bash
# List all \cite{} keys used in text
grep -oP '\\\\cite\{[^}]+\}' output/thesis/*.tex | sed 's/\\\\cite{//;s/}//' | tr ',' '\n' | sort -u > /tmp/cited.txt
# List all bib entry keys
grep -oP '^@\w+\{([^,]+)' output/thesis/references.bib | sed 's/@\w\+{//' | sort -u > /tmp/bibkeys.txt
# Find mismatches
diff /tmp/cited.txt /tmp/bibkeys.txt
```

### 8. Front Matter Vertical Spacing Overflow
**Symptom**: Text overflows onto next page on certificates/declarations.
**Fix**: Replace fixed `\vspace{Xcm}` with `\vfill` for natural distribution. Reduce font sizes on dense pages.

### 9. Longtable Caption and Label Placement
**Fix**: Caption and label go in the FIRST head, not after \endlastfoot:
```latex
\begin{longtable}{p{2cm}p{4cm}p{9cm}}
\caption{Title here}\label{tab:name}\\
\toprule
...
```

### 10. University Format Selection
**Context**: Two cls files are available — `sskm-thesis.cls` (WBUHS) and `ssuhs-thesis.cls` (SSUHS).
**Both share the same harmonised API**. To switch, change `\documentclass{sskm-thesis}` to `\documentclass{ssuhs-thesis}`.
**Key differences**: SSKM uses "REFERENCES" heading, bottom-centre page numbers, "Director". SSUHS uses "BIBLIOGRAPHY" heading, bottom-right page numbers with department footer, "Principal".

## Pre-Compilation Checklist
- [ ] All `\cite{key}` keys exist in references.bib
- [ ] All `\ref{label}` targets exist as `\label{label}` in text
- [ ] No underscores in DOI fields (or properly escaped)
- [ ] All figure files exist in the path referenced by `\includegraphics`
- [ ] Table column widths sum to ≤ \textwidth
- [ ] `\usepackage{hyperref}` is loaded LAST (or near-last, before cleveref)

## Post-Compilation Verification
```bash
# Check for warnings
grep -i "warning" output/thesis/main.log | head -20
# Check for undefined references
grep "undefined" output/thesis/main.log
# Check for overfull boxes
grep "Overfull" output/thesis/main.log | wc -l
# Verify page count
pdfinfo output/thesis/main.pdf | grep Pages
```
