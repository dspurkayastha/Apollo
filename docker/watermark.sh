#!/bin/sh
set -e

# Ghostscript watermark overlay for sandbox thesis PDFs
# Usage: watermark.sh <input.pdf> <output.pdf>

INPUT="$1"
OUTPUT="$2"

if [ -z "$INPUT" ] || [ -z "$OUTPUT" ]; then
  echo "Usage: watermark.sh <input.pdf> <output.pdf>"
  exit 1
fi

# Create PostScript watermark stamp — elegant centred "Apollo" branding
STAMP="/tmp/watermark-stamp.ps"
cat > "$STAMP" << 'WATERMARK_PS'
<<
  /EndPage {
    2 eq { pop false } {
      gsave
      0.92 setgray
      /Palatino-Italic findfont 120 scalefont setfont
      306 396 translate
      (Apollo) dup stringwidth pop 2 div neg 0 moveto show
      grestore
      true
    } ifelse
  } bind
>> setpagedevice
WATERMARK_PS

gs \
  -q \
  -dNOPAUSE \
  -dBATCH \
  -sDEVICE=pdfwrite \
  -sOutputFile="$OUTPUT" \
  "$STAMP" \
  "$INPUT"

rm -f "$STAMP"

echo "Watermark applied: $OUTPUT"
