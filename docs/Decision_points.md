1. Pricing & Monetization                                                                           
                                                                                                     
  Q1. What are the correct prices? Three sources disagree:
  - Landing page: Rs 2,499/month (Student), Rs 4,999/month (Professional)
  - FAQ: Rs 2,499/month or Rs 14,999/6-month, Rs 4,999/month or Rs 24,999/lifetime
  - Actual checkout code: Rs 499/month (Student), Rs 999/month (Professional)

  Which set is the real pricing?

  Q2. Monthly subscriptions or one-time purchases? Currently all payments are one-time (mode:
  "payment" in Stripe), and licence expiry is not enforced. The "monthly" label is misleading. Do you
  want:
  - (a) Actual recurring subscriptions (Stripe/Razorpay subscription mode + cancellation handling)
  - (b) One-time per-thesis licences with a fixed validity window (e.g., 90 days)
  - (c) Keep as-is but rename to remove "monthly" branding

  Q3. Professional plan — what should it include? Currently Professional and Student licences are
  identical. What differentiation do you want?
  - How many licences per Professional purchase? (Advertised as 3, code provisions 1)
  - Which features are Professional-only? (Priority compile queue? Supervisor collaboration? Source
  LaTeX export? All of these?)
  - Should Professional target individual students or departments/guides?

  Q4. The "addon" plan (Rs 299) exists in the schema but is hidden from the checkout UI. Keep it,
  remove it, or make it visible?

  Q5. Sandbox free tier scope. Currently sandbox users can generate AI content for ALL 12 phases (they
   just can't approve past Phase 1). How much should be free?
  - (a) Phase 0 only (synopsis parsing)
  - (b) Phase 0-1 (synopsis + front matter)
  - (c) Phase 0-3 (through Aims & Objectives) — lets users see AI quality before paying
  - (d) All phases for generation, but limit total free token budget (e.g., 50K tokens)

  Q6. Project creation limit. Currently unlimited. What's the cap per user? (e.g., 3 sandbox,
  unlimited licensed?)

  ---
  2. Editor Architecture

  Q7. LaTeX round-trip problem — which approach? The Tiptap round-trip destroys inline math ($p <
  0.05$), \footnote{}, \url{}, \textsuperscript{}. Three options:

  - (a) Modified Option C (recommended in review): Make LaTeX canonical, use CodeMirror 6 as primary
  editor with syntax decorations, citation chips, math preview tooltips. Eliminates Tiptap/Novel
  entirely. Biggest change but cleanest long-term.
  - (b) Patch the round-trip: Add math, footnote, url, textsuperscript support to latexToTiptap() and
  tiptapToLatex(). Keeps Tiptap but grows complexity with every new LaTeX command.
  - (c) Dual-mode with separate storage: Keep both editors but store LaTeX and Tiptap JSON
  independently. User chooses mode at section level. Edits in one don't sync to the other.

  ---
  3. AI Pipeline

  Q8. Phase 9 (References) — AI-assisted or pure aggregation? Currently there's no Phase 9 prompt.
  Should AI review/consolidate the bibliography, or is BibTeX aggregation from all sections
  sufficient?

  Q9. AI-powered review. Currently reviewSection() is purely rule-based (regex checks). Should we add
  actual AI review (Claude evaluating content quality, knowledge gaps, logical flow) before approval?
  This would add cost per review.

  Q10. Model routing. PLAN specifies Opus for Introduction (Phase 2) and Discussion (Phase 7).
  Currently both branches return Sonnet 4.5. Do you want Opus for these two phases? (Higher quality
  but ~5x cost.)

  Q11. Previous section context truncation. Currently truncated to 3,000 chars (~500 words). For ROL
  (20,000+ chars), Discussion gets almost no ROL context. What limit do you want? Options:
  - (a) 8,000 chars (~1,300 words) — reasonable context without blowing up input tokens
  - (b) 15,000 chars (~2,500 words) — most of each section
  - (c) Full content, no truncation — highest quality but highest cost

  Q12. AI generation architecture. Current SSE stream requires sustained 30-90s connection (fragile on
   Indian 4G). Should we move to Inngest background jobs (already in package.json but unused)? This
  decouples the browser from generation — user can close the tab and come back.

  ---
  4. Word Count & QC Targets

  Q13. Word count targets disagree across 3 files. Which are canonical? Example conflicts:

  ┌──────────────┬────────────────────────────┬───────────────────────────────┬──────────────────────┐
  │    Phase     │      prompts.ts (AI        │  word-count-targets.ts (UI    │   final-qc.ts (QC    │
  │              │        instruction)        │             bar)              │        gate)         │
  ├──────────────┼────────────────────────────┼───────────────────────────────┼──────────────────────┤
  │ Introduction │ 700-1,200                  │ 750-1,200                     │ 500-750              │
  ├──────────────┼────────────────────────────┼───────────────────────────────┼──────────────────────┤
  │ ROL          │ 3,500-4,500                │ 3,000-5,000                   │ 2,000-3,000          │
  ├──────────────┼────────────────────────────┼───────────────────────────────┼──────────────────────┤
  │ Discussion   │ 2,000-3,000                │ 2,000-3,500                   │ 1,500-2,000          │
  └──────────────┴────────────────────────────┴───────────────────────────────┴──────────────────────┘

  Should I unify to the prompts.ts values (what the AI targets), or do you have specific ranges in
  mind?

  ---
  5. Phase Structure

  Q14. Phase 6a/6b separation. PLAN specifies Phase 6a (Dataset) and 6b (Results) as separate phases.
  Code collapses them into a single Phase 6. Currently users can generate Results without uploading a
  dataset. Do you want them separated, and should dataset upload be mandatory before Results
  generation?

  Q15. Phase 1→2 identity binding. PLAN specifies licence-to-user binding at Phase 1→2 transition
  (candidate name hash, etc.). Not implemented. Is this still required, or is the current licence
  attachment flow sufficient?

  ---
  6. Privacy & Compliance

  Q16. Medical data special handling. For case reports/case series that may contain patient data in
  synopses — how strict?
  - (a) Warning banner only at synopsis upload
  - (b) AI-powered PII scanner that flags potential patient identifiers and blocks until reviewed
  - (c) Require ethics committee approval number before Phase 2+

  Q17. Data retention schedules. The governance doc specifies 90-day purge for AI conversations and
  2-year for audit logs. Are these the schedules you want enforced? Any changes?

  Q18. Account deletion grace period. When a user requests account deletion, should there be a
  cooling-off period (e.g., 30 days) before permanent deletion, or immediate cascade delete?

  ---
  7. Infrastructure

  Q19. Inngest usage. Inngest is in package.json and has workflow definitions, but the review found it
   can overwrite auto-generated content (E1). Do you want to:
  - (a) Fix the Inngest workflows and use them as the primary pipeline orchestrator
  - (b) Remove Inngest and keep the current direct API-call approach
  - (c) Keep Inngest for background jobs only (compile, scheduled tasks) but not for phase transitions

  Q20. Descriptive analysis figures. R's descriptive endpoint produces Table 1 but no figure. Should
  we add a demographics histogram/bar chart alongside Table 1?

  ---
  These are the 20 decision points I found. Everything else in the review is a straightforward bug fix
   or security patch that doesn't require your input. Let me know your answers and I'll proceed with
  implementation.


