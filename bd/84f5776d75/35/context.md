# Session Context

## User Prompts

### Prompt 1

Implement the following plan:

# Fix Setup Flow: S1 → S5 → P0

## Context

The setup wizard (S1–S5) has critical data flow gaps that break the entire thesis pipeline. When a user uploads a PDF synopsis:

1. **No text extraction** — PDF is uploaded to R2 but no text is extracted. User sees "Text extraction will be available in a future update"
2. **Empty synopsis allowed** — S2 saves `synopsis_text: ""` (empty string) with no validation
3. **S3 shows dead end** — "No synopsis text ava...

### Prompt 2

now psuh to remote and watch the CI. when CI is green give the commands to run on the VPS

### Prompt 3

I cannot delete the sandbox project already created, nor can i strt a new one (capped at one sandbox project?)

