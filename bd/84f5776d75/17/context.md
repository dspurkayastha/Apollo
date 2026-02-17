# Session Context

## User Prompts

### Prompt 1

Implement the following plan:

# Thesis Completion UI

## Context

After Phase 11 (Final QC) approval, `project.status` is set to `"completed"` and `current_phase` advances to 12. The workspace then refreshes via `router.refresh()`, but currently shows nothing special — the student sees Phase 11 content as approved with no celebration, no clear download path, and no disclaimers. The user wants a warm, zen completion view matching the existing aesthetic.

## Changes

### 1. NEW: `apps/web/compo...

### Prompt 2

i think the final qc never really completes

### Prompt 3

## Error Type
Runtime Error

## Error Message
Rendered fewer hooks than expected. This may be caused by an accidental early return statement.


    at ProjectDetailPage (app/(dashboard)/projects/[id]/page.tsx:179:7)

## Code Frame
  177 |
  178 |       {/* Phase Navigation + Section Viewer */}
> 179 |       <ProjectWorkspace
      |       ^
  180 |         project={project}
  181 |         sections={sections}
  182 |         citations={citations}

Next.js version: 15.5.12 (Turbopack)

