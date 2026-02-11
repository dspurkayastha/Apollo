#!/bin/bash
# full_pipeline.sh — End-to-end Medical Thesis Generation with Claude Code
#
# USAGE:
#   1. Place your synopsis.txt and dataset.csv in input/
#   2. Ensure Claude Code is installed: npm install -g @anthropic-ai/claude-code
#   3. Ensure R, TeX Live, and Python are installed
#   4. Run: bash scripts/full_pipeline.sh
#
# NOTE: This script uses Claude Code's --print flag for non-interactive execution.
# For interactive (recommended for first run), just run `claude` in the project root
# and follow the prompts in CLAUDE.md.
#
# IMPORTANT: Review each phase's output before proceeding in production.
# This script is a reference for the sequential workflow.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "================================================================"
echo "  MEDICAL THESIS GENERATION PIPELINE"
echo "  Started: $(date)"
echo "  Project: $(pwd)"
echo "================================================================"

# Pre-flight checks
echo ""
echo "--- Pre-flight Checks ---"

check_cmd() {
    if command -v "$1" &> /dev/null; then
        echo "  ✓ $1 found: $(command -v "$1")"
    else
        echo "  ✗ $1 NOT FOUND — please install before proceeding"
        exit 1
    fi
}

check_cmd claude
check_cmd pdflatex
check_cmd bibtex
check_cmd latexmk
check_cmd Rscript
check_cmd python3

# Check input files
if [ ! -f "input/synopsis.txt" ]; then
    echo "  ✗ input/synopsis.txt NOT FOUND — please add your synopsis"
    exit 1
fi
echo "  ✓ Synopsis found: input/synopsis.txt"

if [ -f "input/dataset.csv" ]; then
    echo "  ✓ Dataset found: input/dataset.csv"
else
    echo "  ⚠ No dataset.csv found — synthetic data will be generated in Phase 6a"
fi

# University Selection
echo ""
echo "--- University Selection ---"
echo "  [1] SSKM / IPGMER — West Bengal University of Health Sciences (WBUHS)"
echo "  [2] SSUHS — Srimanta Sankaradeva University of Health Sciences"
echo ""
read -p "Select university format [1/2]: " UNIV_CHOICE

case "$UNIV_CHOICE" in
    1)
        CLS_FILE="sskm-thesis.cls"
        LOGO_FILE="wbuhs-logo.pdf"
        echo "  ✓ Selected: SSKM/WBUHS format"
        ;;
    2)
        CLS_FILE="ssuhs-thesis.cls"
        LOGO_FILE="ssuhs-logo.png"
        echo "  ✓ Selected: SSUHS format"
        ;;
    *)
        echo "  ✗ Invalid selection. Defaulting to SSKM/WBUHS."
        CLS_FILE="sskm-thesis.cls"
        LOGO_FILE="wbuhs-logo.pdf"
        ;;
esac

# Set up working directory with selected templates
echo ""
echo "--- Setting up working directory ---"
mkdir -p output/thesis/logo
cp templates/main.tex output/thesis/main.tex
cp "templates/$CLS_FILE" output/thesis/
cp templates/vancouver.bst output/thesis/
cp templates/template-references.bib output/thesis/references.bib
cp templates/logo/* output/thesis/logo/ 2>/dev/null || true

# Update documentclass in main.tex to match selection
CLS_NAME="${CLS_FILE%.cls}"
if [ "$CLS_NAME" = "ssuhs-thesis" ]; then
    # Uncomment ssuhs, comment sskm
    sed -i.bak 's/^\\documentclass{sskm-thesis}/%\\documentclass{sskm-thesis}/' output/thesis/main.tex
    sed -i.bak 's/^%\\documentclass{ssuhs-thesis}/\\documentclass{ssuhs-thesis}/' output/thesis/main.tex
    # Set appropriate logo
    sed -i.bak 's/%\\universitylogo{logo\/ssuhs-logo.png}/\\universitylogo{logo\/ssuhs-logo.png}/' output/thesis/main.tex
    rm -f output/thesis/main.tex.bak
else
    # Set appropriate logo
    sed -i.bak 's/%\\universitylogo{logo\/wbuhs-logo.pdf}/\\universitylogo{logo\/wbuhs-logo.pdf}/' output/thesis/main.tex
    rm -f output/thesis/main.tex.bak
fi
echo "  ✓ Templates copied with $CLS_NAME class"
echo "  ✓ Logos copied to output/thesis/logo/"

echo ""
echo "================================================================"
echo "  PIPELINE READY"
echo ""
echo "  To run interactively (RECOMMENDED for first use):"
echo "    cd $PROJECT_ROOT"
echo "    claude"
echo "    Then paste the first prompt from guides/lessons_learned.md Section 6"
echo ""
echo "  To run automated phases (advanced):"
echo "    Uncomment the phase blocks below and re-run this script"
echo "================================================================"

# ========================================================================
# AUTOMATED PHASE EXECUTION (uncomment phases as needed)
# ========================================================================
#
# WARNING: Running all phases automatically without review is NOT recommended
# for your first thesis. Use interactive mode to review each phase.
#
# Each phase below can be run independently. Claude Code maintains context
# within a session but NOT across sessions, so each phase includes full
# context loading.

# --- Phase 0-1: Orientation + Front Matter ---
# claude --print "Read CLAUDE.md. Read guides/GOLD_Standard_Phased_Plan.md completely. Read input/synopsis.txt. Read guides/lessons_learned.md. Read the selected .cls file from output/thesis/. Execute Phase 0 (Orientation) — verify all files are present and understood. Then execute Phase 1 (Front Matter) — generate all certificate, declaration, acknowledgement, and contents pages in output/thesis/main.tex."

# --- Phase 2: Introduction ---
# claude --print "Read CLAUDE.md and guides/GOLD_Standard_Phased_Plan.md Phase 2 instructions. Read the selected .cls file from output/thesis/. Write the Introduction chapter (~1500 words) with comprehensive citations. Search the web for current references. Add all BibTeX entries to output/thesis/references.bib. Write LaTeX to the Introduction section of output/thesis/main.tex."

# --- Phase 3: Aims and Objectives ---
# claude --print "Read CLAUDE.md and guides/GOLD_Standard_Phased_Plan.md Phase 3. Read input/synopsis.txt for the exact aims and objectives. Write the Aims and Objectives chapter in output/thesis/main.tex."

# --- Phase 4: Review of Literature ---
# claude --print "Read CLAUDE.md and guides/GOLD_Standard_Phased_Plan.md Phase 4. Read the selected .cls file from output/thesis/. Write comprehensive Review of Literature with current citations (search web). Include chronological longtable of all cited works at the end. Update references.bib with all new entries."

# --- Phase 5: Materials and Methods ---
# claude --print "Read CLAUDE.md and guides/GOLD_Standard_Phased_Plan.md Phase 5. Read input/synopsis.txt — follow it EXACTLY for study design, inclusion/exclusion criteria, methodology, and statistical plan. Cite all methods, software, scoring systems, and classification tools. Write to output/thesis/main.tex."

# --- Phase 6a: Dataset ---
# claude --print "Read CLAUDE.md and guides/GOLD_Standard_Phased_Plan.md Phase 6a. If input/dataset.csv exists, import and validate it. If not, generate a synthetic dataset matching the synopsis study parameters with clinically realistic distributions for an Indian hospital cohort. Create comprehensive data dictionary. Save to output/stats/"

# --- Phase 6b: Statistical Analysis + Results ---
# claude --print "Read CLAUDE.md and guides/GOLD_Standard_Phased_Plan.md Phase 6b. Perform complete statistical analysis using R. Generate all publication-quality figures as PDF to output/figures/. Write Results chapter in output/thesis/main.tex. Save all R scripts with EMBEDDED data to scripts/. Report all tests rigorously per biostatistics best practices."

# --- Phase 7: Discussion ---
# claude --print "Read CLAUDE.md and guides/GOLD_Standard_Phased_Plan.md Phase 7. Write Discussion chapter comparing findings with published literature. Search web for comparison studies. Use scientific vocabulary (not 'Objective 1, 2, 3'). Cite all comparisons. Write to output/thesis/main.tex."

# --- Phase 8: Conclusion ---
# claude --print "Read CLAUDE.md and guides/GOLD_Standard_Phased_Plan.md Phase 8. Write concise Conclusion chapter mapped to study objectives. Write to output/thesis/main.tex."

# --- Phase 9: References ---
# claude --print "Read CLAUDE.md and guides/GOLD_Standard_Phased_Plan.md Phase 9. Verify bidirectional citation integrity — all \cite{} keys have bib entries, all bib entries are cited. Ensure serialised Vancouver numbering. Fix any orphaned entries. Save final references.bib."

# --- Phase 10: Appendices ---
# claude --print "Read CLAUDE.md and guides/GOLD_Standard_Phased_Plan.md Phase 10. Create appendices: patient information sheet, informed consent form, proforma/data collection sheet, master chart, abbreviations list. Write to output/thesis/main.tex."

# --- Phase 11: Final QC + Compilation ---
# claude --print "Read CLAUDE.md and guides/GOLD_Standard_Phased_Plan.md Phase 11 and guides/lessons_learned.md. Run ALL quality control checks. Fix any compilation errors using the known issues guide. Compile final thesis with latexmk. Verify output PDF. Package all deliverables (thesis PDF, R scripts, dataset, statistical report) into output/packages/."

echo ""
echo "Pipeline script complete at $(date)"
