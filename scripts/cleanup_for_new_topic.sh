#!/bin/bash
# cleanup_for_new_topic.sh — Prepare the pipeline for a new thesis topic
#
# This script clears ALL previous thesis output and copies fresh templates.
# Run this BEFORE starting Phase 0 with a new synopsis.
#
# Usage:
#   ./scripts/cleanup_for_new_topic.sh          # interactive (prompts for confirmation)
#   ./scripts/cleanup_for_new_topic.sh --force   # non-interactive (for automation / Claude)

set -euo pipefail

# Resolve project root (parent of scripts/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TEMPLATES_DIR="$PROJECT_ROOT/templates"
OUTPUT_THESIS="$PROJECT_ROOT/output/thesis"
OUTPUT_FIGURES="$PROJECT_ROOT/output/figures"
OUTPUT_STATS="$PROJECT_ROOT/output/stats"
INPUT_DIR="$PROJECT_ROOT/input"

# Colours for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Colour

echo "============================================"
echo "  Thesis Pipeline: New Topic Cleanup"
echo "============================================"
echo ""

# --- Safety check: templates must exist ---
if [ ! -d "$TEMPLATES_DIR" ]; then
    echo -e "${RED}ERROR: templates/ directory not found at $TEMPLATES_DIR${NC}"
    echo "Cannot proceed without templates to copy."
    exit 1
fi

# --- Show what will be cleaned ---
echo -e "${YELLOW}The following will be DELETED:${NC}"
echo ""

if [ -d "$OUTPUT_THESIS" ]; then
    THESIS_FILES=$(find "$OUTPUT_THESIS" -type f ! -name '.gitkeep' 2>/dev/null | wc -l | tr -d ' ')
    echo "  output/thesis/  : $THESIS_FILES files (tex, bib, pdf, aux, figures, data, etc.)"
else
    echo "  output/thesis/  : (does not exist — will be created)"
fi

if [ -d "$OUTPUT_FIGURES" ]; then
    FIG_FILES=$(find "$OUTPUT_FIGURES" -type f ! -name '.gitkeep' 2>/dev/null | wc -l | tr -d ' ')
    echo "  output/figures/ : $FIG_FILES files (R-generated figures)"
else
    echo "  output/figures/ : (does not exist — will be created)"
fi

if [ -d "$OUTPUT_STATS" ]; then
    STAT_FILES=$(find "$OUTPUT_STATS" -type f ! -name '.gitkeep' 2>/dev/null | wc -l | tr -d ' ')
    echo "  output/stats/   : $STAT_FILES files (statistical outputs)"
else
    echo "  output/stats/   : (does not exist — will be created)"
fi

echo ""
echo -e "${GREEN}Fresh templates will be copied from templates/ to output/thesis/${NC}"
echo ""

# --- Confirmation ---
FORCE=false
if [ "${1:-}" = "--force" ] || [ "${1:-}" = "-f" ]; then
    FORCE=true
fi

if [ "$FORCE" = false ]; then
    echo -e "${RED}WARNING: This will permanently delete all previous thesis output.${NC}"
    echo -n "Type 'yes' to proceed: "
    read -r CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "Aborted."
        exit 0
    fi
fi

echo ""
echo "--- Cleaning output/thesis/ ---"

# Create directories if they don't exist
mkdir -p "$OUTPUT_THESIS"
mkdir -p "$OUTPUT_FIGURES"
mkdir -p "$OUTPUT_STATS"

# Remove all files in output/thesis/ (preserve directory structure)
# Remove the figures subfolder entirely (topic-specific images)
if [ -d "$OUTPUT_THESIS/figures" ]; then
    rm -rf "$OUTPUT_THESIS/figures"
    echo "  Removed output/thesis/figures/ (topic-specific images)"
fi

# Enable nullglob so unmatched globs expand to nothing
shopt -s nullglob

# Remove all thesis content files
REMOVED=0
for ext in tex bib bbl blg aux log lof lot toc out nlo fls fdb_latexmk pdf csv synctex.gz cls bst; do
    for f in "$OUTPUT_THESIS"/*."$ext"; do
        if [ -f "$f" ]; then
            rm "$f"
            REMOVED=$((REMOVED + 1))
        fi
    done
done

shopt -u nullglob

echo "  Removed $REMOVED files from output/thesis/"

echo ""
echo "--- Cleaning output/figures/ ---"
FIG_REMOVED=0
for f in "$OUTPUT_FIGURES"/*; do
    if [ -f "$f" ] && [ "$(basename "$f")" != ".gitkeep" ]; then
        rm "$f"
        FIG_REMOVED=$((FIG_REMOVED + 1))
    fi
done
echo "  Removed $FIG_REMOVED files from output/figures/"

echo ""
echo "--- Cleaning output/stats/ ---"
STAT_REMOVED=0
for f in "$OUTPUT_STATS"/*; do
    if [ -f "$f" ] && [ "$(basename "$f")" != ".gitkeep" ]; then
        rm "$f"
        STAT_REMOVED=$((STAT_REMOVED + 1))
    fi
done
echo "  Removed $STAT_REMOVED files from output/stats/"

echo ""
echo "--- Copying fresh templates ---"

# Copy all template files
cp "$TEMPLATES_DIR"/main.tex "$OUTPUT_THESIS/"
echo "  Copied main.tex (topic-agnostic template)"

cp "$TEMPLATES_DIR"/sskm-thesis.cls "$OUTPUT_THESIS/"
echo "  Copied sskm-thesis.cls"

if [ -f "$TEMPLATES_DIR/ssuhs-thesis.cls" ]; then
    cp "$TEMPLATES_DIR"/ssuhs-thesis.cls "$OUTPUT_THESIS/"
    echo "  Copied ssuhs-thesis.cls"
fi

cp "$TEMPLATES_DIR"/vancouver.bst "$OUTPUT_THESIS/"
echo "  Copied vancouver.bst"

cp "$TEMPLATES_DIR"/template-references.bib "$OUTPUT_THESIS/references.bib"
echo "  Copied template-references.bib → references.bib"

# Copy logos
if [ -d "$TEMPLATES_DIR/logo" ]; then
    mkdir -p "$OUTPUT_THESIS/logo"
    cp "$TEMPLATES_DIR"/logo/* "$OUTPUT_THESIS/logo/" 2>/dev/null || true
    LOGO_COUNT=$(ls "$OUTPUT_THESIS/logo/" 2>/dev/null | wc -l | tr -d ' ')
    echo "  Copied $LOGO_COUNT logo files to output/thesis/logo/"
fi

# Create empty figures directory for new topic
mkdir -p "$OUTPUT_THESIS/figures"
echo "  Created empty output/thesis/figures/ directory"

# Ensure .gitkeep files exist
touch "$OUTPUT_FIGURES/.gitkeep"
touch "$OUTPUT_STATS/.gitkeep"

echo ""
echo "============================================"
echo -e "${GREEN}  Cleanup complete!${NC}"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Place your new synopsis at:  input/synopsis.txt"
echo "  2. Place your dataset at:       input/dataset.csv"
echo "  3. (Optional) Add literature:   input/literature_review.md"
echo "  4. Start Claude and run Phase 0"
echo ""

# Verify input files exist
if [ -f "$INPUT_DIR/synopsis.txt" ]; then
    echo -e "  ${GREEN}✓${NC} input/synopsis.txt exists"
else
    echo -e "  ${YELLOW}⚠${NC} input/synopsis.txt not found — add your new synopsis before starting"
fi

if [ -f "$INPUT_DIR/dataset.csv" ]; then
    echo -e "  ${GREEN}✓${NC} input/dataset.csv exists"
else
    echo -e "  ${YELLOW}⚠${NC} input/dataset.csv not found — add data before Phase 6, or Claude will generate synthetic data"
fi

echo ""
