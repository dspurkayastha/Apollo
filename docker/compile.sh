#!/bin/sh
set -e

# LaTeX compilation script
# Usage: compile.sh [--watermark]
#
# Expects:
#   - .tex, .cls, .bst files in /thesis (or copied to /tmp)
#   - Output: /thesis/output/main.pdf

WATERMARK=false
TIMEOUT=120
OUTPUT_DIR="/thesis/output"

for arg in "$@"; do
  case $arg in
    --watermark) WATERMARK=true ;;
  esac
done

mkdir -p "$OUTPUT_DIR"

# Copy source files to /tmp for read-only filesystem compatibility
cp /thesis/*.tex /thesis/*.cls /thesis/*.bst /tmp/ 2>/dev/null || true
cp -r /thesis/logo /tmp/logo 2>/dev/null || true

# Create empty .bib if not present (for compilation without references)
if [ ! -f /tmp/references.bib ]; then
  touch /tmp/references.bib
fi

cd /tmp

echo "=== Pass 1: pdflatex ==="
timeout "$TIMEOUT" pdflatex -interaction=nonstopmode main.tex || true

echo "=== Pass 2: bibtex ==="
timeout "$TIMEOUT" bibtex main || true

echo "=== Pass 3: pdflatex ==="
timeout "$TIMEOUT" pdflatex -interaction=nonstopmode main.tex || true

echo "=== Pass 4: pdflatex ==="
timeout "$TIMEOUT" pdflatex -interaction=nonstopmode main.tex || true

# Check if PDF was generated
if [ ! -f /tmp/main.pdf ]; then
  echo "ERROR: PDF generation failed"
  # Copy log for debugging
  cp /tmp/main.log "$OUTPUT_DIR/main.log" 2>/dev/null || true
  exit 1
fi

# Apply watermark for sandbox projects
if [ "$WATERMARK" = true ] && [ -f /usr/local/bin/watermark.sh ]; then
  echo "=== Applying watermark ==="
  /usr/local/bin/watermark.sh /tmp/main.pdf /tmp/main-watermarked.pdf
  cp /tmp/main-watermarked.pdf "$OUTPUT_DIR/main.pdf"
else
  cp /tmp/main.pdf "$OUTPUT_DIR/main.pdf"
fi

# Copy log file
cp /tmp/main.log "$OUTPUT_DIR/main.log" 2>/dev/null || true

echo "=== Compilation complete ==="
