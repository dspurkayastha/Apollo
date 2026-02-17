# Apollo Codebase Review — Complete Gap Analysis

**Date**: 17 February 2026
**Reviewer**: Claude Opus 4.6 (automated deep audit)
**Scope**: Full codebase vs `docs/PLAN.md` — infrastructure, business logic pipelines, frontend-backend wiring

---

# Part I: Infrastructure-Level Gap Analysis

## 1. CI/CD Health

| Check | Status | Details |
|-------|--------|---------|
| **Last commit CI** | **FAILED** | `8a900a2` — lint step exits with code 1 |
| TypeScript (tsc) | PASS | 0 errors |
| Unit tests | PASS | **343/343** across 30 files |
| ESLint | **1 ERROR** | `lib/citations/auto-resolve.ts:151` — `prefer-const` (`let tier` should be `const`) |
| ESLint warnings | 15 warnings | Unused vars (7), missing alt props (3), unused imports (5) |

**Root cause of CI failure**: A single `let` that should be `const` in `auto-resolve.ts`. Trivial fix.

---

## 2. Uncommitted Work (Risk)

**51 files modified** (+1,968 / -385 lines) and **17 untracked files/directories** sitting only on local. This represents Sprint 3-10 hardening work that has never been pushed since the Sprint 3-10 commits (`5cf238f`, `dd29b6f`, `9756fc6`). The last push was `8a900a2` (Feb 15) which failed CI.

**New untracked routes/components** (not yet version-controlled):
- `app/api/projects/[id]/citations/[citationId]/re-resolve/` — citation re-resolution
- `app/api/projects/[id]/datasets/[datasetId]/download/` — dataset download
- `app/api/projects/[id]/qc/` + `qc/fix/` — Final QC (Phase 11)
- `app/api/projects/[id]/sections/[phase]/refine/` — section refinement
- `components/project/thesis-completion.tsx` — completion UI
- `lib/citations/pre-seed.ts` — citation pre-seeding
- `lib/qc/final-qc.ts` — QC engine
- `supabase/` — migration files

---

## 3. Sprint-by-Sprint Gap Analysis

### Sprint 0: Dev Rules + Governance — COMPLETE
All guidance files, governance docs, and CI pipeline present.

### Sprint 1-2: Foundation + Setup Wizard + Licenses — COMPLETE
- Auth (Clerk) | Setup wizard (5 steps) | License CRUD
- Identity binding at Phase 1->2 | Workflow gates
- R2 signed URLs | Synopsis parsing

### Sprint 3-4: Compute + Editor — COMPLETE
- LaTeX Docker container | R Plumber Docker container
- Inngest workflow (thesis + analysis) | Novel/Tiptap editor
- CodeMirror LaTeX view | Word count tracking
- Abbreviation management | Semaphore admission control

### Sprint 5-6: AI + Citations — COMPLETE
- Claude API proxy | SSE streaming | AI prompts per phase
- Citation provenance pipeline (A/B/C/D tiers)
- PubMed/CrossRef search | Citation audit (bidirectional)
- Rate limiting | Auto-resolve

### Sprint 7: Dashboard + Compliance + Core Analysis — MOSTLY COMPLETE

| Item | Status | Notes |
|------|--------|-------|
| 12-phase pipeline timeline | Done | With 3-tier dot hierarchy |
| PDF preview (react-pdf) | Done | Split-pane viewer |
| CONSORT/STROBE/PRISMA dashboards | Done | `lib/compliance/checklists.ts` |
| NBEMS checker | Done | `lib/compliance/nbems.ts` |
| Mermaid integration | Done | `figures/mermaid/route.ts` |
| Dataset upload + column detection | Done | `lib/datasets/parse.ts` |
| Template gallery | Done | `template-gallery.tsx` |
| **R Sprint 7 analyses** | Done | Descriptive, chi-square, t-test, survival |

### Sprint 8: Advanced Analysis + Observability — PARTIAL

| Item | Status | Gap |
|------|--------|-----|
| R Sprint 8 (ROC, logistic, Kruskal-Wallis, meta-analysis) | **Needs verification** | `plumber.R` has endpoints, need to verify all 4 types |
| Runtime limits per analysis type | **Partial** | Semaphore exists, but per-type timeouts (15s-60s) not enforced at route level |
| Queue fairness (round-robin) | **MISSING** | No round-robin logic found — FIFO only |
| Sentry traces across services | **Partial** | Sentry configs exist but no custom spans for Claude/compile/R |
| PII scrubbing in Sentry/PostHog | **Partial** | `lib/ai/redact.ts` exists for AI prompts, but no `beforeSend` PII filter in Sentry config |
| Playwright MCP configured | Done | Config and E2E specs exist |

### Sprint 9-10: Export + Payments + Launch — MOSTLY COMPLETE

| Item | Status | Gap |
|------|--------|-----|
| Razorpay integration | Done | Webhook + checkout exist |
| Stripe integration | Done | Webhook exists |
| Export: PDF, DOCX, source, stats | Done | All 4 export routes exist |
| DOCX via pandoc | Done | In Dockerfile.latex |
| Supervisor dashboard | Done | `review/[token]` pages + comments API |
| Quality gate automation | **Partial** | QC routes exist (untracked), but not all checks wired |
| Landing page | Done | All sections locked |
| **PWA manifest + SW** | Done | `public/manifest.json` + `public/sw.js` |
| **PWA mobile pages** | **MISSING** | PLAN specifies 3 mobile-optimised pages (dashboard, AI chat, PDF preview) — no mobile-specific routes exist |
| Velocity rules + abuse controls | **MISSING** | No >5 licenses/30 days check found |
| `processed_webhooks` table | **MISSING** | Webhook idempotency table not in migrations |

---

## 4. Security & Infrastructure Gaps

### Docker Security (PLAN vs Actual)

| Requirement | PLAN.md | Actual | Gap |
|-------------|---------|--------|-----|
| LaTeX: `--network=none` | Required | Port `3001` exposed | **DEVIATION** — container accessible on network |
| LaTeX: seccomp profile | Active profile | `seccomp:unconfined` | **DEVIATION** — no seccomp filtering |
| R: AppArmor profile | Required | Not configured | **MISSING** |
| R: no `system()` calls verified | Required | Not enforced | **MISSING** |
| Read-only rootfs | Required | `read_only: true` | OK |
| Memory limits | 1GB LaTeX, 512MB R | `mem_limit: 1g` / `512m` | OK |

### Webhook Hardening

| Requirement | Status |
|-------------|--------|
| Signature verification | Done — In webhook routes |
| Idempotency (`processed_webhooks` table) | **MISSING** — no table, no dedup logic |
| Replay protection (Razorpay 5min window) | **MISSING** |
| Atomic license provisioning | Done — In `provision-licence.ts` |

### Database Schema

Only 3 incremental migrations found locally (`016`, `017`, `018`). The core schema (projects, sections, citations, etc.) presumably lives in Supabase directly or in earlier migrations not present locally. **Risk**: Schema drift between Supabase instance and local migration files.

---

## 5. Code Quality Issues

### Lint Errors (CI-blocking)
1. `lib/citations/auto-resolve.ts:151` — `let tier` should be `const`

### Lint Warnings (should fix)
1. `project-workspace.tsx:701` — unused `citeKey`
2. `projects/page.tsx:5` — unused `DeleteProjectButton` import
3. `export/docx/route.ts:50` — unused `warnings`
4. `refine/route.ts:75` — unused `streamCompleted`
5. `hero-3d-scene.tsx:150` — unused `roundRect`
6. `glass-sidebar.tsx:11` — unused `X` import
7. `citation-search-dialog.tsx:8` — unused `cn`
8. `dataset-upload.tsx:24` — unused `ColumnPreview`
9. `figure-gallery.tsx:152,227,256` — 3x missing `alt` props
10. `pubmed.ts:3` — unused `stripDoiField`
11. `checker.ts:2` — unused `createAdminSupabaseClient`
12. `parse-log.ts:67` — unused `isFatalError`
13. `validate.ts:66` — unused `_match`

---

## 6. Part I Priority Actions

### P0 — Fix Immediately
1. Fix the `prefer-const` lint error in `auto-resolve.ts` to unblock CI
2. Commit and push all 51 modified + 17 untracked files (massive loss risk)

### P1 — Before Launch
3. Add `processed_webhooks` table + idempotency logic to webhook handlers
4. Add Razorpay replay protection (5-min timestamp check)
5. Fix Docker security: replace `seccomp:unconfined` with a proper profile
6. Add per-analysis-type runtime limits (15s-60s timeouts)
7. Wire PII scrubbing into Sentry `beforeSend`
8. Fix all 15 lint warnings

### P2 — Before Launch (Lower Priority)
9. Implement velocity rules (>5 licenses/30 days -> hold)
10. Add queue fairness (round-robin across users)
11. Create 3 PWA mobile-optimised pages or confirm responsive design covers them
12. Resolve LaTeX container network isolation (internal Docker network vs `--network=none`)
13. Add AppArmor profile for R container
14. Ensure full database migration files are tracked in git

---

**TL;DR**: The codebase is impressively complete (~90% of PLAN.md), but has **1 CI-blocking lint error**, **51 files of uncommitted work at risk**, and ~10 security/infra gaps between what PLAN.md specifies and what's actually implemented (webhook idempotency, Docker seccomp, AppArmor, velocity rules).

---
---

# Part II: Deep-Dive Business Logic Audit

## Executive Summary

Part II audits every business logic pipeline end-to-end: AI integration, citation provenance, LaTeX processing, R analysis & figures, and phase transitions. **47 issues** identified across 6 domains — **12 P0**, **18 P1**, **17 P2**.

---

## A. AI Integration Pipeline

### A1. Prompt Architecture (`lib/ai/prompts.ts`)

**Strengths**:
- Each of 12 phases has a detailed structural template with numbered subsections
- Citation handling via `---BIBTEX---` separator is explicit and consistent
- British English enforced at multiple layers (COMMON_RULES rule #1, synopsis parser, review, QC)
- Word count targets per prompt with hard limits (e.g., Introduction: 700-1,200 words, hard limit 1,380)
- Medical domain specificity: NBEMS 12-section M&M, ICMR 2017, STROBE/CONSORT, PICO format

**Issues Found**:

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| A1 | **Phase 9 (References) prompt missing** | P1 | `getPhaseSystemPrompt()` has no `case 9`. The references phase is either handled entirely by BibTeX aggregation or simply skipped. There should be a prompt that consolidates and validates all BibTeX entries. |
| A2 | **Phase 6a/6b conflated** | P1 | PLAN specifies Phase 6a (Dataset) and 6b (Results) as separate sub-phases. `getPhaseSystemPrompt(6)` returns only `RESULTS_SYSTEM_PROMPT`. Dataset generation uses a separate prompt via a different API route, not the phase pipeline. Phase numbering is inconsistent with PLAN. |
| A3 | **Previous section context truncated to 3,000 chars** | P0 | In `getPhaseUserMessage()`: `.map((s) => s.content.slice(0, 3000))`. For ROL (3,500-4,500 words / ~20,000+ chars), only the first ~500 words are passed as context. The Discussion chapter — which must compare findings with literature — receives almost no ROL context. |
| A4 | **No Unicode avoidance in COMMON_RULES** | P1 | Despite Unicode being documented as a critical BibTeX-breaking issue in MEMORY.md, COMMON_RULES never tells the AI to avoid Unicode characters. Escaping happens downstream in `escape.ts`, but prevention at source would reduce failures. |
| A5 | **Word count targets disagree across 3 files** | P0 | `prompts.ts`, `word-count-targets.ts`, and `final-qc.ts` all specify different ranges for the same phases. Example: Introduction is 700-1,200 (prompt), 750-1,200 (word-count-targets), 500-750 (final-qc). A section could pass mid-pipeline review but fail final QC. |
| A6 | **Synopsis parse prompt duplicated with different schemas** | P2 | `SYNOPSIS_PARSE_SYSTEM_PROMPT` in prompts.ts extracts one field set; `/api/synopsis/parse` uses a completely different inline prompt extracting different fields. |

### A2. Token Budget (`lib/ai/token-budget.ts`)

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| A7 | **Refine, dataset, synopsis bypass token budget** | P0 | The refine route does not call `checkTokenBudget()` or `recordTokenUsage()`. A student could refine unlimited times consuming unlimited tokens. Dataset generation and synopsis parsing also bypass budget tracking. |
| A8 | **Input + output tokens conflated** | P1 | Budget limits say "100K output tokens per phase" but recording combines input AND output. A single generation with large context inflates usage, making the budget artificially tighter. |
| A9 | **`messages_json` always empty** | P2 | The `ai_conversations` table has a `messages_json` column, but `recordTokenUsage()` always inserts `messages_json: []`. Zero conversation history stored, no multi-turn capability. |

### A3. Review System (`lib/ai/review-section.ts`)

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| A10 | **Review is purely rule-based — no AI** | P1 | Despite the file name, `reviewSection()` is a local deterministic function with regex checks. There is no AI-powered review of content quality. The product has no AI feedback on whether the Introduction covers the knowledge gap, whether the Discussion addresses limitations, etc. |
| A11 | **M&M section check requires 8 sections; prompt mandates 12** | P1 | The review check: `if (sectionCount < 8)` — but `MATERIALS_METHODS_SYSTEM_PROMPT` specifies "MANDATORY 12 sections (NBEMS requirement)". Final QC checks for `< 12`. |

### A4. Model Routing

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| A12 | **Opus model routing unimplemented** | P2 | The generate route has a dead conditional — both branches return Sonnet 4.5. PLAN specifies Opus for Introduction (Phase 2) and Discussion (Phase 7). |

### A5. Client & Retry

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| A13 | **No retry configuration on Anthropic client** | P1 | Client created with only `{ apiKey }` — no `maxRetries`, no `timeout`. A transient 429 or 500 from Anthropic immediately fails the generation. |
| A14 | **Multiple files create standalone Anthropic instances** | P2 | `datasets/generate.ts` and `compliance/checker.ts` create `new Anthropic()` directly instead of using the singleton `getAnthropicClient()`. Changes to the singleton won't apply everywhere. |

### A6. Redaction (`lib/ai/redact.ts`)

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| A15 | **Redaction runs only on input, not AI output** | P2 | The Aadhaar regex is too broad (matches any 12-digit number). No address or patient name redaction. Redaction runs only on synopsis text before generation — not on AI output which could hallucinate PII. |

---

## B. Citation Pipeline

### B1. Resolution Engine (`lib/citations/resolve.ts`, `auto-resolve.ts`)

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| B1 | **Orphan cite keys without DB records bypass Tier D stripping** | P0 | If `resolveSectionCitations()` times out before creating Tier D placeholders for orphan keys, those `\cite{key}` commands persist through to compilation and produce "undefined citation" BibTeX warnings. `stripTierDCitations` only removes keys that exist in the `citations` table as Tier D. A key with NO DB record at all survives as `\cite{key}` in the chapter body. **Fix**: Also strip cite keys in `section.citation_keys[]` that have no matching record in the citations table. |
| B2 | **No retry logic for API failures** | P1 | All CrossRef/PubMed calls are one-shot with 10-second timeout. A transient network failure during generation permanently loses resolution for that batch. No exponential backoff, no retry queue, no circuit breaker. |
| B3 | **Re-resolve Strategy 2 lacks title verification** | P1 | The re-resolve route searches CrossRef by key pattern ("kumar 2023") and takes the first result with a DOI, without checking title similarity. The main `resolveEntry()` function correctly uses a 0.85 Levenshtein threshold — re-resolve should do the same. |

### B2. Pre-seeding (`lib/citations/pre-seed.ts`)

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| B4 | **Pre-seeded references not persisted to DB** | P2 | Pre-seeded references are only injected into the AI prompt. If the AI uses a pre-seeded reference but doesn't include it in the `---BIBTEX---` trailer (possible if truncated by token limits), the cite key becomes a Tier D orphan or goes missing entirely. Persisting pre-seeded references upfront (as Tier A, since they came from PubMed with DOIs) would be more robust. |
| B5 | **Timeout budget mismatch for ROL** | P2 | Generation has a 15-second timeout for resolution, but ROL phase has up to 30 pre-seeded refs and potentially 30+ AI-generated refs. Each ref requires up to 3 network calls with concurrency limited to 3. This could easily exceed 15 seconds. |

---

## C. LaTeX Pipeline

### C1. Round-Trip Problem (`latex-to-tiptap.ts` ↔ `tiptap-to-latex.ts`)

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| C1 | **Round-trip is lossy — inline math destroyed** | P0 | `escapeLatex()` escapes `$`, `\`, `{`, `}`, `^`, `_`. If math notation appears in a paragraph text node, `$p < 0.05$` becomes `\$p < 0.05\$` — literal dollar signs, not math mode. Medical theses are full of p-values and statistical notation. |
| C2 | **`\footnote{}`, `\url{}`, `\textsuperscript{}` destroyed** | P0 | These unrecognised LaTeX commands are garbled — backslash consumed as plain text in the Tiptap parser. Common in academic writing. |
| C3 | **`\label{}` stripped permanently** | P1 | Stripped in preprocessing, never restored. Cross-references break. |

**What survives cleanly**: Section headings, bold/italic/code/underline, `\cite{}`, bullet/numbered lists, blockquotes, complex environments as codeBlocks, basic paragraph text.

**Recommended solution**: Modified Option C — make LaTeX canonical, use CodeMirror 6 as primary editor with syntax-highlighted decorations and atomic ranges for structural commands. Eliminates the entire round-trip. See Part III Section J for full architectural specification.

### C2. Assembly (`lib/latex/assemble.ts`)

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| C4 | **Phase 10 (Appendices) generated but template never `\input`s them** | P0 | `assembleThesisContent()` generates `chapters/appendices.tex` but `templates/main.tex` has no `\input{chapters/appendices}` command. Appendices content is silently discarded. |
| C5 | **Abbreviations never injected** | P1 | `generateAbbreviationsLatex()` exists in `front-matter.ts` but `assembleThesisContent()` never calls it. The abbreviations table the user fills out is never included in the compiled thesis. |
| C6 | **`front-matter.ts` is dead code** | P2 | `generateFrontMatterLatex()` and `generateAcknowledgements()` are never called in the compile pipeline. |

### C3. Template & Packages (`generate-tex.ts`, `Dockerfile.latex`)

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| C7 | **`mathrsfs` package not installed in Docker** | P0 | `generate-tex.ts` adds `\usepackage{mathrsfs}` but this package is NOT in the Dockerfile's `tlmgr install` list and is NOT part of scheme-small. If AI-generated content uses `\mathscr{}`, compilation will fail with "File not found". |
| C8 | **Local compile mode ignores watermark** | P2 | Sandbox projects compiled locally have no watermark. Only Docker mode applies the Ghostscript watermark overlay. |

### C4. Compilation (`lib/latex/compile.ts`)

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| C9 | **PDF storage ephemeral** | P1 | PDFs stored in `os.tmpdir()` which is lost on reboot/redeploy. No R2 integration yet. The `pdf_url` in the compilations table becomes a dangling reference. |
| C10 | **Warning budget not enforced** | P2 | Per `CLAUDE.md`: "Compile warnings budget: <=20 tolerated". However, this budget is NOT enforced anywhere in code — it's documentation only. |
| C11 | **Concurrent compilation TOCTOU race** | P2 | Gap between the check for running compilation and the insert of a new compilation record. |

### C5. Validation (`lib/latex/validate.ts`)

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| C12 | **Brace-checking logic has a subtle bug** | P2 | Fails for `\\{` (double backslash followed by brace — e.g., line break before literal brace). |

---

## D. R Analysis & Figure Pipeline

### D1. R Plumber Endpoints (`docker/plumber.R`)

9 endpoints fully implemented:

| # | Endpoint | Figures Produced | Table LaTeX |
|---|----------|-----------------|-------------|
| 1 | `POST /descriptive` | **None** (empty list) | Yes (Table 1) |
| 2 | `POST /chi-square` | 1 PDF (bar or heatmap) | Yes |
| 3 | `POST /t-test` | 1 PDF (box, violin, or bar) | Yes |
| 4 | `POST /correlation` | 1 PDF (scatter + regression line) | Yes |
| 5 | `POST /survival` | 1 PDF (KM curve + risk table) | Yes |
| 6 | `POST /roc` | 1 PDF (ROC curve) | Yes |
| 7 | `POST /logistic` | 1 PDF (forest plot of ORs) | Yes |
| 8 | `POST /kruskal` | 1 PDF (boxplot) | Yes |
| 9 | `POST /meta-analysis` | **2 PDFs** (forest + funnel) | Yes |

All Sprint 7 types (descriptive, chi-square, t-test, survival) and Sprint 8 types (ROC, logistic, Kruskal-Wallis, meta-analysis) are fully implemented. Correlation is a bonus type. Shapiro-Wilk normality testing implemented for t-test and correlation with automatic fallback to non-parametric alternatives.

### D2. Issues Found

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| D1 | **R2 storage not wired for figures** | P0 | Figures written to `os.tmpdir()` which is ephemeral. Server restart loses all figure files. The `file_url` in DB becomes a dangling reference. Comment says "dev: tmpdir, prod: R2" but only tmpdir is implemented. |
| D2 | **PDF figure preview impossible in UI** | P1 | The figure gallery shows a BarChart3 icon placeholder for PDF figures (which is what R produces). No PDF preview or download link. Users cannot preview R-generated analysis figures. |
| D3 | **No figure download endpoint** | P1 | No API route serves figure binary data. The `file_url` is a relative path like `figures/{id}/...`, not a URL the browser can fetch. |
| D4 | **Descriptive analysis produces no figure** | P2 | Only Table 1 and summary JSON. A histogram or demographics bar chart is often included alongside Table 1 in medical theses. |
| D5 | **No minimum figure/table enforcement** | P1 | No validation gate checks for a minimum number of figures or tables before allowing thesis compilation or phase progression. |
| D6 | **Subfigure support absent** | P2 | Meta-analysis produces two separate PDFs (forest + funnel) but there is no mechanism to combine them into a LaTeX subfigure environment. `subcaption` package not loaded. |
| D7 | **In-memory semaphore queue promotion bug** | P0 | The `resolve` callbacks on queued entries are no-ops (`() => {}`) when using the synchronous `tryAcquire` path, meaning queued jobs never actually get promoted — they just get rejected. Queue entries are created but never consumed. |
| D8 | **Chart type/colour scheme not exposed in UI** | P2 | The R code and TypeScript schemas support `chart_type` and `colour_scheme` parameters, but the analysis wizard UI does not expose these options. |

---

## E. Phase Transitions & Pipeline Flow

### E1. Phase Definitions (`lib/phases/constants.ts`)

12 phases (0-11). Phase 0-1 available without licence; Phases 2-11 require one.

### E2. Issues Found

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| E1 | **Inngest overwrites auto-generated content — DATA LOSS** | P0 | The Inngest workflow creates empty "draft" sections for Phases 1, 9, and 11 that overwrite the auto-generated content from the approve route. When Phase 0 is approved, the workflow fires and creates an empty Phase 1 draft — overwriting any content that was just auto-generated. |
| E2 | **Phase 11 approval skips QC verification** | P0 | Users can approve Phase 11 and complete the thesis even with blocking QC failures. The `overallPass` from `finalQC()` is never checked during Phase 11 approval. |
| E3 | **`canAdvancePhase` section status check is dead code** | P1 | The approve route always passes the string literal `"approved"`, not the section's actual status. The guard is architecturally dead code for the status check. |
| E4 | **Refine route bypasses token budget** | P0 | No `checkTokenBudget()` or `recordTokenUsage()` calls. Unlimited token consumption. |
| E5 | **Refine can un-approve sections** | P1 | Refining an approved section changes status to "review" without rolling back the project's phase tracking (`phases_completed` array), creating inconsistent state where a phase is marked completed but its section is in "review" status. |
| E6 | **QC word count targets disagree with other files** | P0 | `final-qc.ts` has completely different targets from `word-count-targets.ts`. Example: Introduction is 500-750 in QC but 750-1,200 in word-count-targets. The AI generates content per the prompt targets, which the QC then considers "over target". |
| E7 | **Undefined references check passes when no compile log** | P1 | The `checkUndefinedReferences` in `final-qc.ts` returns `pass: true` when there is no compile log text. It should probably fail or warn — the check is meaningless without a log. |
| E8 | **Phase 6a/6b not separated** | P1 | PLAN calls for Phase 6a (Dataset) and 6b (Results) as separate phases. The constants collapse them into a single Phase 6. Users can generate Results content without uploading a dataset. |
| E9 | **No Phase 1->2 identity binding** | P2 | PLAN specifies that licence-to-user binding happens at Phase 1->2 transition. Not implemented in the approve route. |
| E10 | **Generation lacks phase sequence enforcement** | P2 | Can generate content for any phase regardless of current phase. Only approval enforces sequence. |
| E11 | **`phases_completed` can have duplicates** | P2 | No deduplication check when appending to the array. |
| E12 | **Spelling fix doesn't update `rich_content_json`** | P2 | The QC auto-fix for spelling (`auto-fix-spelling`) only updates `latex_content` — the fix is invisible in rich text mode. |
| E13 | **Duplicated AMERICAN_TO_BRITISH dictionary** | P2 | Same 21-entry dictionary exists in `review-section.ts`, `final-qc.ts`, and the QC fix route. Should be a shared constant. Also missing common medical terms: gynecology/gynaecology, hematology/haematology, edema/oedema, diarrhea/diarrhoea, leukocyte/leucocyte. |

---

## F. Cross-Cutting Issues

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| F1 | **Semaphore is in-memory only** | P1 | Not durable across server restarts. In a multi-instance deployment, each instance has its own semaphore, potentially overcommitting resources. Acceptable for single-VPS Hetzner deployment but fragile. |
| F2 | **Word count targets disagree across 3 locations** | P0 | `prompts.ts` (AI instruction), `word-count-targets.ts` (UI progress bar), `final-qc.ts` (QC gate) — all different values. See table in E6 for details. |
| F3 | **No Unicode warning in AI prompts** | P1 | Despite Unicode being documented as a critical BibTeX-breaking issue, `COMMON_RULES` never warns the AI. The downstream `normaliseUnicode()` handles it, but prevention at source would be more robust. |
| F4 | **Token tracking incomplete** | P0 | Refine, dataset generation, synopsis parsing, and auto-detect all bypass budget tracking. Cost-control blind spot. |
| F5 | **No global error handling strategy** | P2 | API routes have individual try/catch blocks but no standardised error reporting beyond sonner toasts on the frontend. |

---

## Part II Priority Summary

| Priority | Count | Key Items |
|----------|-------|-----------|
| **P0** | 12 | Inline math destruction, Inngest data loss, Phase 11 QC skip, token budget bypass, orphan cite keys, word count disagreement, R2 not wired, semaphore queue bug, appendices not rendered, mathrsfs missing, context truncation, refine budget bypass |
| **P1** | 18 | Review not AI-powered, abbreviations not injected, figure preview/download missing, PDF storage ephemeral, no retry logic, M&M section count mismatch, Phase 9 missing, canAdvancePhase dead code, refine un-approves, etc. |
| **P2** | 17 | Model routing, messages_json empty, subfigure support, synopsis prompt duplication, front-matter dead code, chart type not exposed, etc. |

---
---

# Part III: Frontend-Backend Linkage & Wiring Audit

## Executive Summary

Part III audits the **frontend-backend wiring**: every API route vs its frontend caller, every UI component vs PLAN.md requirements, workspace component integration, and unwired/dead code.

**Bottom line**: The frontend is ~95% structurally complete. All 67 components exist and are correctly imported. However, **11 API routes lack frontend callers**, **3 PLAN features are missing**, and **Phase 11 Final QC has no dedicated UI** — a blocking gap for thesis completion.

---

## A. API Route Inventory — Wiring Status

### Fully Wired Routes (38 routes) — All Connected

| Category | Route | Frontend Caller |
|----------|-------|----------------|
| Projects | `POST /api/projects` | New project page |
| | `GET /api/projects` | Projects list, AttachDialog |
| | `GET /api/projects/:id` | Project detail page |
| | `PATCH /api/projects/:id` | SetupWizard |
| | `DELETE /api/projects/:id` | DeleteProjectButton |
| Sections | `GET /api/projects/:id/sections` | Workspace (server component) |
| | `GET /api/projects/:id/sections/:phase` | Workspace (server component) |
| | `PUT /api/projects/:id/sections/:phase` | SectionEditor, LaTeXSourceView |
| | `POST .../generate` | AIGenerateButton (SSE) |
| | `POST .../approve` | Workspace handleApprove() |
| | `POST .../refine` | Workspace RefineDialog (SSE) |
| Compile | `POST /api/projects/:id/compile` | CompileButton |
| | `GET /api/projects/:id/preview.pdf` | PdfViewer, ThesisCompletion |
| Citations | `GET /api/citations/search` | CitationSearchDialog |
| | `POST /api/projects/:id/citations` | CitationSearchDialog |
| | `PUT /api/projects/:id/citations/:cid` | CitationListPanel (attest) |
| | `DELETE /api/projects/:id/citations/:cid` | CitationListPanel |
| | `POST .../citations/:cid/re-resolve` | CitationListPanel |
| | `POST .../citations/audit` | CitationListPanel |
| Datasets | `POST /api/projects/:id/datasets` | DatasetUpload |
| | `POST .../datasets/generate` | DatasetUpload |
| | `DELETE .../datasets/:did` | DatasetUpload |
| Analysis | `POST /api/projects/:id/analyses` | AnalysisWizard |
| | `GET .../analyses/:aid` | AnalysisWizard (polling) |
| | `POST .../analyses/auto-detect` | AnalysisWizard |
| Figures | `POST /api/projects/:id/figures` | FigureGallery |
| | `DELETE .../figures/:fid` | FigureGallery |
| | `POST .../figures/mermaid` | MermaidEditor |
| Compliance | `POST /api/projects/:id/compliance` | ComplianceDashboard |
| Share | `POST /api/projects/:id/share` | ShareDialog |
| Review | `GET /api/review/:token` | Supervisor review page |
| | `POST /api/review/:token/comments` | Supervisor review page |
| | `GET /api/projects/:id/share` | ReviewComments |
| Abbreviations | `POST /api/projects/:id/abbreviations` | AbbreviationManager |
| | `PUT .../abbreviations/:aid` | AbbreviationManager |
| | `DELETE .../abbreviations/:aid` | AbbreviationManager |
| Checkout | `POST /api/checkout` | Checkout page |
| Webhooks | `POST /api/webhooks/razorpay` | Razorpay callback |
| | `POST /api/webhooks/stripe` | Stripe callback |
| Synopsis | `POST /api/synopsis/parse` | ParsedDataReviewStep |

### Unwired / Dead Routes (11 routes) — No Frontend Caller

| # | Route | Method | Status | Impact |
|---|-------|--------|--------|--------|
| W1 | `/api/projects/:id/sections/:phase/review` | POST | Route exists, called only internally by `handleApprove()` — not exposed as standalone UI action | Low |
| W2 | `/api/projects/:id/compilations` | GET | **Compilation history never displayed** — no UI shows past compilations | Medium |
| W3 | `/api/projects/:id/qc` | POST | **Final QC check not triggered** — no QC button in workspace | **P0** |
| W4 | `/api/projects/:id/qc/fix` | POST | **QC auto-fix not triggered** — no fix button in workspace | **P0** |
| W5 | `/api/projects/:id/export/pdf` | GET | **ExportMenu exists but not rendered in workspace** — only in ThesisCompletion | Medium |
| W6 | `/api/projects/:id/export/docx` | GET | Same as W5 | Medium |
| W7 | `/api/projects/:id/export/source` | GET | Same as W5 | Medium |
| W8 | `/api/projects/:id/export/stats` | GET | Same as W5 | Medium |
| W9 | `/api/licenses` | GET | Licences page fetches directly — may work, but no explicit frontend fetch found | Low |
| W10 | `/api/licenses/:lid/transfer` | POST | **Licence transfer UI missing entirely** | Medium |
| W11 | `/api/projects/:id/datasets/:did/download` | GET | **Dataset download button not found** in DatasetUpload component | Medium |

---

## B. PLAN.md Requirements vs Implementation

### Features Present (23/26 categories — 95%)

All major feature categories from PLAN.md are implemented:
- Landing page (10 sections), Auth pages, Dashboard, Projects list
- 5-step Setup Wizard (university, synopsis, parsing, metadata, preview)
- Project Workspace (editor, PDF viewer, citation panel, data tab, compliance tab, figures tab, progress tab)
- Rich text editor (Novel/Tiptap) + LaTeX source view (CodeMirror)
- AI generation with SSE streaming + Refine
- Citation search (PubMed/CrossRef) + provenance tiers (A/B/C/D) + audit
- Statistical analysis wizard (9 test types + auto-detect)
- Figure gallery (R/Mermaid/uploaded) + Mermaid editor
- Compliance dashboards (CONSORT/STROBE/PRISMA/STARD/CARE + NBEMS)
- Export menu (PDF/DOCX/Source/Stats)
- Supervisor collaboration (share link + anonymous review + comments)
- Licence management + payment (Razorpay INR + Stripe USD)
- PWA manifest + service worker registration
- PostHog analytics (event whitelist + PII sanitisation)

### Features Missing (3 gaps)

| # | PLAN Requirement | Status | Impact |
|---|-----------------|--------|--------|
| M1 | **User Settings/Profile page** | Not found | Low — no critical functionality blocked |
| M2 | **Persistent notification centre** | Only toast notifications (sonner) — no notification bell, no Web Push | Medium |
| M3 | **Onboarding tour** | Component exists (`tour-overlay.tsx`) but **not rendered** in any page/layout | Low |

---

## C. Workspace Component Deep Audit

### Component Wiring Status — All 17 Child Components

| Component | Wired | Props Correct | Callbacks Work | Issues |
|-----------|-------|--------------|----------------|--------|
| PipelineTimeline | Yes | Yes | Yes | None |
| SectionEditor | Yes | Yes | Yes | None |
| LaTeXSourceView | Yes | Yes | Yes | No auto-save (acceptable) |
| SectionViewer | Yes | Yes | N/A | None |
| PdfViewer | Yes | Yes | Yes | None |
| AIGenerateButton | Yes | Yes | Yes | None |
| CompileButton | Yes | Yes | Yes | None |
| ReviewDialog | Yes | Yes | Yes | None |
| CitationSearchDialog | Yes | Yes | Yes | **Duplicate instance** (see C1) |
| CitationListPanel | Yes | Yes | Yes | None |
| DatasetUpload | Yes | Yes | Yes | None |
| AnalysisWizard | Yes | Yes | Yes | None |
| ComplianceDashboard | Yes | Yes | Yes | None |
| FigureGallery | Yes | Yes | Yes | None |
| MermaidEditor | Yes | Yes | Yes | None |
| ProgressDashboard | Yes | Yes | N/A (read-only) | None |
| WordCountBar | Yes | Yes | N/A | None |

### Issues Found

| # | Issue | Severity | Description |
|---|-------|----------|-------------|
| C1 | **Duplicate CitationSearchDialog** | Low | Rendered in both workspace (line 697) AND SectionEditor (line 230). Users may see two search dialogs depending on entry point. **Fix**: Remove one; use workspace state consistently. |
| C2 | **Editor mode toggle visible when non-editable** | Low | When section is approved/generating, toggle buttons still appear if content exists. Clicking switches to richtext but editor is read-only — confusing. **Fix**: Hide toggle when `!isEditable`. |
| C3 | **Mobile tab resets on phase change** | Low | `mobileTab` resets to "edit" when navigating phases. Mobile users lose their Preview selection. |
| C4 | **Phase 11 has no dedicated UI** | **P0** | Phase 11 (Final QC) renders identically to any other phase — no QC dashboard, no Tier D blocking, no auto-completion flow. See Section D below. |
| C5 | **ExportMenu not in workspace** | Medium | `ExportMenu` component exists and calls all 4 export routes, but is only rendered inside `ThesisCompletion` — not accessible during regular editing. |

### Dynamic Imports — All Valid

| Component | SSR | Loading Skeleton | File Exists |
|-----------|-----|-----------------|-------------|
| SectionEditor | Disabled | EditorSkeleton | Yes |
| LaTeXSourceView | Disabled | EditorSkeleton | Yes |
| PdfViewer | Disabled | EditorSkeleton | Yes |
| WordCountBar | Disabled | None | Yes |

### State Management — Clean

- **Context providers**: GlassSidebar, Theme, Clerk, PostHog, PWA
- **Custom hooks**: `useSSE` (streaming), `useIsMobile` (breakpoint)
- **No Zustand/Redux** — all state is component-local or context-based
- **No stale closures** detected — all useEffect dependencies correct
- **Debouncing**: SectionEditor (30s auto-save), CitationSearch (300ms), Mermaid preview (500ms)
- **Polling**: CompileButton (5s), AnalysisWizard (3s) — both clean up on unmount

---

## D. Phase 11 (Final QC) — Critical Missing Piece

**This is the single most important gap in the frontend.**

### What PLAN.md Requires
Phase 11 should:
1. Run final QC checks (word count, citation integrity, compliance)
2. Block approval if Tier D citations remain
3. Validate all previous phases are approved
4. On approval, mark thesis as "completed" status
5. Show ThesisCompletion celebration UI

### What Exists
- `POST /api/projects/:id/qc` — Backend route exists, **never called from UI**
- `POST /api/projects/:id/qc/fix` — Backend route exists, **never called from UI**
- `lib/qc/final-qc.ts` — 5 QC checks implemented in library code
- `ThesisCompletion` component — exists but only shown when `project.status === "completed"`

### What's Missing
- **No QC Dashboard component** for Phase 11
- **No "Run Final QC" button** in workspace when `viewingPhase === 11`
- **No Tier D blocking gate** before final approval
- **No transition logic** from Phase 11 -> completed status in frontend

### Recommended Fix
Create a `FinalQCDashboard` component that:
- Renders when `viewingPhase === 11` (replacing the regular editor)
- Calls `POST /api/projects/:id/qc` to get checklist results
- Displays pass/fail for each QC item (word count, citations, compliance, undefined refs, bibliography)
- Blocks "Complete Thesis" button if any QC item fails
- Offers "Auto-Fix" button calling `POST /api/projects/:id/qc/fix`
- On success, calls approve endpoint which sets `project.status = "completed"`
- Shows `ThesisCompletion` celebration

---

## E. Dead / Deprecated Code

| Item | Location | Status | Action |
|------|----------|--------|--------|
| `phase-stepper.tsx` | `components/project/` | Marked `@deprecated`, not imported anywhere | Remove |
| `interactive-grid.tsx` | `components/auth/` | Deleted in git (shows `D` in status) | Already removed |
| `app-sidebar.tsx` | `components/layout/` | Exists alongside `glass-sidebar.tsx` — unclear usage | Investigate |

---

## F. SSE Streaming Wiring — Verified

| Stream | Route | Frontend Hook | Accumulation | Completion |
|--------|-------|--------------|-------------|------------|
| Generate | `POST .../generate` | `useSSE` in AIGenerateButton | `delta` -> `streamedText` | `complete` event -> `onComplete` callback |
| Refine | `POST .../refine` | Inline fetch + ReadableStream in workspace | Manual accumulation | `[DONE]` sentinel -> refresh |

Both streams handle:
- AbortController for cancellation (Stop button)
- Error events -> toast notification
- Non-200 responses -> error body extraction
- Cleanup on unmount

---

## G. Middleware & Auth Protection

```
middleware.ts matcher: [
  '/((?!_next|[^?]*\\.(?:html?|css|js|...)$|api/webhooks).*)',
]
```

- All dashboard routes protected by Clerk middleware
- Webhook routes (`/api/webhooks/razorpay`, `/api/webhooks/stripe`) correctly excluded
- API routes use `getAuthenticatedUser()` guard individually
- Review page (`/review/[token]`) is public (token-based auth) — correct

**Issue**: No rate limiting on API routes (addressed in Part I as infrastructure gap)

---

## H. Cross-Cutting Frontend Issues

| # | Issue | Severity | Description |
|---|-------|----------|-------------|
| X1 | **No loading state for phase navigation** | Low | Clicking a phase in PipelineTimeline triggers `setViewingPhase()` but no skeleton/spinner while section data loads |
| X2 | **No error boundary** | Medium | Workspace has no React error boundary — a crash in any child component (e.g., PdfViewer WASM error) takes down the entire workspace |
| X3 | **No offline support** | Low | PWA manifest and service worker registered, but no offline cache strategy — app shows blank on network failure |
| X4 | **Checkout page hardcodes prices** | Low | Plan prices in checkout page are static JSX, not fetched from a pricing config or API |
| X5 | **PostHog opt-out only in dev** | Low | `posthog-provider.tsx` opts out in development but has no user-facing privacy toggle |

---

## I. Part III Priority Summary

### P0 — Must Fix Before Launch (4 items)

| # | Issue | Source |
|---|-------|--------|
| 1 | Phase 11 Final QC has no UI (W3, W4, C4, Section D) | Workspace + API |
| 2 | ExportMenu not accessible during editing (W5-W8, C5) | Workspace |
| 3 | Dataset download button missing (W11) | DatasetUpload |
| 4 | Licence transfer UI missing (W10) | Licences page |

### P1 — Should Fix (5 items)

| # | Issue | Source |
|---|-------|--------|
| 5 | Compilation history never displayed (W2) | Workspace |
| 6 | React error boundary missing (X2) | Workspace |
| 7 | Onboarding tour not rendered (M3) | Layout |
| 8 | Persistent notification centre (M2) | Dashboard |
| 9 | Duplicate CitationSearchDialog (C1) | Workspace |

### P2 — Nice to Have (6 items)

| # | Issue | Source |
|---|-------|--------|
| 10 | Editor toggle visible when non-editable (C2) | Workspace |
| 11 | Mobile tab resets on phase change (C3) | Workspace |
| 12 | Deprecated phase-stepper.tsx not removed (Dead code) | Cleanup |
| 13 | No loading skeleton on phase navigation (X1) | UX |
| 14 | No offline PWA cache strategy (X3) | PWA |
| 15 | User Settings/Profile page (M1) | Dashboard |

---

## J. Modified Option C — LaTeX Editor Architecture (Reference)

As discussed in Part II, the recommended solution to the LaTeX round-trip problem:

**Current**: AI -> LaTeX -> `latexToTiptap()` (lossy) -> Rich editor -> `tiptapToLatex()` (lossy) -> Compile
**Proposed**: AI -> LaTeX -> CodeMirror 6 (canonical) -> Compile

### Key Architecture Points
1. **CodeMirror 6** as primary editor (already used for source view)
2. **Syntax decorations**: LaTeX commands rendered in muted colour/different font — visually distinct but editable
3. **Atomic ranges**: Structural commands (`\section{}`, `\begin{}`/`\end{}`) protected via transaction filters
4. **Toolbar**: WYSIWYG shortcuts (Bold -> wraps in `\textbf{}`, Italic -> `\textit{}`, etc.)
5. **Citation chips**: `\cite{key}` rendered as inline badges showing author/year
6. **Math preview**: Inline math (`$...$`) gets a tooltip/popup with rendered MathJax
7. **Fold markers**: Complex environments (`tabular`, `figure`) can be folded to single-line summaries
8. **DB schema change**: `latex_content` becomes canonical; `rich_content_json` deprecated
9. **Eliminates**: `latexToTiptap()`, `tiptapToLatex()`, Novel/Tiptap dependency
10. **Keeps**: `sanitiseChapterLatex()`, `escapeBareAmpersands()`, `normaliseUnicode()` for compile-time safety

---

## Combined Priority Matrix (All Parts)

### P0 — Must Fix (16 items total)

| # | Issue | Part | Domain |
|---|-------|------|--------|
| 1 | CI-blocking lint error (`prefer-const`) | I | Infrastructure |
| 2 | 51 files uncommitted (data loss risk) | I | Infrastructure |
| 3 | Inline math destroyed by round-trip | II | LaTeX |
| 4 | `\footnote{}`, `\url{}`, `\textsuperscript{}` destroyed | II | LaTeX |
| 5 | Inngest overwrites auto-generated content (data loss) | II | Phase Transitions |
| 6 | Phase 11 approval skips QC verification | II | Phase Transitions |
| 7 | Token budget bypass (refine, dataset, synopsis) | II | AI Integration |
| 8 | Orphan cite keys bypass Tier D stripping | II | Citations |
| 9 | Word count targets disagree across 3 files | II | Cross-Cutting |
| 10 | Appendices generated but template never `\input`s them | II | LaTeX |
| 11 | `mathrsfs` package not installed in Docker | II | LaTeX |
| 12 | Previous section context truncated to 3,000 chars | II | AI Integration |
| 13 | R2 not wired for figures (ephemeral tmpdir) | II | R Analysis |
| 14 | Semaphore queue promotion bug | II | R Analysis |
| 15 | Phase 11 Final QC has no UI | III | Frontend |
| 16 | Refine route bypasses token budget | II | Phase Transitions |

### P1 — Should Fix (23 items total)

From Part I: webhook idempotency, replay protection, Docker seccomp, per-type timeouts, PII scrubbing, lint warnings.
From Part II: review not AI-powered, abbreviations not injected, figure preview/download, PDF storage ephemeral, no retry logic, M&M section count, Phase 9 missing, canAdvancePhase dead code, refine un-approves, semaphore in-memory, Unicode warning, Anthropic retry config, undefined refs check, Phase 6a/6b separation, `\label{}` stripped.
From Part III: compilation history, error boundary, onboarding tour, notification centre, duplicate CitationSearchDialog.

### P2 — Nice to Have (23 items total)

From Part I: velocity rules, queue fairness, mobile pages, network isolation, AppArmor, migration tracking.
From Part II: Opus model routing, messages_json, subfigure, synopsis duplication, front-matter dead code, chart type UI, local watermark, warning budget, brace bug, pre-seed persistence, timeout budget, redaction gaps, Phase 1->2 binding, sequence enforcement, phases_completed duplicates, spelling fix, dictionary duplication.
From Part III: editor toggle, mobile tab, deprecated stepper, loading skeleton, offline PWA, settings page, hardcoded prices, PostHog privacy.

---

---

# Part IV: Security, Monetization & Architectural Recommendations

## Executive Summary

Part IV is a deep audit of security posture, payment/licence gating, data isolation (RLS), data privacy (DPDP Act compliance), and broad architectural recommendations. Five parallel agents audited every API route, every migration file, every payment flow, every third-party data transfer, and the full infrastructure reliability surface.

**Finding totals across all five sub-audits:**
- **Critical**: 19
- **High**: 27
- **Medium**: 28
- **Low**: 10

---

## IV-A: Authentication & Security Posture

### A1. Middleware Route Protection

**File**: `middleware.ts` (lines 4-12)

Protected routes: `/dashboard(.*)`, `/projects(.*)`, `/licences(.*)`, `/checkout(.*)`, `/api/projects(.*)`, `/api/licenses(.*)`, `/api/upload(.*)`.

**Missing from middleware**: `/api/checkout(.*)`, `/api/synopsis(.*)`, `/api/citations(.*)`, `/api/inngest(.*)`. All have application-level auth (`getAuthenticatedUser()`), but middleware should be the authoritative gate.

**Severity: MEDIUM**

### A2. IDOR Vulnerabilities (Insecure Direct Object Reference)

| Route | File | Client | Ownership Check | Severity |
|-------|------|--------|----------------|----------|
| `GET /api/projects/[id]` | `app/api/projects/[id]/route.ts:23` | Server (RLS) | NO explicit `user_id` | CRITICAL |
| `PATCH /api/projects/[id]` | `app/api/projects/[id]/route.ts:60` | Server (RLS) | NO explicit `user_id` | CRITICAL |
| `DELETE /api/projects/[id]` | `app/api/projects/[id]/route.ts:89` | Server (RLS) | NO explicit `user_id` | CRITICAL |
| `GET /api/projects` | `app/api/projects/route.ts:16` | Server (RLS) | NO `user_id` filter | MEDIUM |
| `GET /api/licenses` | `app/api/licenses/route.ts:11` | Server (RLS) | NO `user_id` filter | MEDIUM |
| `GET /api/projects/[id]/share` | `app/api/projects/[id]/share/route.ts:79` | Admin (bypasses RLS) | NO ownership check | CRITICAL |
| `POST /api/upload/signed-url` | `app/api/upload/signed-url/route.ts:20` | N/A (R2 direct) | NO project ownership | HIGH |

The first 5 routes use `createServerSupabaseClient()` with RLS, so database-level policies provide protection. But this is defence-in-depth violation --- if RLS misconfigures or the Clerk-Supabase JWT integration fails, all projects are exposed.

The share GET and upload routes are **genuinely vulnerable**: they use the admin client (bypasses RLS) with no ownership check.

### A3. Role Escalation via Direct Supabase Client

**File**: `supabase/migrations/002_create_users.sql` (lines 24-28)

The `users` UPDATE RLS policy allows unrestricted updates to the user's own row, including the `role` field. The browser-side Supabase anon key is exposed via `NEXT_PUBLIC_SUPABASE_ANON_KEY`. A malicious user could set their own `role` to `admin` via a direct Supabase update call, gaining organisation-wide data views.

**Severity: HIGH**

**Fix**: Restrict the UPDATE policy:
```sql
WITH CHECK (
  clerk_user_id = (select auth.jwt()->>'sub')
  AND role = OLD.role  -- prevent role changes
);
```

### A4. Input Validation & Injection

- **SQL Injection**: No vectors found. All queries use Supabase parameterised builder. **GOOD.**
- **Command Injection**: `execFile` (not `exec`) used for Docker --- prevents shell metacharacter injection. **GOOD.**
- **XSS**: `dangerouslySetInnerHTML` in `title-page-preview.tsx` without sanitisation. **MEDIUM.**
- **LaTeX Injection**: Thorough escape pipeline (`escapeLatex`, `normaliseUnicode`, `escapeBareAmpersands`). **GOOD.**
- **Header Injection**: `Content-Disposition` in DOCX export interpolates `project.title` without encoding. **LOW.**

### A5. CSRF Protection

No explicit CSRF middleware or tokens. Clerk manages session cookies with `SameSite=Lax` by default, which mitigates CSRF for state-changing POST requests. No additional action required for now.

### A6. Rate Limiting

**File**: `lib/ai/rate-limit.ts`

In-memory `Map` with 10 requests/hour/user. Issues:
- Resets on server restart/deploy
- Not shared across instances
- Only applied to the generate route --- NOT applied to: refine, auto-detect, synopsis parse, citation search, compile

**Severity: HIGH** --- Unlimited AI API calls via unprotected endpoints.

### A7. File Upload Security

- **Type validation**: PDF, CSV, XLSX, PNG, JPEG --- validated in R2 client and route. **GOOD.**
- **Path traversal**: Rejects `..`, `//`, `\\` + sanitises to `[^\w.\-]` -> `_`. **GOOD.**
- **File size not enforced on signed URL**: `MAX_FILE_SIZE` (50MB) defined but never passed as `ContentLength` constraint. **MEDIUM.**
- **Dataset upload no file size check**: `FormData` file read without size validation --- OOM risk. **MEDIUM.**

### A8. Docker Container Security

LaTeX container: `network_mode: none`, `read_only: true`, `mem_limit: 1g`, `pids_limit: 256`, `cap_drop: ALL` + minimal `cap_add`, `no-new-privileges: true`. **Excellent hardening.**

R Plumber container: Similar hardening but port `8787` exposed to all interfaces, `seccomp:unconfined`, and **no inter-service authentication**. Any process that can reach port 8787 can run analyses.

**Severity: MEDIUM** (R Plumber auth)

### A9. DEV_LICENCE_BYPASS

**File**: `lib/phases/transitions.ts:44`

```typescript
const devBypass = process.env.DEV_LICENCE_BYPASS === "true";
```

No `NODE_ENV` guard. If accidentally set in production, all licence requirements are bypassed.

**Severity: HIGH**

---

## IV-B: Payment & Licence Pipeline

### B1. Payment Flow Architecture

1. Checkout UI -> `POST /api/checkout` -> Razorpay order (INR) or Stripe session (USD)
2. Payment gateway completes
3. Webhook fires -> signature verified -> idempotency checked -> licence provisioned

### B2. Critical: Webhook Race Condition (Double Provisioning)

**Files**: `app/api/webhooks/razorpay/route.ts:62-63`, `app/api/webhooks/stripe/route.ts:62-63`

```typescript
await provisionLicence(userId, planType, projectId);
await markEventProcessed("razorpay", eventId, eventType);
```

If `provisionLicence` succeeds but `markEventProcessed` fails (DB write error), the next webhook retry provisions a **second licence**. Not atomic --- no transaction wrapping.

**Severity: CRITICAL**

**Fix**: Use `INSERT ... ON CONFLICT DO NOTHING RETURNING id` as the first step. If no row returned, event was already processed.

### B3. Professional Plan: 1 Licence Instead of 3

Landing page and checkout UI advertise "3 thesis licences" for Professional plan. `provisionLicence()` always inserts exactly ONE licence row.

**Severity: HIGH (commercial promise not fulfilled)**

### B4. No Licence Expiry Enforcement

`expires_at` is set at provisioning (30 days for monthly, 1 year for one-time), but **no cron job, middleware, or API check** verifies whether a licence has expired. Monthly subscribers get perpetual access.

**Severity: HIGH**

### B5. Missing Licence Gates

| Route | Licence Check | AI/Compute Cost | Severity |
|-------|--------------|-----------------|----------|
| `POST .../generate` | NO | Claude tokens | HIGH |
| `POST .../refine` | NO | Claude tokens | HIGH |
| `POST .../compile` | NO | Docker compute | MEDIUM |
| `POST .../auto-detect` | NO | Claude tokens | MEDIUM |
| `POST .../datasets/generate` | NO | Claude tokens | MEDIUM |
| `POST .../qc` | NO | Compute | MEDIUM |
| `GET .../preview.pdf` | NO | Bandwidth | MEDIUM |
| `POST .../share` | NO | N/A | MEDIUM |

Sandbox users can consume expensive AI tokens for phases they should not access. The only gate is at the *approval/advancement* step, not at *generation*.

### B6. No Plan-Based Feature Differentiation

Professional plan advertises "Priority compile queue", "Supervisor collaboration links", "Source LaTeX export" --- none implemented. `student_monthly` and `professional_monthly` licences grant identical access.

**Severity: HIGH**

### B7. Hidden "addon" Plan

`addon` plan (Rs 299) exists in validation schema and pricing table but is NOT displayed in checkout UI. Can be purchased via direct API call --- cheapest licence available.

**Severity: MEDIUM**

### B8. "Monthly" Plans Are One-Time Purchases

No Stripe subscription management, no recurring billing, no cancellation webhook handler, no refund endpoint. Despite being called "monthly", all payments are one-time (`mode: "payment"` in Stripe session). Combined with no expiry enforcement (B4), these are effectively perpetual one-time purchases.

**Severity: HIGH**

### B9. Pricing Inconsistency

| Source | Student | Professional |
|--------|---------|-------------|
| Landing page | Rs 2,499/month | Rs 4,999/month |
| FAQ section | Rs 2,499/month or Rs 14,999/6-month | Rs 4,999/month or Rs 24,999/lifetime |
| Actual checkout | Rs 499/month | Rs 999/month |

**Severity: MEDIUM (legal/trust risk)**

### B10. Non-Atomic Licence Attachment

`POST /api/licenses/[lid]/attach/[pid]` updates licence and project in separate calls. If licence update succeeds but project update fails, licence is consumed but project remains sandbox.

**Severity: MEDIUM**

### B11. Unlimited Project Creation

No limit on projects per user. Combined with missing licence gates (B5), a user can create unlimited sandbox projects, each with its own 1.2M token budget.

**Severity: MEDIUM**

### B12. Checkout Does Not Validate project_id Ownership

`POST /api/checkout` passes `project_id` from request body into payment metadata without verifying the user owns that project. The provisioning step filters by `user_id` so the attack does not succeed, but payment metadata is polluted.

**Severity: HIGH**

---

## IV-C: RLS Policies & Data Isolation

### C1. Supabase Client Usage Split

| Client | RLS Behaviour | Used In |
|--------|--------------|---------|
| `createAdminSupabaseClient()` | **BYPASSES RLS** | ~35 API route files |
| `createServerSupabaseClient()` | Respects RLS | 5 route files |
| Browser client | Respects RLS | Dashboard components |

Since admin client is used in the vast majority of routes, **RLS policies are effectively inert** for those routes. All data isolation depends on correctness of manual `.eq("user_id", authResult.user.id)` checks.

### C2. Tables WITH RLS Enabled (17 total)

All 17 user-facing tables have RLS enabled: `organisations`, `users`, `thesis_licenses`, `projects`, `sections`, `citations`, `datasets`, `analyses`, `figures`, `compliance_checks`, `compilations`, `ai_conversations`, `audit_log`, `abbreviations`, `review_tokens`, `review_comments`.

### C3. Table WITHOUT RLS

`processed_webhooks` --- intentional (server-only, no user data). **Acceptable.**

### C4. Missing RLS Policies

- `datasets`: Missing UPDATE policy
- `compilations`: Missing UPDATE policy
- `review_comments`: Missing INSERT policy for authenticated users
- `thesis_licenses`: Missing INSERT policy (intentional --- webhook-only creation)

### C5. Positive: Routes WITH Correct Authorization

32+ routes correctly verify ownership with `.eq("user_id", authResult.user.id)` using admin client: all section, citation, dataset, analysis, figure, abbreviation, compilation, compliance, QC, and export routes.

### C6. RLS Tests Incomplete

`tests/security/rls.test.ts` only verifies data exists via admin client (service role). Does NOT test actual per-user isolation with mock JWTs.

**Severity: MEDIUM**

---

## IV-D: Data Privacy & DPDP Act Compliance

### D1. PII Data Inventory

| Data Field | Storage | Classification |
|-----------|---------|---------------|
| Email, Name | `users` (plaintext) + Clerk | Sensitive |
| Candidate name, Registration no, Guide name, HOD name | `projects.metadata_json` (plaintext) | Sensitive |
| IP address | `audit_log.ip_address` (defined, never populated) | Sensitive |
| Synopsis text (may contain patient data) | `projects.synopsis_text` | Highly Sensitive |
| Dataset (may contain patient data) | `datasets.rows_json` + R2 | Highly Sensitive |

### D2. CRITICAL: Metadata Sent Unredacted to Claude API

**File**: `app/api/projects/[id]/sections/[phase]/generate/route.ts:199`

`redactPII()` is applied to synopsis text but NOT to `metadata_json`. `candidate_name`, `guide_name`, `hod_name`, `registration_no`, and `department` are sent in every generation call to Claude's US-based API.

### D3. CRITICAL: Dataset Generation Sends Synopsis Without Redaction

**File**: `lib/datasets/generate.ts:59`

Synopsis is sent to AI without passing through `redactPII()`.

### D4. CRITICAL: Previously Approved Sections Sent to AI With PII

Phase 1 (Front Matter) content includes names, registration numbers, guide names. All subsequent generation calls include this PII as context.

### D5. CRITICAL: No Privacy Policy or Terms of Service Pages

Footer links point to `#` (dead links). No `/privacy` or `/terms` routes exist.

### D6. CRITICAL: No Account Deletion Flow

No "Delete My Account" endpoint, page, or cascade delete mechanism. DPDP Act Section 12(1) right to erasure is not implemented.

### D7. CRITICAL: No Consent for AI Processing

No acknowledgement, checkbox, or consent flow at sign-up or project creation informing users their content will be processed by US-based AI services.

### D8. CRITICAL: Zero Data Retention Policies Implemented

Governance document defines comprehensive retention schedules (90-day AI conversations, 2-year audit logs, R2 cleanup). **None implemented** --- no cron jobs, no scheduled functions, no cleanup code exists.

### D9. HIGH: Edge Sentry Config Missing PII Stripping

`sentry.edge.config.ts` initialises Sentry without a `beforeSend` hook. Errors in edge middleware could leak PII. Client and server configs correctly strip PII.

### D10. HIGH: No PII Scanning on Dataset Upload

Governance document claims "Validate for PII patterns on upload" --- no implementation exists. User-uploaded datasets containing patient data pass through unchecked.

### D11. HIGH: Audit Log Retains PII After Project Deletion

`audit_log.project_id` is NOT `ON DELETE CASCADE`. Audit logs with full row snapshots (including PII) persist after project deletion.

### D12. HIGH: Cookie Consent

No cookie consent banner. PostHog analytics is opt-out (development mode only), not opt-in. DPDP Act requires explicit consent for analytics tracking.

### D13. Positive Findings

- PII redaction for synopsis (`redactPII()` covers phone, Aadhaar, email, PAN)
- PostHog uses EU endpoint with sanitised properties
- Sentry client/server configs strip PII
- Structured logger strips sensitive fields
- Webhook payloads contain no PII (only UUIDs)
- Project deletion cascades to all child tables (sections, citations, datasets, etc.)
- AI dataset generation prompts instruct "Do NOT include patient names"

---

## IV-E: Architecture & Reliability Recommendations

### E1. In-Memory State Must Move to Redis (P0)

Semaphore and rate limiter both use in-memory `Map`. They reset on server restart/deploy and are not shared across instances. This is the highest-priority infrastructure change.

**Immediate fix**: Add a TTL-based "stale job reaper" (every 60s) to evict orphaned active jobs.

### E2. PDF Storage Must Move to R2 (P0)

PDFs stored in `/tmp` are lost on every deployment. Users will see "PDF not found" after deploys.

**Fix**: Upload compiled PDFs to R2, store R2 object key in `compilations.pdf_url`, serve via signed URL redirect.

### E3. Stale Compilation Recovery (P0)

If server crashes during compilation, the compilation record is stuck at `status: "running"` forever, permanently blocking the project.

**Fix**: Add a staleness window (5 minutes) to the "already running" check. Add a periodic sweep via Inngest cron.

### E4. AI Generation Should Move to Inngest (P1)

Current long-lived SSE stream is fragile on Indian mobile networks (frequent dropouts). Split into:
1. `POST /generate` --- enqueue Inngest job, return `job_id`
2. Poll or Supabase Realtime for progress updates

Inngest is already in `package.json` (`inngest@^3.52.0`) but appears unused.

### E5. Singleton Supabase Admin Client (P1)

`createAdminSupabaseClient()` creates a new client per call. Make it a module-level singleton --- it is stateless and safe to reuse.

### E6. N+1 Citation Upserts (P1)

`lib/citations/auto-resolve.ts` performs individual `supabase.from("citations").upsert(...)` calls per citation. For ROL with 30+ citations, this is 30+ sequential DB round-trips.

**Fix**: Batch upserts --- Supabase `.upsert()` accepts an array.

### E7. PDF Viewer: Mobile Performance (P2)

Thumbnail view creates 100+ `<Page>` components simultaneously for large theses. Virtualise with `react-window`.

### E8. Bundle Size Concerns (P2)

- `three` + R3F: ~600KB (auth page 3D scene only --- ensure `next/dynamic` + `ssr: false`)
- `mermaid`: ~1.8MB (diagram rendering --- lazy load)
- `xlsx`: ~600KB (dataset parsing --- dynamic import)
- `pdfjs-dist`: ~800KB (worker loaded from unpkg CDN --- self-host in `/public/`)

### E9. Health Check Endpoint (P1)

No `/api/health` endpoint exists. Required for Coolify monitoring, uptime robots, load balancers.

### E10. Environment Variable Validation (P0)

All env vars accessed via `process.env.X!` (non-null assertion). Missing vars produce cryptic errors deep in Supabase calls.

**Fix**: Zod validation at startup in `next.config.ts`.

### E11. Offline/Connectivity Handling (P2)

Target users are Indian medical PG students on 4G mobile. No service worker, no offline caching, no optimistic UI updates. AI generation requires sustained 30-90s SSE connection.

### E12. Business Model Observations

- INR 499/month with 30-day expiry conflicts with thesis writing reality (students work in bursts with weeks between supervisor feedback)
- Consider INR 499/thesis with 90-day window instead
- Professional plan should target departments/guides, not individual students (INR 2,999 for 5 licences/semester)
- Add INR 199 trial tier covering Phase 0-1 only for quality evaluation
- Add referral system for viral growth within medical PG cohorts

---

## IV Combined: Priority Matrix

### CRITICAL (19 items)

| # | Finding | Sub-audit | Fix |
|---|---------|-----------|-----|
| 1 | IDOR: GET/PATCH/DELETE `/api/projects/[id]` no ownership check | A, C | Add `.eq("user_id")` or switch to admin client with manual check |
| 2 | IDOR: GET `/api/projects/[id]/share` leaks review tokens | A, C | Add project ownership check |
| 3 | Upload signed-url: no project ownership verification | A, C | Verify user owns `projectId` before generating URL |
| 4 | Webhook race condition: double licence provisioning | B | Use `INSERT ON CONFLICT DO NOTHING RETURNING id` |
| 5 | DEV_LICENCE_BYPASS: no production guard | A, B | Add `NODE_ENV !== "production"` check |
| 6 | Metadata sent unredacted to Claude API | D | Create `sanitiseMetadataForAI()` function |
| 7 | Synopsis unredacted in dataset generation | D | Apply `redactPII()` in dataset generate route |
| 8 | No privacy policy page | D | Create `/privacy` route |
| 9 | No terms of service page | D | Create `/terms` route |
| 10 | No account deletion flow | D | Implement cascade delete |
| 11 | No consent for AI processing | D | Add consent checkbox at project creation |
| 12 | Zero data retention policies implemented | D | Implement scheduled auto-purge jobs |
| 13 | Cross-border data transfer without disclosure | D | Update privacy policy + consent flow |
| 14 | No medical data special handling | D | Add synopsis upload warning for case reports |
| 15 | PDF storage in /tmp (lost on deploy) | E | Move to R2 |
| 16 | Stale compilation blocks project forever | E | Add staleness window + periodic sweep |
| 17 | Env var validation missing | E | Zod validation at startup |
| 18 | In-memory semaphore/rate limiter | E | Move to Redis |
| 19 | Previously approved sections with PII sent to AI | D | Strip PII from section context |

### HIGH (27 items)

| # | Finding | Sub-audit |
|---|---------|-----------|
| 1 | Role escalation via direct Supabase client (users can set role to admin) | C |
| 2 | Rate limiting only on generate --- refine, auto-detect, synopsis unprotected | A |
| 3 | Generate route: no licence check (sandbox users consume AI tokens) | B |
| 4 | Refine route: no licence check | B |
| 5 | Professional plan provisions 1 licence instead of 3 | B |
| 6 | No licence expiry enforcement (monthly = perpetual) | B |
| 7 | No plan-based feature differentiation (Professional === Student) | B |
| 8 | "Monthly" plans are one-time purchases (no subscriptions) | B |
| 9 | No refund/cancellation system | B |
| 10 | Sandbox users: unlimited AI generation across unlimited projects | B |
| 11 | Checkout does not validate project_id ownership | B |
| 12 | Admin Supabase client used in 35+ routes (bypasses RLS) | A, C |
| 13 | Edge Sentry config missing PII stripping | D |
| 14 | No PII scanning on dataset upload | D |
| 15 | Audit log retains PII after project deletion (no CASCADE) | D |
| 16 | No R2 file cleanup on project deletion | D |
| 17 | No auto-purge for AI conversations | D |
| 18 | No PII check on AI-generated responses | D |
| 19 | Refine route sends LaTeX with PII to AI without redaction | D |
| 20 | Cookie consent: no banner or opt-in mechanism | D |
| 21 | Sentry session replays capture form fields with PII | D |
| 22 | Review system provides PDF URL that reviewers cannot access | C |
| 23 | XSS via `dangerouslySetInnerHTML` in title-page-preview | A |
| 24 | R Plumber: no inter-service authentication | A |
| 25 | Pricing inconsistency between landing, FAQ, and checkout | B |
| 26 | AI generation timeout constant (2min) too tight for ROL phase | E |
| 27 | No health check endpoint for monitoring | E |

### MEDIUM (28 items)

| # | Finding | Sub-audit |
|---|---------|-----------|
| 1 | Middleware missing: `/api/checkout`, `/api/synopsis`, `/api/citations` | A |
| 2 | GET `/api/projects` and GET `/api/licenses`: no explicit user filter | A, C |
| 3 | File size not enforced on R2 signed URLs | A |
| 4 | Dataset upload: no file size check (OOM risk) | A |
| 5 | `local` compile mode runs TeX on host (not Docker) | A |
| 6 | `seccomp:unconfined` on Docker containers | A |
| 7 | Compile route: no licence check (compute cost ungated) | B |
| 8 | Preview PDF: no licence check | B |
| 9 | Analysis/dataset/QC/share routes: no licence checks | B |
| 10 | Hidden "addon" plan at Rs 299 via direct API | B |
| 11 | Non-atomic licence attachment | B |
| 12 | Unlimited project creation | B |
| 13 | Razorpay client-side success handler: timing guess redirect | B |
| 14 | Idempotency check not atomic with provisioning | B |
| 15 | Inconsistent Supabase client usage makes security reasoning hard | C |
| 16 | Missing UPDATE RLS on datasets and compilations tables | C |
| 17 | No review token revocation endpoint | C |
| 18 | RLS tests do not test per-user isolation with mock JWTs | C |
| 19 | PostHog opt-out only, not opt-in | D |
| 20 | No DPA references for Clerk, Sentry, PostHog, Anthropic | D |
| 21 | Identity hashing not implemented (schema exists, no code) | D |
| 22 | Console.error bypasses structured logger | D |
| 23 | Security test scripts referenced but not implemented | D |
| 24 | Governance claims not backed by code | D |
| 25 | No ethics committee approval enforcement | D |
| 26 | N+1 citation upserts (30+ sequential DB calls) | E |
| 27 | PDF viewer: 100+ canvas elements on mobile | E |
| 28 | Bundle size: Three.js + mermaid + xlsx in shared bundle | E |

### LOW (10 items)

Content-Disposition header injection, origin header in share URLs, no rate limit on review comments, no limit on review token generation, Mermaid innerHTML (mitigated by strict mode), processed_webhooks no RLS (intentional), review_comments INSERT only via admin (intentional), licence transfer doesn't check project progress, preview PDF serves watermarked PDFs (acceptable), checkLicenceGate inconsistent with DEV_LICENCE_BYPASS.

---

## Recommended Fix Order

### Before Any User Testing (Week 1)

1. Add `sanitiseMetadataForAI()` --- strip names, reg. no. from AI prompts
2. Apply `redactPII()` in dataset generation route
3. Add `beforeSend` PII stripping to `sentry.edge.config.ts`
4. Add `maskAllInputs: true` to Sentry replay config
5. Add explicit `user_id` checks to `GET/PATCH/DELETE /api/projects/[id]`
6. Add project ownership check to `GET /api/projects/[id]/share`
7. Add project ownership check to `POST /api/upload/signed-url`
8. Guard `DEV_LICENCE_BYPASS` with `NODE_ENV !== "production"`
9. Restrict `users` UPDATE RLS to prevent role changes

### Before Public Beta (Week 2-3)

10. Move PDF storage from `/tmp` to R2 with signed URL redirect
11. Add stale compilation recovery (5-min staleness window + periodic sweep)
12. Add env var validation at startup (Zod in `next.config.ts`)
13. Move semaphore + rate limiter to Redis (Upstash)
14. Add licence checks to generate and refine routes
15. Fix webhook race condition (atomic idempotency)
16. Create `/privacy` and `/terms` pages
17. Add AI processing consent at project creation
18. Implement "Delete My Account" flow
19. Fix Professional plan to provision 3 licences

### Before GA Launch (Week 4-6)

20. Implement licence expiry enforcement (pg_cron or Inngest scheduled job)
21. Implement data retention auto-purge (AI conversations 90-day, audit logs 2-year)
22. Add R2 cleanup on project deletion
23. Add dataset PII scanner on upload
24. Implement plan-based feature differentiation
25. Move AI generation to Inngest (background jobs)
26. Add `/api/health` endpoint
27. Batch citation upserts
28. Self-host PDF.js worker
29. Add cookie consent banner
30. Synchronise pricing across all pages from single source of truth

---

*End of review. Parts I (infrastructure), II (business logic pipelines), III (frontend-backend wiring), and IV (security, monetization, and architectural recommendations) cover the complete Apollo codebase. Total unique findings across all four parts: 136.*
