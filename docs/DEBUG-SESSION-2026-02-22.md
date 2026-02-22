# Debugging Session: 22 February 2026

**Scope**: Login → Dashboard → Project Workspace → Phases 1–3 end-to-end
**Status**: Phases 1–3 debugged and stable. Phases 4–12 remain.
**Commits**: `b3b891a` through `b227fc4` (11 commits, ~3,600 lines changed)

---

## Table of Contents

1. [Pipeline QA Checkpoints & Approve Error Surfacing](#1-pipeline-qa-checkpoints--approve-error-surfacing)
2. [Missing fix-latex API Route (Production 404)](#2-missing-fix-latex-api-route-production-404)
3. [Sentry Error Monitoring Wiring](#3-sentry-error-monitoring-wiring)
4. [fix-latex Rewrite: Targeted Line-Number-Based Fixing](#4-fix-latex-rewrite-targeted-line-number-based-fixing)
5. [Inngest DB Call Optimisation](#5-inngest-db-call-optimisation)
6. [Generation Completion Polling Fallback](#6-generation-completion-polling-fallback)
7. [PDF Watermark: Docker GhostScript Pipeline](#7-pdf-watermark-docker-ghostscript-pipeline)
8. [Onboarding Tour Redesign ("The Lens")](#8-onboarding-tour-redesign-the-lens)
9. [Double Watermark Fix](#9-double-watermark-fix)
10. [Remaining Work (Phases 4–12)](#10-remaining-work-phases-412)

---

## 1. Pipeline QA Checkpoints & Approve Error Surfacing

**Commit**: `b3b891a`
**Files**: 11 files, +2,072 / -71 lines

### Problem

- The approve route silently swallowed 400 errors — user got no feedback when approval failed
- No quality gates between phases — low-quality content could progress unchecked
- BibTeX completion was using expensive Opus model instead of Haiku
- Phase 9 reference verification had no live progress indicator

### Root Causes

- Approve route's `fetch()` response wasn't checked for non-2xx status; errors were caught and logged server-side only
- No QA checkpoint infrastructure existed — `approve/route.ts` was a simple status toggle
- `bibtex-completion.ts` inherited the default model (Opus) from the AI client config
- Phase 9 verification was fire-and-forget with no SSE streaming

### Changes

| File | Change |
|------|--------|
| `lib/qc/checkpoint-rol.ts` | New: Phase 4 (Review of Literature) QA gate — checks citation density, section structure, word counts |
| `lib/qc/checkpoint-results.ts` | New: Phase 6 (Results) QA gate — validates table/figure counts, statistical reporting |
| `lib/qc/checkpoint-conclusions.ts` | New: Phase 8 (Conclusions) QA gate — checks conclusion structure, recommendation presence |
| `lib/qc/checkpoint-references.ts` | New: Phase 9 (References) QA gate — validates citation tiers, DOI resolution rates |
| `lib/qc/checkpoint-utils.ts` | New: Shared QC utilities — threshold configs, report formatting, common validators |
| `sections/[phase]/approve/route.ts` | Rewrote: runs phase-specific QA checkpoint before approval; returns structured `QA_BLOCKED` errors with full `QCReport` |
| `sections/9/verify-references/route.ts` | New: SSE endpoint for live reference verification with DB persistence of tier upgrades |
| `project-workspace.tsx` | Added: QA failure dialog with per-issue "Fix with AI" buttons; Phase 9 live verification overlay with progress bar; double-click guard |
| `lib/ai/bibtex-completion.ts` | Hardcoded Haiku model for BibTeX completion |
| `lib/inngest/functions/ai-generate.ts` | Removed redundant import |

### Bugs Fixed

- **Approve 400 errors silently swallowed**: Client now parses error response JSON and shows structured QA failure dialog
- **Double-click during Phase 9 SSE**: Added `verifying` state guard that disables the verify button during stream
- **Progress counter overflow**: Reference verification counter clamped to total reference count
- **Redundant DB queries in Results checkpoint**: Consolidated into single query with join

---

## 2. Missing fix-latex API Route (Production 404)

**Commit**: `49dc6bd`
**Files**: 1 file, +191 lines

### Problem

The "Fix with AI" button in the workspace returned a 404 in production. The fix-latex API route file existed locally but was never committed (untracked in git).

### Root Cause

The file `apps/web/app/api/projects/[id]/sections/[phase]/fix-latex/route.ts` was created during an earlier development session but was in `.gitignore` or simply never staged. Production deploy had no route handler at that path.

### Fix

Added the missing route file to git. The route accepts POST with `{ errors: string[] }`, sends the LaTeX source + error context to Haiku for targeted fixes, and returns the corrected content.

---

## 3. Sentry Error Monitoring Wiring

**Commit**: `2b787e5`, `187e8c0`
**Files**: 7 files, +96 lines

### Problem

Sentry was installed as a dependency but not wired into the Next.js 15 App Router instrumentation hooks. Runtime errors went untracked.

### Changes

| File | Change |
|------|--------|
| `instrumentation.ts` | New: Server-side Sentry init via `register()` hook |
| `instrumentation-client.ts` | Renamed from `sentry.client.config.ts`; added `onRouterTransitionStart` export (Next.js 15 requirement) |
| `app/global-error.tsx` | New: Root error boundary that reports to Sentry and renders fallback UI |
| `components/error-boundary.tsx` | New: Reusable error boundary wrapper component |
| `lib/api/errors.ts` | Added Sentry `captureException()` calls to the API error handler |
| `next.config.ts` | Enabled Sentry webpack plugin integration |
| `lib/env.ts` | Removed unused env validation that conflicted with Sentry DSN |

### Note

The second commit (`187e8c0`) added the `onRouterTransitionStart` export that Next.js 15 requires from `instrumentation-client.ts` — without it, client-side navigation threw a missing export warning.

---

## 4. fix-latex Rewrite: Targeted Line-Number-Based Fixing

**Commit**: `10fd412`
**Files**: 9 files, +870 / -38 lines

### Problem

The original fix-latex approach sent the **entire chapter** (~5,000 lines) to Haiku for a full rewrite. This was:
- **Slow**: 15–30 seconds per fix attempt
- **Expensive**: ~4K input tokens per call
- **Destructive**: Haiku often rewrote correct sections, introducing new errors
- **Unreliable**: AI would strip valid LaTeX commands it didn't recognise

### Root Cause

The fix-latex route had no error parsing — it passed raw compilation logs as a string prompt with the full document, asking the AI to "fix all errors".

### New Architecture

```
Compilation Log → Structured Error Parser → Context Window Extraction
    → Surgical Prompt (line N ±5 context) → AI Fix (4096 max tokens)
    → Line-by-Line Replacement → Return Patched Source
```

### Changes

| File | Change |
|------|--------|
| `lib/latex/parse-log.ts` | Enhanced: `structuredErrors` extraction with file stack tracking, `l.NNN` line number parsing, error-to-file attribution |
| `lib/latex/parse-log.test.ts` | New: 114-line test suite for structured error parsing |
| `lib/latex/fix-latex-helpers.ts` | New: `extractErrorContext()` (±5 line windows), `buildFixPrompt()` (surgical prompt), `parseFixResponse()` (extract replacements), `applyLineFixes()` (safe line replacement) |
| `lib/latex/fix-latex-helpers.test.ts` | New: 226-line test suite for all helper functions |
| `sections/[phase]/fix-latex/route.ts` | Rewrote: DB log fetch → parse structured errors → extract snippets → AI call (4096 tokens) → apply line fixes → return patched content |
| `lib/latex/assemble.ts` | Exported `PHASE_CHAPTER_MAP` for chapter-to-file resolution |
| `lib/latex/compile.ts` | Minor: persist raw log to DB for fix-latex consumption |
| `lib/ai/sanitise-latex.ts` | Added: strip AI preamble text ("Here is the fixed LaTeX:") from responses |
| `project-workspace.tsx` | Removed auto-recompile after fix (let user review changes first) |

### Key Design Decisions

- **±5 line context window**: Enough for AI to understand surrounding structure without sending the full document
- **4096 max tokens**: Caps AI output to prevent runaway rewrites
- **Fallback to full-document**: For non-chapter phases or when log parsing returns 0 structured errors
- **No auto-recompile**: User reviews the AI's changes in the editor before re-compiling

---

## 5. Inngest DB Call Optimisation

**Commit**: `e0082ca`
**Files**: 2 files, +23 / -18 lines

### Problem

AI generation via Inngest was slow due to synchronous DB writes during LLM streaming. Each streamed chunk triggered a blocking `PATCH` to Supabase (Helsinki), adding ~600ms round-trip latency per write from the Mumbai VPS.

### Root Cause

- `ai-generate.ts` awaited each `supabase.from('sections').update()` call inside the stream handler
- `thesis-workflow.ts` used a SELECT + INSERT pattern (2 round-trips) instead of a single upsert

### Changes

| File | Change |
|------|--------|
| `lib/inngest/functions/ai-generate.ts` | Stream writes are now **fire-and-forget**: DB PATCHes run asynchronously while the LLM stream runs at full speed. Pending writes are drained via `Promise.allSettled` before the Inngest step returns. Flush interval lowered to 150 chars for smoother UX. |
| `lib/inngest/functions/thesis-workflow.ts` | Replaced SELECT + INSERT with single `upsert` (Supabase `ON CONFLICT DO NOTHING`), saving one 600ms round-trip per approval. |

### Safety

- All 5 Inngest step IDs preserved — no in-flight run breakage during deploy
- `Promise.allSettled` ensures no silent write failures; errors are logged but don't crash the step

---

## 6. Generation Completion Polling Fallback

**Commit**: `7fbedab`
**Files**: 1 file, +14 lines

### Problem

After Inngest completes AI generation, the editor would get stuck showing "Generating..." indefinitely. The user had to manually refresh the page to see the generated content.

### Root Cause

Supabase Realtime on the free tier misses `UPDATE` events due to:
- Geographic latency (Helsinki DB → Mumbai client)
- Subscription race conditions (client subscribes after the event fires)
- RLS delivery issues (row-level security can silently drop Realtime messages)

The workspace relied solely on Realtime subscription to detect `status: "generating"` → `status: "generated"` transitions.

### Fix

Added a **5-second polling interval** in `project-workspace.tsx` that calls `router.refresh()` while the section status is `"generating"`. The interval stops automatically when status changes to any other value. This is a belt-and-suspenders approach — Realtime still works when it works, but polling catches the misses.

---

## 7. PDF Watermark: Docker GhostScript Pipeline

**Commits**: `efb0178`, `581fb8c`
**Files**: 5 files, +25 / -14 lines

### Problem

Sandbox project PDFs needed a visible "Apollo" watermark. The original LaTeX `draftwatermark` approach produced inconsistent results across different CLS files and couldn't use custom fonts.

### Architecture Change

Moved watermark application from LaTeX compile-time to **post-compile GhostScript processing**:

```
pdflatex → clean PDF → ghostscript (watermark.sh) → watermarked PDF
```

### Changes

| File | Change |
|------|--------|
| `docker/watermark.sh` | New script: PostScript stamp using Palatino-Italic 180pt, 45° rotation, 85% grey, centred on page |
| `docker/compile.sh` | Added `--watermark` flag parsing; runs `watermark.sh` post-compile (non-fatal — serves unwatermarked if GS fails) |
| `docker/Dockerfile.latex` | Added `ghostscript` package install; COPY `watermark.sh` into image |
| `lib/latex/compile.ts` | Docker path: skip LaTeX `draftwatermark` injection for sandbox (GS handles it); pass `--watermark` flag to Docker args |
| `pdf-viewer.tsx` | Updated CSS overlay: `text-8xl` → `text-9xl` (later removed — see commit 9) |

### GhostScript Watermark Spec

```postscript
/Palatino-Italic findfont 180 scalefont setfont
306 396 translate    % page centre (US Letter)
45 rotate            % diagonal
0.85 setgray         % 85% grey
```

---

## 8. Onboarding Tour Redesign ("The Lens")

**Commit**: `3816a6a`
**Files**: 2 files, +508 / -105 lines

### Problem

The existing `tour-overlay.tsx` was a generic centred-modal slideshow. It defined `data-tour` target selectors but **never used them** — every step rendered as an identical centred card with different text.

### Redesign: Morphing SVG Spotlight

Complete rewrite implementing a cinematic onboarding experience:

#### Core Features
- **SVG mask spotlight**: `feGaussianBlur` feathered-edge cutout that **morphs between `data-tour` targets** via spring physics (`motion.rect`, stiffness 170, damping 26)
- **Breathing sage glow ring**: CSS `@keyframes tour-breathe` — 3s pulsing `box-shadow` at `#8B9D77` (sage green, matching Apollo's design DNA)
- **Glass tooltip card**: `bg-white/85 backdrop-blur-[20px] border-white/40` — positioned smartly near each target
- **3-tier progress dots**: current (`h-2 bg-[#2F2F2F]`), completed (`h-1.5 bg-[#8B9D77]`), future (`h-1.5 bg-[#D1D1D1]`) — matching pipeline timeline hierarchy
- **Aperture open/close**: Entry fades in; exit expands spotlight to full viewport then fades out
- **Keyboard navigation**: ArrowRight/Enter = next, ArrowLeft = back, Escape = dismiss
- **Responsive**: Desktop (≥768px) gets SVG spotlight; mobile (<768px) gets centred glass cards only
- **Resize handling**: `ResizeObserver` on active target + window resize listener → recalculates spotlight position

#### Award Polish (4 upgrades)
1. **Parallax tooltip drift**: `motion.div` wrapper with 2px multi-axis keyframe loop (10s infinite) — card feels suspended in liquid
2. **Audio whoosh**: Web Audio API synthesised 200ms sine sweep (600Hz→200Hz, gain 0.04) on step transitions — no external audio files
3. **Lens flare**: When morph distance > 300px, an inflated (+20%) midpoint spotlight is set first, then the final target 180ms later — creates aperture breathing during long transitions
4. **Interactive targets**: `pointer-events: none` on overlay, `pointer-events: auto` on tooltip; click listener on active `data-tour` element advances the tour

#### Tour Steps (5 steps)

| # | Target | Position | Title |
|---|--------|----------|-------|
| 0 | None (welcome) | Centre | Welcome to Apollo |
| 1 | `[data-tour='pipeline']` | Below | The Pipeline |
| 2 | `[data-tour='compile']` | Below | Generate & Approve |
| 3 | `[data-tour='editor']` | Right | The Editor |
| 4 | None (finish) | Centre | You're Ready |

#### Z-Index Layer Stack

```
z-[102]  Glass Tooltip Card (pointer-events: auto)
z-[101]  Glow Ring (CSS @keyframes tour-breathe)
z-[100]  SVG Mask Overlay (dark scrim + feathered cutout)
         Workspace (data-tour targets, clickable through overlay)
```

### Audit Bugs Found & Fixed (post-implementation)

The implementation was audited and **8 bugs** were found and fixed:

#### Critical (2)

| Bug | Description | Fix |
|-----|-------------|-----|
| **C1: SSR crash** | `centreSpotlight()` accesses `window.innerWidth` directly. `useState(centreSpotlight)` and `useRef(centreSpotlight())` execute during server render where `window` is undefined → `ReferenceError` | Replaced with `DEFAULT_SPOTLIGHT = { x: 0, y: 0, width: 2, height: 2 }` static object; `centreSpotlight()` only called inside `useEffect`/`useCallback` (client-only) |
| **C2: Mobile card not centred** | Card used `transform: translate(-50%, -50%)` for mobile centering, but Framer Motion's `animate={{ y: 0 }}` takes over the `transform` property entirely, replacing it with `translateY(0px)` | Replaced with `marginLeft: -(CARD_WIDTH / 2)` and `marginTop` negative offsets (FM doesn't control margins) |

#### Medium (4)

| Bug | Description | Fix |
|-----|-------------|-----|
| **M1: Stale flare timeout** | `setTimeout(() => setSpotlight(target), 180)` in lens flare was never stored/cleared. Fast clicking could fire stale timeouts | Stored in `flareTimeoutRef`, cleared on every `recalculate()` call + unmount |
| **M2: Stale dismiss timeout** | 500ms `setTimeout` in `handleDismiss` not cleared on unmount → setState on unmounted component | Stored in `dismissTimeoutRef`, cleared on unmount cleanup |
| **M3: Resize triggers flare + audio** | When `isDesktop` changes (resize crosses 768px), `recalculate` gets new reference → effect fires with `flare = true` → plays whoosh sound on window resize | Added `prevIsDesktopRef` — desktop toggle detected and suppresses flare |
| **M4: No-deps effects** | Keyboard and interactive-target `useEffect` calls had no dependency arrays — re-ran on every render, adding/removing listeners each cycle | Wrapped handlers in `useCallback`, stored in stable refs (`handleNextRef` etc.), gave effects proper dependency arrays `[visible, exiting, currentStep]` |

#### Minor (2)

| Bug | Description | Fix |
|-----|-------------|-----|
| **m1: Glow ring positioning** | `position: fixed` div relied on implicit (0,0) without explicit `top`/`left` | Added `top: 0, left: 0` to style |
| **m2: AudioContext per step** | Created and closed a new `AudioContext` on every step transition (Chrome limits to 6 concurrent) | Shared `sharedAudioCtx` module-level singleton, reused across steps with `resume()` for autoplay policy |

### Files Changed

| File | Change |
|------|--------|
| `components/onboarding/tour-overlay.tsx` | Complete rewrite (167 → 564 lines) |
| `app/globals.css` | Added `@keyframes tour-breathe` (5 lines) |

---

## 9. Double Watermark Fix

**Commit**: `b227fc4`
**Files**: 2 files, +8 / -11 lines

### Problem

1. **Rendered PDF (browser preview)**: Showed double watermark
2. **Downloaded PDF**: Showed "old size" watermark (not the intended 180pt)

### Root Cause Analysis

Three overlapping watermark layers existed:

| Layer | Source | Location | Status |
|-------|--------|----------|--------|
| 1. LaTeX `draftwatermark` | `injectWatermarkPackage()` in `compile.ts` | Baked into compiled PDF | Active in `localCompile()` path; already disabled in `dockerCompile()` path |
| 2. GhostScript post-process | `watermark.sh` via `compile.sh` in Docker | Stamped on top of compiled PDF | Active but Docker image not yet rebuilt → still had old 120pt |
| 3. CSS overlay | `pdf-viewer.tsx` | Rendered on top in browser viewer | Active — caused visible "double" with layer 1 or 2 |

**In production** (Docker mode):
- Layer 1: OFF (Docker path already set `watermark: false` at line 112)
- Layer 2: ON but old size (Docker image not rebuilt since `watermark.sh` update)
- Layer 3: ON (CSS overlay)
- **Result**: GhostScript watermark (old size) + CSS overlay = double in preview; GhostScript only in download

**In local dev** (local mode):
- Layer 1: ON (local path passed `options.watermark: true` directly)
- Layer 2: OFF (no Docker/GhostScript in local mode)
- Layer 3: ON (CSS overlay)
- **Result**: LaTeX watermark + CSS overlay = double in preview; LaTeX only in download

### Fix

| File | Change |
|------|--------|
| `components/viewer/pdf-viewer.tsx` | Removed CSS watermark overlay entirely. Kept `isSandbox` prop as deprecated for backwards compatibility (locked parent file passes it). |
| `lib/latex/compile.ts` | Fixed `localCompile()` path to match Docker path: `{ watermark: false, draftFooter: options.draftFooter ?? false }` — GhostScript is the sole sandbox watermark source. |

### Deployment Note

The Docker image must be rebuilt to pick up the updated `watermark.sh` (180pt Palatino-Italic). Until then, sandbox PDFs compiled via Docker will have the old-size GhostScript watermark. Run:

```bash
docker build -f docker/Dockerfile.latex -t apollo-latex .
```

---

## 10. Remaining Work (Phases 4–12)

The following phases have not been debugged end-to-end in this session:

| Phase | Name | Status |
|-------|------|--------|
| 4 | Review of Literature | QA checkpoint added but not E2E tested |
| 5 | Materials & Methods | Not tested |
| 6a | Dataset + Analysis Plan | Not tested |
| 6b | Results | QA checkpoint added but not E2E tested |
| 7 | Discussion | Not tested |
| 8 | Conclusions | QA checkpoint added but not E2E tested |
| 9 | References | SSE verification added but not E2E tested |
| 10 | Appendices | Not tested |
| 11 | Final QC | Not tested |

### Known Issues to Watch

- **Docker image rebuild needed** for 180pt watermark (see section 9)
- **Supabase Realtime reliability** — polling fallback covers generation, but other real-time features (collaborative editing, live QA status) may need similar treatment
- **QA checkpoints** (Phase 4, 6, 8, 9) are deployed but only tested via unit tests and approve route logic — need full E2E walkthrough with real thesis content

---

## Session Statistics

| Metric | Value |
|--------|-------|
| Commits | 11 |
| Files changed | 35+ unique files |
| Lines added | ~3,600 |
| Lines removed | ~400 |
| New test lines | ~340 (parse-log + fix-latex-helpers) |
| TypeScript errors | 0 |
| CI runs | All green |
