# Apollo

**AI-powered medical thesis generator for Indian universities.**

Apollo is a structured pipeline that takes a research synopsis, university formatting rules, and optional datasets — and produces a complete, submission-ready MD/MS/DM/MCh thesis PDF with proper citations, statistical analysis, and figures.

---

## What It Does

| Input | Output |
|-------|--------|
| Research synopsis | Complete thesis PDF (50-100 pages) |
| University rules (cls file) | Vancouver-style bibliography |
| Dataset (optional) | Publication-quality R figures |
| | Statistical analysis reports |
| | Appendices (consent forms, proforma, master chart) |

Apollo follows a **12-phase GOLD Standard methodology** — from orientation through front matter, literature review, statistical analysis, discussion, and final QA — producing a thesis that meets university dissertation standards.

## Supported Universities

| University | Class File | Status |
|------------|-----------|--------|
| WBUHS (West Bengal University of Health Sciences) | `sskm-thesis.cls` | Production |
| SSUHS (Srimanta Sankaradeva University of Health Sciences) | `ssuhs-thesis.cls` | Production |
| *Your university* | *Add your own cls* | Extensible |

Both class files share a **harmonised API** — switching universities requires changing only the `\documentclass` line. Adding a new university means creating a new `.cls` file that implements the same commands.

## Quick Start

### Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (CLI) with Claude Max or Pro subscription
- TeX Live 2025+ (pdflatex, bibtex, latexmk)
- R 4.4+ (with tidyverse, gtsummary, ggplot2)
- Python 3.11+

### Setup

```bash
# Clone the repository
git clone https://github.com/dspurkayastha/Apollo.git
cd Apollo

# Place your input files
cp /path/to/your/synopsis.txt input/synopsis.txt
cp /path/to/your/data.csv input/dataset.csv       # optional

# Start Claude Code
claude
```

### First Prompt

```
Read CLAUDE.md, then read guides/GOLD_Standard_Phased_Plan.md completely.
Read input/synopsis.txt for my research topic.
Read guides/lessons_learned.md for critical fixes.

Now execute the full thesis pipeline starting from Phase 0.
Work through each phase sequentially, following the phase gate rules.
Present each phase's output for my review before proceeding.
```

### Automated Pipeline

```bash
# Interactive — select university, then run all phases
./scripts/full_pipeline.sh

# Or just clean up for a new topic
./scripts/cleanup_for_new_topic.sh
```

## Project Structure

```
Apollo/
├── CLAUDE.md                    # Master instructions (Claude reads this first)
├── .claude/
│   ├── settings.json            # Tool permissions for Claude Code
│   └── skills/                  # Specialised Claude Code skills
│       ├── thesis-writer/       #   Academic medical writing
│       ├── biostatistics/       #   Statistical analysis + R figures
│       └── latex-thesis/        #   LaTeX compilation + debugging
├── templates/                   # Master templates (NEVER modified)
│   ├── main.tex                 #   Topic-agnostic thesis template
│   ├── sskm-thesis.cls          #   WBUHS document class
│   ├── ssuhs-thesis.cls         #   SSUHS document class
│   ├── vancouver.bst            #   Vancouver citation style
│   ├── template-references.bib  #   Starter bibliography
│   └── logo/                    #   University & institute logos
├── guides/                      # Reference documentation
│   ├── GOLD_Standard_Phased_Plan.md  # 12-phase writing plan
│   ├── lessons_learned.md       #   Critical fixes & patterns
│   └── ...
├── input/                       # YOUR topic-specific files
│   ├── synopsis.txt             #   Research synopsis (REQUIRED)
│   ├── dataset.csv              #   Research data (optional)
│   └── synopsis_EXAMPLE.txt     #   Example for reference
├── output/                      # Generated outputs (gitignored)
│   ├── thesis/                  #   Compiled thesis + working files
│   ├── figures/                 #   R-generated figures
│   ├── stats/                   #   Statistical analysis outputs
│   └── packages/                #   Deliverable zip packages
└── scripts/
    ├── full_pipeline.sh         #   End-to-end automation
    ├── cleanup_for_new_topic.sh #   Reset for new thesis topic
    └── analysis.R               #   Statistical analysis template
```

## The 12-Phase Pipeline

| Phase | Name | What Happens |
|-------|------|-------------|
| 0 | Orientation | Read synopsis, gather metadata, verify clean workspace |
| 1 | Front Matter | Title page, certificates, declarations, TOC |
| 2 | Introduction | Disease burden, rationale, research question |
| 3 | Aims & Objectives | Primary/secondary objectives from synopsis |
| 4 | Review of Literature | Comprehensive review + open-access figures + summary table |
| 5 | Materials & Methods | Follows synopsis exactly, ethics statement |
| 6a | Dataset | Import or generate synthetic data |
| 6b | Results | R statistical analysis, tables, figures |
| 7 | Discussion | Compare findings with published literature |
| 8 | Conclusion | Data-driven conclusions, recommendations |
| 9 | References | Vancouver style, bidirectional citation integrity |
| 10 | Appendices | Consent forms, proforma, master chart |
| 11 | Final QC | Compilation, error fixes, visual verification |
| 12 | QA Evaluation | Adjudicator-style review, data verification |

Each phase has a **gate** — Phase N+1 cannot start until Phase N passes all quality checks.

## Starting a New Topic

```bash
# 1. Clean all previous output
./scripts/cleanup_for_new_topic.sh --force

# 2. Add your files
cp your_synopsis.txt input/synopsis.txt
cp your_data.csv input/dataset.csv  # optional

# 3. Start Claude and run the pipeline
claude
```

See `guides/lessons_learned.md` Section 10 for the full guide.

## Adding a New University

1. Copy an existing cls file: `cp templates/sskm-thesis.cls templates/your-university.cls`
2. Modify formatting rules (margins, fonts, page numbers, certificate text, heading styles)
3. Implement the same harmonised API commands (see `CLAUDE.md` for the list)
4. Add your university logo to `templates/logo/`
5. Set `\documentclass{your-university}` in `output/thesis/main.tex`

The pipeline, skills, guides, and scripts all work unchanged with any cls that follows the API.

## Roadmap

Apollo is evolving from a CLI pipeline into a full application:

- [x] **Phase 1: CLI Pipeline** — Claude Code + LaTeX + R (current)
- [ ] **Phase 2: Web Interface** — Upload synopsis, select university, iterate on sections, download PDF
- [ ] **Phase 3: University-Agnostic Engine** — Generic university rules parser, dynamic cls generation
- [ ] **Phase 4: Collaborative Editing** — Multi-user review, guide/examiner feedback integration

## Key Design Decisions

- **LaTeX over Word** — Deterministic formatting, version-controllable, reproducible builds
- **Vancouver/BibTeX** — Standard medical citation style, automated numbering
- **R for statistics** — Reproducible, publication-quality, embedded data scripts
- **Claude Code skills** — Domain-specific expertise (medical writing, biostatistics, LaTeX debugging)
- **12-phase gates** — Quality control at every step, not just at the end

## License

MIT License. See [LICENSE](LICENSE) for details.

---

Built with [Claude Code](https://claude.ai/claude-code)
