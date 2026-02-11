# Input Directory

Place your topic-specific files here:

1. `synopsis.txt` — **REQUIRED** — Your approved research synopsis
2. `dataset.csv` — **OPTIONAL** — Your research data (if not, synthetic data is generated)
3. `literature_review.md` — **OPTIONAL** — Pre-gathered literature review notes

## Example Files
- `synopsis_EXAMPLE.txt` — Example synopsis from the Post-ERCP study (format reference only)

## University Format
The thesis template supports two university formats:
- **SSKM/WBUHS** — `\documentclass{sskm-thesis}` (default)
- **SSUHS** — `\documentclass{ssuhs-thesis}`

Select your format when running `scripts/full_pipeline.sh` or manually edit the `\documentclass` line in `main.tex`.
