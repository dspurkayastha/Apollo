# Apollo — Decision Log

**Date**: 17 February 2026
**Source**: Decision points extracted from `docs/REVIEW.md` (136-finding codebase audit) + discussion with project owner.

---

## 1. Pricing & Business Model

### 1.1 Price Points

| Plan | One-time | Monthly | Notes |
|------|----------|---------|-------|
| **Student** (MD/MS/PG Diploma) | Rs 14,999 | Rs 5,499/mo × 3 min | 75% of Rs 18-20K market rate |
| **Professional** (PhD thesis) | Rs 39,999 | TBD | Opus model, 180-day validity. Paper/article as separate product later |
| **Addon** (refinement) | — | Rs 3,999/mo | Scoped: refine sections, regenerate figures, re-compile only. No new phase generation |
| **Sandbox** | Free | — | Phase 0-2 (Title, Front Matter, Introduction). Watermarked. 1 active project |

**Rationale**: 75% of market signals premium quality, not discount AI slop. 95% gross margin at Rs 14,999 (AI cost ~Rs 500/thesis).

### 1.2 Payment Model

- **One-time**: No gates — student can sprint through all 12 phases at their own pace. 90-day validity.
- **Monthly**: Rs 5,499/month with minimum 3-month commitment + phase gate (max 4 phases/month). Total Rs 16,497 — 10% premium over one-time to incentivise upfront payment.
- **EMI**: Via Razorpay native EMI on credit/debit cards for the one-time price.
- **Stripe USD**: For international students (NRI medical PGs). See §1.8 below.

### 1.3 Professional Plan

- Rs 39,999 one-time, 180-day validity
- PhD thesis workflow (longer, more complex)
- Opus model for key chapters, higher token quota
- Paper writing and articles as a separate product line (future)
- Monthly pricing TBD

### 1.4 Addon Plan

- Rs 3,999/month
- **Scoped**: refine existing sections after guide comments, regenerate figures, re-compile
- **NOT scoped**: generate new phases from scratch
- Available after main licence expires or alongside it

### 1.5 Sandbox (Free Tier)

- Phase 0 (Synopsis/Title) + Phase 1 (Front Matter) + Phase 2 (Introduction)
- All output watermarked with "Apollo" in Playfair Display, diagonal across every page
- One active project per user
- PDF download allowed (watermarked) — serves as marketing asset when students share

### 1.6 Project & Licence Rules

- **One licence = one project, permanently bound**. Once attached, cannot be re-attached to another project.
- **One active project per licence** (not a hard cap on total projects created).
- **Metadata always editable**: candidate name, guide name, HOD, department, registration number, title, synopsis, university template — all editable regardless of phase.
- **Free reset before Phase 4**: If student needs a complete topic change, they can reset to Phase 0 (clears all generated content) for free, once per licence, if they haven't passed Phase 4 (Aims & Objectives). After Phase 4, new licence required.
- **Licence states**: `unused` → `active` (attached to project) → `completed` (thesis exported). No going back.

### 1.7 Hidden Addon Plan (Rs 299)

Exists in schema but hidden from UI. To be repurposed or removed — superseded by the Rs 3,999/mo addon plan above.

### 1.8 Payment Gateways

**Razorpay (INR — primary)**:
- One-time payments: Rs 14,999 (Student), Rs 39,999 (Professional) via UPI, cards, net banking
- Recurring subscriptions: Rs 5,499/mo via Razorpay Subscriptions API (`total_count: 3`, auto-charge, dunning)
- EMI: Native Razorpay EMI on the one-time price for supported cards

**Stripe (USD — international)**:
- One-time: $179 (Student), $449 (Professional)
- Monthly: $65/mo × 3 minimum commitment ($195 total, maintains 10% premium)
- Addon: $49/mo
- Target audience: NRI medical PGs, international students
- INR via Stripe: TBD (may enable for Indian students preferring international cards)

### 1.9 Legal Text

**Approach**: AI-drafted, owner-reviewed before launch.
- Terms of Service (academic integrity disclaimer, licence terms, refund policy)
- Privacy Policy (DPDP Act compliant — data processing notice, consent flows, data residency disclosure)
- Refund Policy (7-day cooling-off for account deletion, unused licence refund terms)
- All text drafted by AI, reviewed/edited by project owner, optionally vetted by lawyer before go-live
- Routes: `/terms`, `/privacy`, `/refund`

---

## 2. Editor Architecture

### Decision: CodeMirror 6 as Primary Editor (Modified Option C)

**Problem**: Tiptap rich-text editor destroys inline math (`$p < 0.05$`), `\footnote{}`, `\url{}`, `\textsuperscript{}` during the LaTeX → Tiptap → LaTeX round-trip. P0 for medical theses.

**Solution**: Make LaTeX canonical. CodeMirror 6 becomes the primary editor with:
- Syntax-highlighted decorations (LaTeX commands in muted colour)
- Citation chips (`\cite{key}` rendered as inline badges)
- Math preview tooltips (inline math gets rendered MathJax popup)
- WYSIWYG toolbar (Bold → `\textbf{}`, Italic → `\textit{}`, etc.)
- Atomic ranges for structural commands (`\section{}`, `\begin{}`/`\end{}`)
- Fold markers for complex environments (`tabular`, `figure`)

**Eliminates**: `latexToTiptap()`, `tiptapToLatex()`, Novel/Tiptap dependency, entire round-trip bug class.
**Keeps**: `sanitiseChapterLatex()`, `escapeBareAmpersands()`, `normaliseUnicode()` for compile-time safety.

**DB schema change**: `latex_content` becomes canonical; `rich_content_json` deprecated.

---

## 3. AI Pipeline

### 3.1 Phase 9 (References): AI Consolidation

AI reviews all BibTeX entries for: duplicates, formatting consistency, missing fields, Vancouver style compliance. Not pure aggregation.

### 3.2 Section Review: AI-Powered

Claude evaluates content quality before approval: knowledge gaps, logical flow, citation adequacy, methodology rigour. Replaces the current rule-based regex checks. ~2K tokens per review.

### 3.3 Model Routing

- **Opus**: Introduction (Phase 2) and Discussion (Phase 7) — these define thesis quality
- **Sonnet 4.5**: All other phases
- Cost impact: ~Rs 50-80 extra per thesis — negligible at Rs 14,999 price point

### 3.4 Previous Section Context: Full Content

No truncation. Discussion receives the full ROL, M&M, and Results as context. Extra input token cost (~Rs 30-50) is negligible at Rs 14,999.

### 3.5 Generation Architecture: Inngest + Live Preview

- AI generation runs as Inngest background jobs (server-side, decoupled from browser)
- If student stays on page: live text preview via Supabase Realtime
- If student closes tab/loses connection: generation continues, content waiting when they return
- Inngest is the primary orchestrator for all background work (generation, compilation, scheduled tasks)

---

## 4. Word Count & QC Targets

### 4.1 Canonical Word Count Ranges

Single source of truth — all three files (`prompts.ts`, `word-count-targets.ts`, `final-qc.ts`) unified.

| Phase | Soft range (AI target) | AI aims for | Hard floor (QC fail) | Hard ceiling (QC fail) |
|-------|----------------------|-------------|---------------------|----------------------|
| Aims & Objectives | 300–500 | ~450–500 | 300 | 575 |
| Introduction | 1,000–1,400 | ~1,300–1,400 | 1,000 | 1,610 |
| ROL (excl. LongTable) | 3,500–5,000 | ~4,500–5,000 | 3,500 | 5,750 |
| Materials & Methods | 1,500–2,500 | ~2,200–2,500 | 1,500 | 2,875 |
| Discussion | 2,000–3,500 | ~3,000–3,500 | 2,000 | 4,025 |
| Conclusion | 500–800 | ~700–800 | 500 | 920 |

### 4.2 QC Gate Rules

- **Hard floor** = Soft minimum (no margin). Below this = section genuinely incomplete.
- **Hard ceiling** = Soft maximum × 1.15 (+15% buffer). Above this = section bloated.
- AI prompts instruct: "Attempt to stay on the higher end of the target range."

### 4.3 Refine Rules

- When shortening: maintain proper structure. Do NOT truncate mid-paragraph or drop sections arbitrarily.
- When lengthening: do NOT pad the last few sections. Distribute additional content across the chapter maintaining structural integrity.
- Refine elongation has a ceiling. QC gate adjusts to the elongation ceiling.

---

## 5. Phase Structure

### 5.1 Phase 6a/6b: Split

**Phase 6a (Dataset + Analysis Planning)**:
1. AI reads synopsis objectives AND approved ROL content
2. AI determines **required analyses** per objective (driven by research questions, not just what's statistically possible)
3. Student reviews the analysis plan (can add/remove/modify)
4. Dataset uploaded OR AI generates synthetic dataset:
   - Numbers anchored to ROL-cited evidence (means, SDs, prevalence, effect sizes from prior studies)
   - Realistic mix of significant and non-significant results (not everything p < 0.05)
   - Plausible outliers and missing data patterns
5. Frontend displays `head()` (first 10-20 rows) for student review
6. Student approves dataset + analysis plan together

**Phase 6b (Results)**:
1. Execute approved analyses
2. Generate figures appropriate to each analysis
3. Generate tables (demographics + analysis-specific)
4. Generate Results chapter text incorporating all figures/tables with proper `\ref{}` cross-references

### 5.2 Demographics: AI-Planned Split

Demographics are NOT confined to a single Table 1 + single figure. AI logically splits across multiple tables and figures based on:
- Study design (case-control vs cohort vs cross-sectional)
- Number and type of variables
- Natural groupings (baseline demographics, clinical characteristics, group distributions)

Could produce 2-4 tables + 1-3 figures. All count toward the minimum thresholds.

### 5.3 Figure/Table QC Gates

| Check | Minimum | Scope |
|-------|---------|-------|
| Figures (Results) | 5 | Phase 6b QC + Final QC |
| Tables (Results) | 7 | Phase 6b QC + Final QC |
| Analysis plan match | Every planned figure/table must exist | Final QC |

Both the hard floor AND plan completeness are enforced. If the plan calls for 8 figures, having 5 passes the minimum but fails the plan-match check.

### 5.4 Phase 1→2 Identity Binding: Skipped

Current auth flow (licence attached to project, project owned by authenticated user) is sufficient. Not implementing candidate name hashing.

---

## 6. Privacy & Compliance

### 6.1 Medical Data Handling

- Warning banner at synopsis upload reminding students to anonymise patient data
- Lightweight AI scan flagging potential patient identifiers (names, MRNs, dates of birth) for student review before proceeding

### 6.2 Data Retention

Deferred to post-launch. Governance doc schedules (90-day AI conversations, 2-year audit logs) remain the target but implementation is not a launch blocker.

### 6.3 Account Deletion

7-day cooling-off period. Mark account for deletion, disable login, purge after 7 days. Student can contact support to cancel within the window.

---

## 7. Infrastructure

### 7.1 Inngest: Primary Orchestrator

Fix the content-overwrite bug and use Inngest as the primary orchestrator for:
- AI generation (background jobs with live preview)
- Compilation jobs
- Scheduled tasks (stale job cleanup, future retention purge)
- Phase transition workflows

### 7.2 Semaphore & Rate Limiter: Upstash Redis

Move from in-memory `Map` to Upstash Redis. Durable across restarts, shared across instances. Free tier covers the use case. Fixes the queue promotion bug.

### 7.3 Chart Options in UI

Expose **both** chart type AND colour scheme in the analysis wizard UI. Students can choose:
- Chart type (box plot vs violin, bar vs heatmap, etc.)
- Colour scheme (from a curated palette of professional academic options)

---

## 8. UI/UX

### 8.1 Mobile Pages

Responsive design is sufficient. No dedicated mobile-specific routes needed.

### 8.2 Notifications

Toast only (sonner). No persistent notification centre or Web Push.

### 8.3 Onboarding Tour

Wire up the existing `tour-overlay.tsx` component. Show on first visit to workspace. Walk through: editor, pipeline timeline, citation panel, compile button.

### 8.4 Export Access & Watermarks

| Context | Exports Available | Watermark/Branding |
|---------|-------------------|-------------------|
| **Sandbox** (Phase 0-2) | PDF download only | "Apollo" diagonal watermark in Playfair Display (bold, visible — marketing asset) |
| **Licensed, Phase 2–6a** | PDF preview panel only, no download | N/A |
| **Licensed, Phase 6b+** | Full export (PDF/DOCX/Source/Stats) | Small grey footer on every page: "Draft · Generated with Apollo" |
| **Completed thesis** | Full export | Completely clean — no branding |

### 8.5 Compilation History

Show last 3 compilations in the Progress tab (timestamp, status, warning count). Keep the full history API route for internal debugging.

### 8.6 Licence Transfer

Admin-only. No self-service transfer UI. Students contact support for edge cases.

### 8.7 Subfigure Support

Add `subcaption` LaTeX package. Meta-analysis forest + funnel plots combined as Figure X(a) and X(b). Applies to any future multi-panel figures.

### 8.8 User Settings Page

Deferred to post-launch. Clerk handles profile/password management.

---

*This document is the authoritative record of all product decisions. Implementation should reference this alongside `docs/PLAN.md` (architecture) and `docs/REVIEW.md` (gap analysis).*
