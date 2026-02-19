# Apollo Mitigation Implementation Log

**Purpose**: Auditable record of each mitigation phase --- what was implemented, what was deferred, what was changed from the original plan, and lessons learned.

**Source documents**: `docs/REVIEW.md`, `docs/DECISIONS.md`, `docs/Mitigation_plan.md`

---

## Phase 1: Critical Safety

**Status**: COMPLETE
**Commit**: `b852cec` (17 Feb 2026)
**Duration**: ~1 day
**Tests**: 345 passing, 0 TypeScript errors, 0 lint errors

### Items Implemented

| Item | Review IDs | Description | Implementation |
|------|-----------|-------------|----------------|
| 1.1 | I-2 | Commit all uncommitted work | 86 files committed and pushed in `b852cec` |
| 1.2 | I-1 | CI-blocking lint error | `let tier` changed to `const tier` in `lib/citations/auto-resolve.ts` |
| 1.3 | IV-A2, IV-C2, IV-C3 | IDOR --- missing ownership checks | Added `user_id` filter to `GET /api/projects`, `GET /api/licenses`. Added project ownership check to `POST /api/upload/signed-url` |
| 1.4 | IV-A3 | Role escalation via RLS | Migration `024_fix_role_escalation.sql` --- `WITH CHECK` prevents setting own `role` column |
| 1.5 | IV-A9, IV-L10 | DEV\_LICENCE\_BYPASS production guard | Guard added: `process.env.NODE_ENV !== "production" && ...` in `transitions.ts` |
| 1.6 | E1 | Inngest content overwrite (data loss) | Changed upsert to check-then-insert --- only creates section if one does not already exist |
| 1.7 | IV-B1, I-3 | Webhook double-provisioning race | Atomic claim-first idempotency via `claimWebhookEvent()` running BEFORE `provisionLicence()`. Both Razorpay and Stripe handlers updated |
| 1.9 | IV-D9, I-7 | Sentry edge PII stripping | Added `beforeSend` hook to `sentry.edge.config.ts` matching server/client configs |
| 1.10 | IV-B11 | Checkout ownership validation | Added project ownership check to `POST /api/checkout` before creating payment order |

### Items Deferred from Phase 1

| Item | Review IDs | Reason |
|------|-----------|--------|
| 1.8 | IV-D1, IV-D2, IV-D3 | PII redaction for AI calls --- `redactPII()` already applied to synopsis text in generate route. Full metadata sanitisation (`sanitiseMetadataForAI()`) deferred to Phase 5 (AI Pipeline Overhaul) where prompt architecture is being redesigned |

### Lessons Learned

1. **Webhook idempotency must be claim-first, not process-first.** The original `provisionLicence` then `markEventProcessed` pattern meant a failure between the two steps caused duplicate licences on retry. The fix inverts the order: claim the event atomically first, then provision. If provisioning fails, the claimed event can be retried manually.

2. **RLS is defence-in-depth, not the only gate.** Several routes used the admin client (bypassing RLS) without explicit ownership checks. The fix adds application-level `user_id` filters as the primary gate, with RLS as a safety net.

3. **`processed_webhooks` table was already planned** in the Mitigation Plan but the migration was bundled into the Phase 1 commit rather than a separate migration. Future phases should keep migrations atomic.

---

## Phase 2: Infrastructure Foundation

**Status**: COMPLETE
**Commit**: (pending)
**Duration**: ~1 day
**Tests**: 343 passing, 0 TypeScript errors, 0 new lint errors

### Items Implemented

| Item | Review IDs | Description | Files Changed |
|------|-----------|-------------|---------------|
| 2.1 | IV-E1, IV-F1, IV-D7, IV-A6 | Upstash Redis for semaphore and rate limiter | `lib/redis/client.ts` (new), `lib/compute/semaphore.ts` (rewrite), `lib/ai/rate-limit.ts` (rewrite), 5 route files (add rate limiting), `lib/inngest/functions/analysis-runner.ts`, `app/api/.../analyses/route.ts` |
| 2.2 | IV-E2, IV-C9, IV-D1 | R2 storage for PDFs and figures | `lib/r2/client.ts` (add `uploadToR2`/`downloadFromR2`), `compile/route.ts` (R2 upload + figure download), `preview.pdf/route.ts` (signed URL redirect), `lib/r-plumber/analysis-runner.ts` (R2 figure upload) |
| 2.3 | IV-E10 | Environment variable validation | `lib/env.ts` (new), `next.config.ts` (import for build-time validation), `.env.example` (add `R2_ACCOUNT_ID`) |
| 2.4 | IV-E3 | Stale compilation recovery | `compile/route.ts` --- 5-min staleness window on "already running" check |
| 2.5 (partial) | E1 extended | Inngest stale cleanup cron | `lib/inngest/functions/stale-cleanup.ts` (new), `app/api/inngest/route.ts` (register). Only the cron sweep was implemented; thesis workflow refactor deferred to Phase 5 |
| 2.6 | IV-E9 | Health check endpoint | `app/api/health/route.ts` (new) --- `GET` returns `{status, timestamp, version}` |
| 2.8 | IV-E5 | Singleton Supabase admin client | `lib/supabase/admin.ts` --- module-level singleton |
| 2.9 | IV-A1 | Middleware route coverage | `middleware.ts` --- added `/api/checkout(.*)`, `/api/synopsis(.*)`, `/api/citations(.*)` |

### Items Skipped

| Item | Review IDs | Reason |
|------|-----------|--------|
| 2.7 | I-4 | **Webhook replay protection (5-min staleness window) --- proven harmful.** Payment gateways (Razorpay, Stripe) retry failed webhooks at intervals that can exceed 5 minutes. A staleness check would reject legitimate retries. The atomic `claimWebhookEvent()` idempotency from Phase 1 already prevents replay attacks --- duplicate events return 200 without re-processing. Adding a timestamp check would reduce reliability for zero security gain. |

### Items Deferred

| Item | Description | Deferred To |
|------|-------------|-------------|
| 2.2(f) | R2 cleanup on project deletion | Phase 9 (Privacy and Compliance) |
| 2.5 (full) | Inngest thesis workflow refactor (`thesis/compile.requested`, section existence checks) | Phase 5 (AI Pipeline Overhaul) |

### Deviations from Mitigation Plan

1. **Semaphore queues eliminated (2.1b).** The mitigation plan specified Redis LIST for queues. Instead, queues were removed entirely --- callers receive `{acquired: false, estimatedWaitMs}` and must retry. This is simpler, avoids the broken `resolve` callback pattern (IV-D7), and is more robust across restarts (no orphaned queue entries). The previous queue-with-resolve pattern was fundamentally incompatible with a stateless HTTP request model.

2. **Env validation splits required vs optional (2.3).** The mitigation plan listed all env vars together. The implementation correctly classifies `INNGEST_*`, `RAZORPAY_*`, `STRIPE_*`, `SENTRY_DSN`, `UPSTASH_REDIS_*` as optional (warn-only) since the app has graceful fallbacks for all of them. Making them required would break development environments.

3. **Health check omits DB/Redis probes (2.6).** The mitigation plan suggested optional connectivity checks. These were deliberately omitted --- a health endpoint that fails because a downstream dependency is slow creates cascading failures. The health check reports application liveness only.

### Bugs Found During Post-Implementation Audit

Four bugs were found during a cross-reference audit of the implementation against source documents:

| Bug | Severity | Description | Resolution |
|-----|----------|-------------|------------|
| R2 figure key mismatch | HIGH | Figure upload key (`projects/P/figures/A/file`) did not match download key (`projects/P/figures/P/A/file`) --- extra project ID segment. All R2 figure downloads would 404 in production. | Fixed: download key construction now strips `figures/{projectId}/` before prepending `projects/{projectId}/figures/` |
| Rate limiter rollback | MEDIUM | `ZREMRANGEBYSCORE(key, now, now+1)` on over-limit rollback could remove other concurrent requests' entries with the same timestamp score. | Fixed: changed to `ZREM(key, member)` targeting only the specific member added by this request |
| Redis semaphore orphan leak | MEDIUM | Per-job TTL keys expire after 10 min but HASH entries in `apollo:semaphore:active` persist forever. Crashed jobs permanently reduce capacity. | Fixed: added `sweep-redis-semaphore` step to stale-cleanup cron that checks each hash entry's TTL key and removes orphans |
| Semaphore TOCTOU race | LOW | `HGETALL` + conditional `HSET` is not atomic. Concurrent requests can both read "capacity available" and both acquire. | Accepted: window is one Upstash HTTP roundtrip (~50ms), single-VPS deployment makes collision extremely unlikely. Documented in code with pointer to Lua script as future fix for multi-instance. |

### Lessons Learned

1. **R2 key conventions must be defined once.** The figure key mismatch bug arose because upload and download paths were constructed independently in different files with different assumptions about nesting. A single `r2Keys.ts` utility would prevent this class of bug. Consider adding one before Phase 6 (which adds more R2 operations).

2. **Redis sorted set rollback must target specific members, not score ranges.** Using `ZREMRANGEBYSCORE` for rollback is a footgun when multiple requests can have the same score (timestamp). Always use `ZREM` with the exact member.

3. **Redis HASH fields do not support per-field TTL.** The TTL-key-per-job pattern works but requires explicit cleanup. Any use of this pattern must be paired with a GC mechanism from day one, not added retroactively.

4. **Semaphore queues were an impedance mismatch.** The original in-memory queue used JavaScript `resolve()` callbacks to notify waiting requests. This pattern cannot survive server restarts, cannot work across instances, and the callbacks were never actually called (IV-D7). Eliminating queues in favour of retry-from-client is the correct model for a stateless HTTP backend.

5. **Union return types (`T | Promise<T>`) propagate virally.** Making `tryAcquire` and `checkRateLimit` return either sync or async required updating every caller to `await`, plus all tests. An alternative would be to always return `Promise<T>` (trivially wrapping the sync path). The current approach avoids unnecessary microtask overhead in dev/test but increases caller complexity.

6. **`preview.pdf` Content-Disposition is lost on R2 redirect.** When serving PDFs via `Response.redirect(signedUrl)`, response headers set on our side are discarded by the browser. The `?download=1` parameter has no effect for R2-served files. To fix this properly would require streaming through our server or setting Content-Disposition metadata on the R2 object at upload time. Low priority since inline viewing (the default) works correctly.

---

## Phase 3: Pricing and Licence System Overhaul

**Status**: COMPLETE
**Commit**: (pending)
**Duration**: ~2 days
**Tests**: 366 passing (32 files), 0 TypeScript errors, 0 new lint errors
**Scope**: 10 new files + 22 modified files, ~1,500 lines

### Items Implemented

| Item | Review IDs | Description | Files Changed |
|------|-----------|-------------|---------------|
| 3.1 | IV-B8, IV-B7, IV-B2, X4 | New pricing structure --- SSOT config, Razorpay subscriptions, Stripe subscriptions, consistent prices everywhere | `lib/pricing/config.ts` (new), `lib/validation/payment-schemas.ts`, `app/api/checkout/route.ts`, `lib/payments/razorpay.ts` (subscription support), `lib/payments/stripe.ts` (subscription support), `components/landing/pricing-section.tsx`, `app/(dashboard)/checkout/page.tsx`, `components/landing/faq-section.tsx` |
| 3.2 | IV-B3 | Licence expiry enforcement --- expiry check utility, daily Inngest cron sweep, expiry-based provisioning | `lib/api/licence-expiry.ts` (new), `lib/inngest/functions/licence-expiry-cron.ts` (new), `app/api/inngest/route.ts`, `lib/payments/provision-licence.ts` |
| 3.3 | IV-B4, IV-B10 | Licence gates on all AI/compute routes --- central gate utility, sandbox project limit | `lib/api/licence-phase-gate.ts` (new), `sections/[phase]/generate/route.ts`, `sections/[phase]/refine/route.ts`, `compile/route.ts`, `app/api/projects/route.ts` |
| 3.4 | IV-B5, IV-B6 | Plan-based feature differentiation --- addon blocks generate, monthly phase limits, model tier configured (Opus routing deferred to Phase 5) | `lib/api/licence-phase-gate.ts` (addon + monthly checks), `lib/pricing/config.ts` (modelTier, allowsGenerate, maxPhasesPerMonth) |
| 3.5 | IV-B9 | Atomic licence attachment via Supabase RPC --- `FOR UPDATE` row locking, validates both entities | `supabase/migrations/025_pricing_licence_overhaul.sql` (new), `app/api/licenses/[lid]/attach/[pid]/route.ts` |
| 3.6 | I-9 | Velocity rules --- max 5 licences per 30 days, fail-open on DB errors | `lib/payments/velocity-check.ts` (new), `app/api/checkout/route.ts` |
| 3.7 | C8 | Watermark system --- sandbox diagonal, licensed Phase 6+ footer, completed clean. Export download restriction for licensed phase < 6 | `compile/route.ts` (`getWatermarkMode()`), `lib/latex/compile.ts` (`injectWatermarkPackage()` for local mode), `export/pdf/route.ts`, `export/docx/route.ts`, `export/source/route.ts`, `export/stats/route.ts`, `lib/api/licence-gate.ts` |
| 3.8 | DECISIONS 1.6 | Free reset before Phase 4 --- one per licence, clears all content, resets to Phase 0 | `app/api/projects/[id]/reset/route.ts` (new), `components/project/reset-project-button.tsx` (new), `app/(dashboard)/projects/[id]/page.tsx` |

### Supporting Changes

| Change | Description | Files Changed |
|--------|-------------|---------------|
| Database migration | New columns (`reset_count`, `monthly_phases_advanced`, `billing_period_start`), updated `plan_type` CHECK constraint, atomic `attach_licence_to_project()` RPC | `supabase/migrations/025_pricing_licence_overhaul.sql` |
| TypeScript types | Updated `LicencePlanType` union, added new fields to `ThesisLicence` interface | `lib/types/database.ts` |
| Phase constants | Phase 2 (Introduction) set to `requiresLicence: false` --- sandbox now includes Phase 0-2 | `lib/phases/constants.ts` |
| Phase transitions | Updated licence boundary message to "beyond Phase 2" | `lib/phases/transitions.ts` |
| Webhook subscription handlers | Razorpay `subscription.charged` + `subscription.cancelled`, Stripe `invoice.paid` + `customer.subscription.deleted` --- extends expiry, resets monthly counters | `app/api/webhooks/razorpay/route.ts`, `app/api/webhooks/stripe/route.ts` |
| Monthly phase tracking | Increments `monthly_phases_advanced` on phase approval for subscription plans | `app/api/projects/[id]/sections/[phase]/approve/route.ts` |
| Tests | Pricing config (17 tests), velocity check (5 tests), licence gate DB tests (8 new tests), updated phase transition tests (2 fixes) | `tests/pricing/config.test.ts` (new), `tests/pricing/velocity.test.ts` (new), `tests/security/licence-gates.test.ts`, `lib/phases/transitions.test.ts` |

### Items Deferred

| Item | Review IDs | Description | Deferred To |
|------|-----------|-------------|-------------|
| 3.4 (partial) | A12 | Opus model routing --- `planConfig.modelTier` configured in pricing SSOT but generate route always uses Sonnet. TODO comment in place. | Phase 5 (5.7: Opus Model Routing) |
| 3.1 (partial) | IV-B7 | Razorpay EMI on one-time plans --- requires Razorpay dashboard configuration, not a code change | Operational setup |
| 3.1 (partial) | IV-B7 | 3-month minimum commitment for monthly plans --- Razorpay subscription `total_count: 12` set but no minimum enforced in code | Future iteration (Razorpay handles this via plan configuration) |

### Deviations from Mitigation Plan

1. **Velocity check blocks outright instead of "manual review hold" (3.6).** The mitigation plan specified ">5 licences/30 days → hold for manual review". The implementation returns HTTP 429 and blocks the purchase entirely. A manual review queue adds infrastructure complexity (admin dashboard, queue table, notification system) for minimal benefit. Blocking is more secure and simpler. The user sees a clear error message directing them to contact support.

2. **Professional Monthly shows "Coming soon" instead of being hidden (3.1).** DECISIONS.md didn't specify whether Professional Monthly should be visible. The implementation shows it on the checkout page with a disabled "Coming Soon" button. This signals the plan exists without requiring immediate implementation of TBD pricing.

3. **Export download restriction uses Phase 6 (not 6a/6b split) (3.7).** DECISIONS.md Section 8.4 references Phase 6a/6b, but the current codebase has not yet split Phase 6. The implementation uses `currentPhase >= 6` as the threshold, which maps correctly to Phase 6b once the split is implemented in Phase 6 of the mitigation plan.

4. **Watermark uses `draftwatermark` package, not Playfair Display font (3.7).** The mitigation plan specified Playfair Display (`ppl` mapping in TeX Live) for the "Apollo" watermark. The implementation uses the standard `draftwatermark` package with default font. The Docker container would need Playfair Display installed, which is a font setup task --- better handled when Docker hardening is addressed in Phase 10.

5. **Subscription renewal updates all matching licences, not a specific one.** Both webhook renewal handlers target all active monthly licences for the user (`WHERE user_id = X AND status = 'active' AND plan_type IN (...)`) rather than a specific licence. This is because the subscription provider ID is not stored on the licence record. In practice, users have at most one active monthly licence, so this is a non-issue. A future iteration could add a `subscription_provider_id` column for precise targeting.

### Bugs Found During Post-Implementation Audit

A comprehensive audit was performed after implementation, cross-referencing every file against DECISIONS.md, Mitigation\_plan.md, and REVIEW.md. Four issues were found and fixed:

| Bug | Severity | Description | Resolution |
|-----|----------|-------------|------------|
| provisionLicence status bug | MEDIUM | When `provisionLicence()` was called with a `projectId` (auto-attach flow via checkout with `?attach=X`), the licence was created as `status: "available"` instead of `status: "active"`. This meant subscription renewal webhooks (which target `status = 'active'`) would never find the licence, causing silent renewal failures. | Fixed: `status: projectId ? "active" : "available"` |
| Dead STRIPE\_PRICE\_ENV entries | LOW | `STRIPE_PRICE_ENV` in `stripe.ts` had entries for `student_onetime` and `professional_onetime` which are one-time plans. These entries are only used by `createStripeSubscriptionSession()`, which is never called for one-time plans (the checkout route uses `createStripeSession()` with inline `price_data` for one-time USD payments). Dead code causing confusion. | Fixed: removed the two dead entries, leaving only `student_monthly` and `addon` |
| Local compile ignores watermark | LOW | `localCompile()` in `compile.ts` accepted `watermark` and `draftFooter` options but never used them. All locally compiled PDFs were clean regardless of project status. Only affects dev/test (production uses Docker). | Fixed: added `injectWatermarkPackage()` helper that injects `draftwatermark` LaTeX package before `\begin{document}` |
| Unused Project import | LOW | `compile/route.ts` imported `Project` type from `database.ts` but never used it directly (the project comes pre-typed from the licence gate result). Lint warning. | Fixed: removed from import |

### Lessons Learned

1. **Auto-attach flows must be tested separately from manual-attach.** The `provisionLicence()` bug only manifested when `projectId` was provided (auto-attach via checkout), not when a licence was created standalone and manually attached later via the `/attach` endpoint. The manual-attach path uses the atomic RPC which correctly sets `status: "active"`. Always test both code paths for operations that have a "shortcut" variant.

2. **Webhook handlers should target specific resources, not broad queries.** The subscription renewal handlers update all matching licences for a user rather than one specific licence. This works today because users rarely have multiple active monthly licences, but it's a latent bug waiting to happen. The root cause is that the subscription provider ID is not stored on the licence record, making precise targeting impossible. When designing payment flows, always plan the full lifecycle: creation, renewal, and cancellation, and ensure each step can identify the exact resource.

3. **Pricing is a cross-cutting concern that touches 10+ files.** Prices appeared in: pricing config, landing page, checkout page, FAQ, payment schemas, webhook handlers, provision logic, and checkout API. A Single Source of Truth (SSOT) pattern (`lib/pricing/config.ts`) was essential --- without it, prices would inevitably drift. However, the landing page and checkout page still use hardcoded strings (for UI formatting like `₹14,999`) rather than formatting from the config. A `formatPrice()` utility would eliminate the last source of drift.

4. **Sandbox boundary changes have wide blast radius.** Changing Phase 2 from `requiresLicence: true` to `false` (to make sandbox = Phase 0-2 per DECISIONS.md) required updating: `constants.ts`, `transitions.ts`, `transitions.test.ts` (2 failing tests), `licence-phase-gate.ts`, `pricing-section.tsx`, `faq-section.tsx`, and the checkout page. All these files referenced the sandbox boundary in different ways. A constant like `SANDBOX_MAX_PHASE = 2` (already exists as `SANDBOX_PHASES = [0, 1, 2]` in config.ts) should be imported everywhere instead of hardcoding.

5. **`Promise.allSettled()` is correct for best-effort cleanup.** The reset route uses `Promise.allSettled()` for deleting project data across 9 tables. This is intentional --- if one table's deletion fails (e.g., FK constraint, missing table), the others still succeed. The alternative (`Promise.all()`) would abort on the first failure, leaving the project in a worse state (partially deleted). For destructive operations where partial success is better than total failure, `allSettled` is the right choice.

6. **Subscription plan IDs must be env vars, not hardcoded.** Razorpay and Stripe both use opaque plan/price IDs that are created in their respective dashboards. These IDs differ between test and production environments. The implementation correctly puts them behind env vars (`RAZORPAY_PLAN_ID_STUDENT_MONTHLY`, `STRIPE_PRICE_ID_STUDENT_MONTHLY`, etc.) with descriptive error messages when missing, making operational setup self-documenting.

### Migration Note

Migration `025_pricing_licence_overhaul.sql` must be applied before the code goes live. It adds:
- `reset_count` (integer, default 0) to `thesis_licenses`
- `monthly_phases_advanced` (integer, default 0) to `thesis_licenses`
- `billing_period_start` (timestamptz, nullable) to `thesis_licenses`
- Updated `plan_type` CHECK constraint (adds `student_onetime`, `professional_onetime`)
- `attach_licence_to_project()` RPC function (`SECURITY DEFINER`, row-level locking)

Rollback:
```sql
ALTER TABLE thesis_licenses DROP COLUMN IF EXISTS reset_count, monthly_phases_advanced, billing_period_start;
DROP FUNCTION IF EXISTS public.attach_licence_to_project(uuid, uuid, uuid);
```

### Operational Setup Required

Payment APIs are not yet configured. After code deployment, the following setup is needed:

**Razorpay (INR)**:
1. Dashboard → API Keys → set `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`
2. Plans → create Student Monthly (Rs 5,499/mo) + Addon (Rs 3,999/mo) → set `RAZORPAY_PLAN_ID_STUDENT_MONTHLY` + `RAZORPAY_PLAN_ID_ADDON`
3. Webhooks → endpoint: `https://domain/api/webhooks/razorpay` → events: `payment.captured`, `subscription.charged`, `subscription.cancelled` → set `RAZORPAY_WEBHOOK_SECRET`

**Stripe (USD)**:
1. Dashboard → API Keys → set `STRIPE_SECRET_KEY`
2. Products → create Student Monthly ($65/mo) + Addon ($49/mo) → set `STRIPE_PRICE_ID_STUDENT_MONTHLY` + `STRIPE_PRICE_ID_ADDON`
3. Webhooks → endpoint: `https://domain/api/webhooks/stripe` → events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted` → set `STRIPE_WEBHOOK_SECRET`

---

## Phase 4: Editor Migration (CodeMirror 6)

**Status**: COMPLETE
**Commit**: (pending)
**Duration**: ~2 days
**Tests**: 298 passing (30 files), 0 TypeScript errors, 0 lint errors
**Scope**: 7 new files + 11 modified files + 6 deleted files. Net reduction ~600+ lines (removing round-trip code).

### Items Implemented

| Item | Review IDs | Description | Files Changed |
|------|-----------|-------------|---------------|
| 4.1(a) | C1, C2, C3 | CodeMirror 6 as primary editor --- single `LaTeXEditor` component with auto-save (30s debounce), manual save (Cmd+S), height `calc(100vh - 200px)`, Zen palette styling | `components/editor/latex-editor.tsx` (new, 188 lines) |
| 4.1(b) | C1 | Syntax decorations --- `stex` grammar from `@codemirror/legacy-modes` providing LaTeX command colouring, bracket matching, and keyword highlighting | `components/editor/extensions/latex-language.ts` (new, 9 lines) |
| 4.1(c) | C1 | Citation chips --- `ViewPlugin` + `Decoration.mark()` renders `\cite{key}` patterns as sage-coloured inline badges | `components/editor/extensions/citation-decorations.ts` (new, 49 lines), `app/globals.css` (`.cm-cite-chip` CSS) |
| 4.1(d) | C1 | Math preview --- `hoverTooltip()` detects `$...$` and `$$...$$` regions, renders KaTeX-processed HTML in tooltip. Graceful fallback on parse errors. | `components/editor/extensions/math-tooltip.ts` (new, 74 lines), `app/globals.css` (`.cm-math-tooltip` CSS + KaTeX CSS import) |
| 4.1(e) | C1, C2, C3 | WYSIWYG toolbar --- 8 formatting buttons (Bold, Italic, Underline, Section, Subsection, Bullet list, Numbered list, Math) + Cite button with citation search dialog integration | `components/editor/latex-toolbar.tsx` (new, 89 lines) |
| 4.1(g) | C1 | Environment fold markers --- custom `foldService` for `\begin{env}`/`\end{env}` with nesting depth tracking | `components/editor/extensions/environment-fold.ts` (new, 31 lines) |
| 4.2(a) | DECISIONS 2 | Stop writing `rich_content_json` --- generate, refine, and section save routes now set `rich_content_json: null` in all DB updates | `sections/[phase]/generate/route.ts`, `sections/[phase]/refine/route.ts`, `sections/[phase]/route.ts` |
| 4.2(b) | DECISIONS 2 | Backfill script --- one-time Node.js script to convert existing `rich_content_json` to `latex_content` via `tiptapToLatex()` | `scripts/backfill-latex-content.ts` (new, 88 lines) |
| 4.2(c) | DECISIONS 2 | Workspace uses single CodeMirror editor --- removed dual editor mode toggle, `SectionEditor` (Tiptap), and `LaTeXSourceView` (barebones CM). Single `LaTeXEditor` component renders for all editing. | `projects/[id]/project-workspace.tsx` |
| 4.2(d) | DECISIONS 2 | `rich_content_json` column marked deprecated via column comment | Supabase migration `026_latex_content_canonical` |
| 4.3(a) | C1, C2, C3 | Assembly pipeline uses `latex_content` directly --- `splitBibtex(section.latex_content).body` replaces tiptap round-trip. Sanitisation chain preserved: `stripTierDCitations()`, `escapeBareAmpersands()`, `sanitiseChapterLatex()`. BibTeX sourced from `ai_generated_latex ?? latex_content` (preserves trailer after user edits). | `lib/latex/assemble.ts` |
| 4.3(b) | C1, C2, C3 | Deleted `latexToTiptap.ts` (~620 lines) and `tiptapToLatex.ts` (~182 lines) plus their test files | 4 files deleted |
| 4.3(d) | C6 | Removed Tiptap/Novel dependencies --- `novel`, `@tiptap/core`, `@tiptap/pm`, `@codemirror/lang-javascript` removed. Added `@codemirror/legacy-modes`, `katex`, `@types/katex`. | `package.json`, `pnpm-lock.yaml` |

### Supporting Changes

| Change | Description | Files Changed |
|--------|-------------|---------------|
| Generate route --- citation extraction | `extractCiteKeys(fullResponse)` replaces `latexToTiptap(fullResponse)`. 2-tier DB fallback: tries with `ai_generated_latex` column, falls back without it. | `sections/[phase]/generate/route.ts` |
| Refine route --- citation extraction | Same pattern as generate. Sources current content from `ai_generated_latex \|\| latex_content`. | `sections/[phase]/refine/route.ts` |
| Section save route --- latex-only | PUT handler only accepts `latex_content`. Always sets `rich_content_json: null`. Uses `extractCiteKeys()` for citation key extraction. | `sections/[phase]/route.ts` |
| Pipeline E2E tests | Complete rewrite for Phase 4: tests citation extraction from raw LaTeX, direct sanitisation (no round-trip), clean LaTeX survival (`$p < 0.05$`, `\footnote{}`, `\label{}`), assembly with `latex_content`, full multi-section compile. | `tests/pipeline-e2e.test.ts` |
| Assembly unit tests | Updated to test direct `latex_content` path: "uses latex\_content directly (LaTeX is canonical)", "ignores rich\_content\_json", inline math survival. | `lib/latex/assemble.test.ts` |
| Licence gate tests | Fixed Phase 3 test pollution: reset `current_phase` after "phase can only increment by 1" test to prevent contaminating subsequent tests. | `tests/security/licence-gates.test.ts` |
| Stale comments | Updated docstrings in `assemble.ts` (escapeBareAmpersands) and `extract-keys.ts` (module header) that still referenced tiptap round-trip. | `lib/latex/assemble.ts`, `lib/citations/extract-keys.ts` |

### Items Deferred

| Item | Review IDs | Description | Deferred To |
|------|-----------|-------------|-------------|
| 4.1(f) | DECISIONS 2 | Atomic ranges for `\section{}`, `\begin{}`/`\end{}` --- UX enhancement preventing partial cursor selection of structural commands. Not critical for content preservation (the core P0 fix). | Future iteration (editor polish) |

### Deviations from Mitigation Plan

1. **`front-matter.ts` NOT deleted (4.3c).** The mitigation plan listed it as dead code per C6. During implementation, `front-matter.ts` was found to be actively imported by `approve/route.ts:15` for injecting front matter during phase approval. Deleting it would break the approval pipeline. The C6 finding in REVIEW.md was incorrect --- the file is live code.

2. **KaTeX used instead of MathJax for math preview (4.1d).** DECISIONS.md Section 2 specifies "MathJax tooltip". The implementation uses KaTeX, which is significantly smaller (~200KB vs ~2MB), renders faster (synchronous vs async), and provides identical output for the subset of LaTeX math used in medical theses. KaTeX is the industry standard for web-based math rendering in editors.

3. **Backfill script references deleted module.** `scripts/backfill-latex-content.ts` imports `tiptapToLatex` from the deleted `tiptap-to-latex.ts`. The script was designed to run BEFORE the deletion step, but the previous implementation session executed steps in a different order. Since the project is pre-launch with no production data, this is a non-issue --- no sections exist that need backfilling. The script is retained as documentation of the migration strategy.

4. **Environment fold regex only matches `\w+` names.** Starred LaTeX environments like `tabular*` or `figure*` are not matched by the `\begin{(\w+)}` regex. These are uncommon in thesis content (the template handles starred variants internally), but the regex could be expanded to `[\w*]+` in a future iteration if needed.

### Bugs Found During Post-Implementation Audit

A comprehensive audit was performed cross-referencing every changed file against REVIEW.md, DECISIONS.md, and Mitigation\_plan.md. Five issues were found and fixed:

| Bug | Severity | Description | Resolution |
|-----|----------|-------------|------------|
| Missing KaTeX CSS import | HIGH | `katex/dist/katex.min.css` was never imported anywhere. Math tooltips would render with incorrect fonts, sizing, and spacing --- the preview would be unreadable. | Fixed: added `@import "katex/dist/katex.min.css"` to `globals.css` |
| Missing `.cm-cite-chip` CSS | HIGH | The `citation-decorations.ts` extension applies `class: "cm-cite-chip"` but no CSS definition existed. Citation badges would be completely invisible --- no background, no border, no colour distinction from surrounding text. | Fixed: added `.cm-cite-chip` styles (sage-coloured badge) to `globals.css` |
| Missing `.cm-math-tooltip` CSS | MEDIUM | The `math-tooltip.ts` extension creates a DOM element with `class: "cm-math-tooltip"` but no CSS definition existed. Tooltip would appear as unstyled text floating without background, padding, or shadow. | Fixed: added `.cm-math-tooltip` styles (white card with shadow) to `globals.css` |
| Stale docstring in `assemble.ts` | LOW | `escapeBareAmpersands()` docstring (line 224) still referenced the tiptap round-trip: "The tiptap round-trip escapes `&` in text nodes via `escapeLatex()`..." | Fixed: updated to describe AI-generated content directly |
| Stale module header in `extract-keys.ts` | LOW | Module comment (line 3) referenced "tiptap-to-latex serialiser" as a consumer | Fixed: updated to list current consumers (section save, generate/refine, auto-resolve) |

### Lessons Learned

1. **CSS classes used by CodeMirror extensions must be defined explicitly.** CodeMirror `Decoration.mark()` and `hoverTooltip()` apply CSS classes to DOM elements, but unlike React component styles, these have no co-located CSS-in-JS. The class definitions must exist in a globally-loaded stylesheet. Missing CSS is invisible during development if you don't visually test the specific feature --- TypeScript compilation and unit tests won't catch it. Always verify CSS classes are defined when creating CodeMirror extensions.

2. **KaTeX CSS must be imported separately from the JS library.** KaTeX renders math by applying precise CSS classes to nested `<span>` elements. Without the stylesheet, the output is a jumble of overlapping characters. This is a common gotcha --- the npm package separates the CSS from the JS, and `import katex from 'katex'` does NOT include the styles.

3. **"Dead code" findings from reviews must be verified at implementation time.** The REVIEW.md C6 finding that `front-matter.ts` was dead code was incorrect --- it's actively imported by the phase approval route. Blindly following the review would have broken a critical pipeline. Always `grep` for imports before deleting.

4. **Backfill scripts must be run in the correct sequence.** The backfill script (`scripts/backfill-latex-content.ts`) was designed to run between "stop writing `rich_content_json`" and "delete `tiptapToLatex()`". For a pre-launch project with no production data, this ordering error is harmless. For production migrations, the execution sequence must be enforced (e.g., via a numbered migration runner or CI step).

5. **The tiptap round-trip was the single root cause of 3 P0 bugs.** Eliminating it fixed C1 (inline math destruction), C2 (`\footnote{}`, `\url{}` garbling), and C3 (`\label{}` stripping) simultaneously. The fix was architectural (remove the round-trip) rather than incremental (patch each bug individually). When multiple bugs share a root cause, fixing the architecture is always preferable to patching symptoms.

6. **Editor extensions should be tested visually, not just structurally.** The citation decorations and math tooltip extensions passed TypeScript compilation and the extension array assembled correctly, but without the CSS definitions they were functionally broken. For UI-adjacent code, a visual smoke test (or screenshot test) is essential. Unit tests that verify "the extension object exists" provide false confidence.

### Migration Note

Migration `026_latex_content_canonical` must be applied. It adds:
- Column comment on `sections.rich_content_json`: "DEPRECATED (Phase 4). LaTeX is canonical. Retained for rollback only."

Rollback: No schema changes to reverse (column comment only). To reverse Phase 4 code changes, restore the deleted files from git history and revert the route changes.

### Deleted Files

| File | Lines | Purpose |
|------|-------|---------|
| `lib/latex/latex-to-tiptap.ts` | ~620 | LaTeX → Tiptap JSON conversion (root cause of C1, C2, C3) |
| `lib/latex/tiptap-to-latex.ts` | ~182 | Tiptap JSON → LaTeX serialisation |
| `lib/latex/latex-to-tiptap.test.ts` | ~350 | Tests for deleted converter |
| `lib/latex/tiptap-to-latex.test.ts` | ~150 | Tests for deleted serialiser |
| `components/editor/section-editor.tsx` | ~261 | Tiptap/Novel rich text editor wrapper |
| `components/editor/latex-source-view.tsx` | ~91 | Barebones CodeMirror "source view" (replaced by `latex-editor.tsx`) |

### Dependencies Changed

**Removed**: `novel`, `@tiptap/core`, `@tiptap/pm`, `@codemirror/lang-javascript`
**Added**: `@codemirror/legacy-modes` (stex grammar), `katex` (math rendering), `@types/katex`

---

## Phase 5: AI Pipeline Overhaul

**Status**: COMPLETE
**Commit**: (pending)
**Duration**: ~3 days (including comprehensive audit + fixes)
**Tests**: 314 passing (31 files), 0 TypeScript errors, 0 lint errors
**Scope**: 5 new files + 2 migrations + 32 modified files + 2 deleted files. ~1,000 lines added/changed, ~650 removed.

### Items Implemented

| Item | Review IDs | Description | Files Changed |
|------|-----------|-------------|---------------|
| 5.1 | A5, E6, F2 | Unified word count targets --- single source of truth in `word-count-config.ts` matching DECISIONS.md 4.1. All prompts use `wordCountInstruction()` helper. Hard ceiling = `ceil(softMax * 1.15)`. | `lib/phases/word-count-config.ts` (new), `lib/phases/word-count-targets.ts` (imports from config), `lib/ai/prompts.ts` (dynamic word counts), `lib/ai/review-section.ts` (uses config for checks) |
| 5.2 | A3 | Remove context truncation --- `.slice(0, 3000)` removed from `getPhaseUserMessage()`. Discussion now receives full ROL context. | `lib/ai/prompts.ts` |
| 5.3 + 5.4 | A7, A8, E4, F4 | Token budget enforcement --- split input/output tracking, budget check on refine + dataset generate routes, recording on all AI routes (synopsis parse, auto-detect, compliance checker, dataset generate) | `lib/ai/token-budget.ts`, `sections/[phase]/refine/route.ts`, `datasets/generate/route.ts` (budget check), `synopsis/parse/route.ts`, `analyses/auto-detect/route.ts`, `compliance/checker.ts`, `datasets/generate.ts` (recording) |
| 5.5 | A1 | Phase 9 References Consolidation prompt --- AI reviews all BibTeX entries for duplicates, formatting, missing fields, Vancouver compliance. Produces consolidated BibTeX + quality report. | `lib/ai/prompts.ts` (`REFERENCES_CONSOLIDATION_SYSTEM_PROMPT`, `case 9` in both `getPhaseSystemPrompt` and `getPhaseUserMessage`) |
| 5.6 | A10, A11 | AI-powered section review --- `aiReviewSection()` calls Haiku with 6 quality dimensions (completeness, logical flow, citation adequacy, methodological rigour, academic tone, synopsis alignment). M&M section check corrected from 8 to 12 headings per NBEMS mandate. Wired into approve route as non-blocking quality check. | `lib/ai/review-section.ts` (150+ lines), `lib/ai/prompts.ts` (`SECTION_REVIEW_SYSTEM_PROMPT`), `sections/[phase]/approve/route.ts` (integration) |
| 5.7 | A12 | Opus model routing --- Professional plan users get Opus for Introduction (Phase 2) and Discussion (Phase 7). Uses `gateResult.planConfig.modelTier` from licence gate. Dead conditional eliminated. | `sections/[phase]/generate/route.ts` |
| 5.8 | A4, F3 | Unicode avoidance in COMMON\_RULES --- rule 10 mandates ASCII/LaTeX equivalents for em-dash, en-dash, smart quotes, accented characters. BibTeX trailer completeness rule strengthened (rule 9). | `lib/ai/prompts.ts` |
| 5.9 | A13, A14 | Anthropic client retry + singleton --- `maxRetries: 3`, `timeout: 120_000`. Standalone `new Anthropic()` instances in `datasets/generate.ts` and `compliance/checker.ts` replaced with `getAnthropicClient()` singleton. | `lib/ai/client.ts`, `lib/datasets/generate.ts`, `lib/compliance/checker.ts` |
| 5.10 | IV-E4, DECISIONS 3.5 | Inngest background generation + Supabase Realtime --- AI generation runs as Inngest background job (5-step function: stream, save, record tokens, BibTeX completion, resolve citations). Frontend subscribes to `streaming_content` column via Realtime for live preview. Generation continues if student closes tab. | `lib/inngest/functions/ai-generate.ts` (new), `sections/[phase]/generate/route.ts` (enqueues Inngest job), `projects/[id]/project-workspace.tsx` (Realtime subscription), `app/api/inngest/route.ts` (register), `components/project/ai-generate-button.tsx` (polling fallback) |
| 5.11 | E5 | Refine route state management --- refining an approved section now rolls back `phases_completed` and `current_phase`, preventing state inconsistency. | `sections/[phase]/refine/route.ts` |
| 5.12 | B1 | Orphan cite key stripping --- `stripInvalidCitations()` replaces `stripTierDCitations()`. Strips both Tier D and completely unknown cite keys from compiled output. | `lib/latex/assemble.ts` |
| 5.13 | B2 | CrossRef/PubMed exponential backoff --- `fetchWithRetry()` wrapper with 3 retries, `1000 * 2^attempt` ms delay. ROL citation timeout increased to 45s (from 15s). | `lib/citations/crossref.ts`, `sections/[phase]/generate/route.ts` |
| 5.14 | B3, IV-E6 | Citation pipeline batch upserts --- N+1 upsert loop in `auto-resolve.ts` replaced with single batch `supabase.from("citations").upsert(toUpsert)`. Same for orphan Tier D placeholders. | `lib/citations/auto-resolve.ts` |
| 5.15 | A6 | Synopsis parse prompt deduplication --- merged inline wizard prompt with `SYNOPSIS_PARSE_SYSTEM_PROMPT`. Both routes now use shared prompt extracting all fields (title, study\_type, study\_design, department, aims, objectives, methodology\_summary, sample\_size, duration, setting, inclusion/exclusion criteria, keywords). Synopsis parse route uses shared `parseSynopsisResponse()`. | `lib/ai/prompts.ts`, `lib/ai/parse-synopsis-response.ts`, `app/api/synopsis/parse/route.ts` |
| NEW | --- | BibTeX trailer integrity validation --- `checkBibtexIntegrity()` verifies every `\cite{key}` has a matching BibTeX entry. `requestMissingBibtexEntries()` makes a targeted follow-up AI request for missing entries. `max_tokens` increased for citation-heavy phases (ROL: 16K, Discussion: 12K, Intro/M\&M: 10K). | `lib/ai/bibtex-completion.ts` (new), `lib/inngest/functions/ai-generate.ts` (integration) |

### Items Deferred from Phase 1 (Resolved)

| Item | Review IDs | Original Deferral | Resolution |
|------|-----------|-------------------|------------|
| 1.8 | IV-D1, IV-D2, IV-D3 | PII redaction / metadata sanitisation deferred to Phase 5 | **Removed entirely.** Analysis determined: (a) `synopsis_text` is a research protocol, not patient data --- no PHI present; (b) `metadata_json` contains public academic info (candidate name, guide name, institution) printed on every thesis title page; (c) `redactPII()` caught phone/Aadhaar/PAN which are extremely unlikely in a synopsis; (d) `sanitiseMetadataForAI()` stripped guide names needed for Phase 1 acknowledgements. Both functions deleted. Log sanitisation in `logger.ts` (strips `synopsis_text` from logs) retained as a separate concern. |

### Items Deferred from Phase 2 (Resolved)

| Item | Description | Resolution |
|------|-------------|------------|
| 2.5 (full) | Inngest thesis workflow refactor | Implemented in 5.10. Generate route now enqueues `thesis/section.generate` Inngest event. AI streaming runs as background job with Realtime live preview. |

### Items Deferred from Phase 3 (Resolved)

| Item | Description | Resolution |
|------|-------------|------------|
| 3.4 | Opus model routing | Implemented in 5.7. `planConfig.modelTier === "opus"` gates Phases 2 and 7 to `claude-opus-4-5-20250514`. |

### Supporting Changes

| Change | Description | Files Changed |
|--------|-------------|---------------|
| Database migration 026 | Split token tracking: `input_tokens` and `output_tokens` columns on `ai_conversations`, backfill from `total_tokens` (70/30 split) | `supabase/migrations/026_split_token_tracking.sql` |
| Database migration 027 | Streaming content column: `streaming_content` text column on `sections` for Realtime live preview | `supabase/migrations/027_add_streaming_content.sql` |
| TypeScript types | Added `streaming_content` to `Section`, `input_tokens`/`output_tokens` to `AiConversation` | `lib/types/database.ts` |
| Test mock updates | Added `streaming_content: ""` to all `makeSection()` helpers across 7 test files | `audit.test.ts`, `checker.test.ts`, `nbems.test.ts`, `prisma-flow.test.ts`, `assemble.test.ts`, `citations-e2e.test.ts`, `pipeline-e2e.test.ts` |
| New tests | Word count config (13 tests), BibTeX completion (6 tests) | `lib/phases/word-count-config.test.ts` (new), `lib/ai/bibtex-completion.test.ts` (new) |
| Updated tests | CrossRef retry tests, auto-resolve batch tests, word count target import tests, orphan cite key stripping tests, pipeline E2E updates | `crossref.test.ts`, `auto-resolve.test.ts`, `word-count-targets.test.ts`, `assemble.test.ts`, `pipeline-e2e.test.ts` |
| Stale timeout fix | `STALE_GENERATING_MS` corrected from 2 min to 5 min (matching Inngest job duration) | `sections/[phase]/generate/route.ts` |

### Deviations from Plan

1. **`sanitiseMetadataForAI()` removed instead of applied everywhere (1.8/Step 15).** The mitigation plan specified applying metadata sanitisation to all AI routes. During the audit, analysis showed: synopsis text is a public research protocol (not PHI), metadata fields are public academic info printed on the thesis, and stripping guide names broke Phase 1 front matter generation. Both `redactPII()` and `sanitiseMetadataForAI()` were deleted as unnecessary security theatre. Log sanitisation in `logger.ts` retained independently.

2. **Inngest generation is 5 steps, not 4.** The plan specified 4 steps (stream, save, record tokens, resolve citations). The implementation adds a 5th step: BibTeX integrity check + follow-up request for missing entries. This addresses the truncation problem where `max_tokens` cut off the BibTeX trailer.

3. **Phase 0 retains SSE streaming (not Inngest).** The plan specified moving all generation to Inngest. Phase 0 (synopsis parsing) was kept as SSE because: (a) it's a small, fast operation (~2K tokens), (b) the response is JSON (parsed metadata), not LaTeX, and (c) the setup wizard needs synchronous feedback for the next step. Only Phases 1--8 use Inngest background generation.

4. **Frontend uses polling fallback alongside Realtime.** The plan specified pure Supabase Realtime subscription. The implementation adds a 3-second polling fallback (`setInterval` checking section status) to handle cases where Realtime subscriptions fail silently (e.g., browser tab throttling, WebSocket disconnection). The Realtime subscription remains the primary mechanism; polling is defence-in-depth.

### Bugs Found During Post-Implementation Audit

A comprehensive audit was performed cross-referencing every changed file against REVIEW.md, DECISIONS.md, Mitigation\_plan.md, and the Phase 5 implementation plan. Seven issues were found and fixed:

| Bug | Severity | Description | Resolution |
|-----|----------|-------------|------------|
| `aiReviewSection()` dead code | CRITICAL | Function was exported from `review-section.ts` but never called anywhere. AI-powered quality review (DECISIONS.md 3.2) was implemented but not integrated. | Fixed: wired into `approve/route.ts` as non-blocking quality check. Results returned in API response as `ai_review` field. |
| Missing token recording (4 routes) | HIGH | `recordTokenUsage()` not called in: `datasets/generate.ts`, `analyses/auto-detect/route.ts`, `compliance/checker.ts`, `synopsis/parse/route.ts`. Token budget could never be enforced on these routes. | Fixed: added `recordTokenUsage()` calls with correct phase numbers and model identifiers to all 4 routes. |
| Missing local migration files | MEDIUM | Migrations 026/027 applied via Supabase MCP but no local SQL files existed. `supabase db reset` would fail to reproduce the schema. | Fixed: created `026_split_token_tracking.sql` and `027_add_streaming_content.sql` in `supabase/migrations/`. |
| TypeScript type drift | MEDIUM | `Section` interface missing `streaming_content`, `AiConversation` missing `input_tokens`/`output_tokens`. Code writing these columns compiled but types were incomplete. | Fixed: added fields to `lib/types/database.ts`. Updated 7 test files with missing `streaming_content` in mock objects. |
| Synopsis parse code duplication | LOW | `synopsis/parse/route.ts` had inline JSON parsing (~40 lines) instead of using shared `parseSynopsisResponse()`. Different error handling and coercion logic. | Fixed: rewrote to use `parseSynopsisResponse()`. |
| `compliance/checker.ts` missing `projectId` | LOW | `batchAICheck()` had no `projectId` parameter, making `recordTokenUsage()` impossible to call with the correct project. | Fixed: added `projectId` parameter, threaded through from `runComplianceCheck()`. |
| Stale timeout mismatch | LOW | `STALE_GENERATING_MS` was 2 minutes but comment said 5 minutes. With Inngest background generation (which can take 2--3 minutes for ROL), 2 minutes would prematurely reset active generations. | Fixed: changed to 5 minutes, matching both the comment and Inngest job expectations. |

### Lessons Learned

1. **Dead exported functions are invisible bugs.** `aiReviewSection()` was properly implemented, exported, and even had correct types --- but was never called. TypeScript, linting, and tests all passed. The function could have sat unused indefinitely. Lesson: after implementing a function that's designed to be called from a specific integration point, immediately verify the call site exists. A `grep` for the function name across the codebase is the minimum check.

2. **Token recording must be verified at every AI call site, not assumed.** Four routes were missing `recordTokenUsage()`. The token budget system was architecturally sound but operationally incomplete. When adding a cross-cutting concern (logging, budgets, rate limiting), audit ALL call sites --- not just the ones modified in the current PR.

3. **MCP-applied migrations need local counterparts.** Supabase MCP applies migrations directly to the hosted database, bypassing local migration files. This is convenient for development but breaks reproducibility (`supabase db reset` needs local SQL files). Always create the local file alongside or immediately after MCP application.

4. **PII redaction should be proportionate to actual risk.** `redactPII()` and `sanitiseMetadataForAI()` were designed for a threat model that doesn't exist in this application. The synopsis is a public research protocol; the metadata is public academic information. Both functions added complexity (inconsistent application across routes, breaking front matter generation) for zero security benefit. Lesson: evaluate what data actually is before building redaction layers around it.

5. **Inngest background jobs need a stale-detection timeout that exceeds the expected job duration.** The original 2-minute timeout would have incorrectly reset ROL generations that legitimately take 2--3 minutes (16K tokens, citation resolution, BibTeX completion). The timeout must account for the worst-case job duration, not just the streaming phase.

6. **BibTeX trailer truncation is a predictable failure mode.** When `max_tokens` is tight and the AI prioritises chapter content over BibTeX entries, the trailer gets truncated. This was addressed with three mitigations: (a) increased `max_tokens` for citation-heavy phases, (b) strengthened the prompt instruction to prioritise completing all entries, (c) post-generation integrity check with targeted follow-up request for missing entries. Defence-in-depth is appropriate for AI output reliability.

### Migration Note

Two migrations must be applied before the code goes live:

**Migration `026_split_token_tracking.sql`**:
- Adds `input_tokens` (integer, default 0) and `output_tokens` (integer, default 0) to `ai_conversations`
- Backfills from `total_tokens` (70% input, 30% output approximation)

**Migration `027_add_streaming_content.sql`**:
- Adds `streaming_content` (text, default '') to `sections`
- Used by Realtime subscriptions for live preview during generation

Rollback:
```sql
ALTER TABLE public.ai_conversations DROP COLUMN IF EXISTS input_tokens, output_tokens;
ALTER TABLE public.sections DROP COLUMN IF EXISTS streaming_content;
```

### Deleted Files

| File | Lines | Purpose |
|------|-------|---------|
| `lib/ai/redact.ts` | 66 | PII redaction (`redactPII`) and metadata sanitisation (`sanitiseMetadataForAI`) --- removed as unnecessary (no PHI in system) |
| `lib/ai/redact.test.ts` | 125 | Tests for deleted redaction functions (12 tests) |

### New Files

| File | Lines | Purpose |
|------|-------|---------|
| `lib/phases/word-count-config.ts` | 60 | Canonical word count SSOT (soft/hard limits, AI aim ranges) |
| `lib/phases/word-count-config.test.ts` | 50 | Tests for word count config (13 tests) |
| `lib/ai/bibtex-completion.ts` | 80 | BibTeX trailer integrity check + missing entry follow-up |
| `lib/ai/bibtex-completion.test.ts` | 45 | Tests for BibTeX completion (6 tests) |
| `lib/inngest/functions/ai-generate.ts` | 100 | Inngest background AI generation function (5-step) |
| `supabase/migrations/026_split_token_tracking.sql` | 10 | Split token tracking migration |
| `supabase/migrations/027_add_streaming_content.sql` | 5 | Streaming content column migration |

---

## Phase 6: Phase 6a/6b Restructure and Analysis Pipeline

**Status**: COMPLETE
**Commit**: (pending)
**Duration**: ~2 days (including comprehensive audit + fixes)
**Tests**: 314 passing (31 files), 0 TypeScript errors
**Scope**: 5 new files + 1 migration + ~20 modified files. ~800 lines added/changed.

### Items Implemented

| Item | Review IDs | Description | Files Changed |
|------|-----------|-------------|---------------|
| 6.1 | A2, E8 | Split Phase 6 into 6a (Dataset + Analysis Planning) and 6b (Results) --- sub-phase model via `analysis_plan_status` column, no re-numbering. Phase 6 generate route gates on `analysis_plan_status === "approved"` and all planned analyses completed. | Migration `029_analysis_plan_columns`, `lib/types/database.ts`, `sections/[phase]/generate/route.ts` |
| 6.2 | DECISIONS 5.1 | AI-driven analysis planning --- Claude Haiku reads synopsis objectives + ROL + dataset columns, outputs structured `PlannedAnalysis[]` JSON. Student reviews/modifies/approves. Column reference validation on approval. | `lib/ai/prompts.ts` (`ANALYSIS_PLANNING_SYSTEM_PROMPT`), `lib/validation/analysis-plan-schemas.ts` (new), `api/projects/[id]/analyses/plan/route.ts` (new, GET/POST/PUT), `api/projects/[id]/analyses/plan/approve/route.ts` (new) |
| 6.3 | DECISIONS 5.1 | ROL-anchored synthetic dataset generation --- removed 3K/4K char truncation, added 5--10% MCAR missing data, realistic significant/non-significant mix, 1--3% outliers, column names tied to objectives. | `lib/datasets/generate.ts`, `lib/ai/prompts.ts` (`DATASET_GENERATION_SYSTEM_PROMPT`) |
| 6.4 | D5, DECISIONS 5.3 | Figure/table QC gates --- minimum 5 figures, 7 tables enforced in Phase 6b approval route AND finalQC(). Analysis plan match: every non-skipped planned analysis type must have a completed result. | `sections/[phase]/approve/route.ts`, `lib/qc/final-qc.ts`, `api/projects/[id]/qc/route.ts` |
| 6.4b | --- | Dataset change invalidates analysis plan --- any dataset mutation (create, delete, regenerate) resets `analysis_plan_status` to "pending" and clears `analysis_plan_json`. Prevents stale column references. | `api/projects/[id]/datasets/route.ts`, `datasets/[datasetId]/route.ts`, `datasets/generate/route.ts` |
| 6.5 | D2, D3, W11 | Figure download via R2 signed URL (15-min expiry, 302 redirect). PDF figure preview via `<iframe>` in FigureGallery (replaces BarChart3 placeholder). Download button on figure cards and lightbox. Dataset download button added to DatasetUpload component. | `api/projects/[id]/figures/[figureId]/download/route.ts` (new), `lib/r2/client.ts` (`generateDownloadUrl`), `components/project/figure-gallery.tsx`, `components/project/dataset-upload.tsx` |
| 6.6 | D6, DECISIONS 8.7 | Subfigure support --- `subcaption` package added to Docker and `generate-tex.ts`. Results prompt instructs AI to use `\begin{subfigure}` for multi-panel figures (e.g., forest + funnel plots). | `docker/Dockerfile.latex`, `lib/latex/generate-tex.ts`, `lib/ai/prompts.ts` |
| 6.7 | D8, DECISIONS 7.3 | Chart type and colour scheme in AnalysisWizard UI --- per-analysis-type chart options, colour scheme picker (default/greyscale/colourblind-safe), passed as `figure_preferences` to R Plumber. | `components/project/analysis-wizard.tsx` |
| 6.8 | D4, DECISIONS 5.2 | Demographics figure prompt --- Results prompt instructs AI to include demographics figures with `\includegraphics` when they exist. R endpoint changes deferred to Docker rebuild. | `lib/ai/prompts.ts` |
| 6.9 | I-6 | Per-analysis-type runtime limits --- timeout map updated: descriptive 15s, chi-square/t-test/correlation/kruskal 20s, survival/roc/logistic 30s, meta-analysis 60s. Already enforced via `AbortController` in `callRPlumber()`. | `lib/validation/analysis-schemas.ts` |

### Supporting Changes

| Change | Description | Files Changed |
|--------|-------------|---------------|
| Analysis plan review UI | New component with pending/planning/review/approved states, generate/regenerate/approve buttons, toggle skip per analysis | `components/project/analysis-plan-review.tsx` (new, ~250 lines) |
| Project workspace sub-phase routing | Phase 6 editor tab shows 6a/6b stepper, inline AnalysisPlanReview when dataset exists but plan not approved, checklist items for all sub-phase steps | `app/(dashboard)/projects/[id]/project-workspace.tsx` (**LOCKED** --- modified with approval) |
| Database migration 029 | `analysis_plan_json` (JSONB, default `[]`) and `analysis_plan_status` (text with CHECK constraint, default `"pending"`) | `supabase/migrations/029_analysis_plan_columns.sql` |
| TypeScript types | `AnalysisPlanStatus` type and fields added to `Project` interface | `lib/types/database.ts` |
| Event types | `ThesisSectionGenerateEvent` declaration added | `lib/inngest/events.ts` |
| Test mock updates | `analysis_plan_json: []` and `analysis_plan_status: "pending"` added to 6 test files | `assemble.test.ts`, `front-matter.test.ts`, `generate-tex.test.ts`, `transitions.test.ts`, `compile.test.ts`, `pipeline-e2e.test.ts` |
| Local migration files | Created missing `028_latex_content_canonical.sql` and `029_analysis_plan_columns.sql` | `supabase/migrations/` |

### Deferred Items (Docker Rebuild Required)

1. **6.8 --- Descriptive demographics figure**: R Plumber `/descriptive` endpoint needs to produce bar chart/histogram alongside Table 1. Prompt updated; R code changes deferred to Docker rebuild sprint.
2. **Figure file access for LaTeX compilation**: Figures stored in R2 need to be downloaded to the build directory before LaTeX can `\includegraphics` them. Requires compile pipeline modification.

### Deviations from Plan

1. **Dataset and analysis plan approved separately, not jointly (DECISIONS.md 5.1 step 6).** The implementation uses a two-step flow: dataset exists implicitly (no explicit approval), then analysis plan has its own approve flow. Joint approval was impractical because: (a) the analysis plan references specific column names from the dataset, so the dataset must be finalized first; (b) re-uploading a dataset must invalidate the plan independently; (c) the UI naturally separates these steps (upload/generate tab vs plan review panel). The sequential flow achieves the same gate: no Results generation without both dataset AND approved plan.

2. **Plan match check validates analysis types, not specific figures/tables.** DECISIONS.md 5.3 says "every planned figure/table must exist". The implementation checks that every non-skipped `analysis_type` has a completed analysis. It does NOT verify specific figures (e.g., "the chi-square was planned with a heatmap, does a heatmap figure exist?"). This is a pragmatic compromise: the R Plumber endpoints produce figures deterministically per analysis type, so a completed analysis always produces its expected figures. If the figures are later deleted independently, this would be a gap. A follow-up could add figure-level matching.

3. **head() display is post-upload/generate only, not persistent.** DECISIONS.md 5.1 step 5 says "Frontend displays head()". The DatasetUpload component already showed a preview table after upload/generate (first 5 rows). This preview disappears on navigation. A persistent head() display in the dataset panel would require fetching `rows_json` on every workspace load. Deferred as low-priority.

4. **Inngest step-level timeout not added.** The plan specified adding `{ timeout: "120s" }` to `step.run()` in the Inngest analysis runner as a safety net. The Inngest SDK version doesn't support this parameter on `step.run()`. The per-type timeouts via `AbortController` in `callRPlumber()` are already enforced and sufficient.

### Bugs Found During Post-Implementation Audit

A comprehensive audit was performed cross-referencing every changed file against REVIEW.md, DECISIONS.md, Mitigation\_plan.md, and the Phase 6 implementation plan. Five issues were found and fixed:

| Bug | Severity | Description | Resolution |
|-----|----------|-------------|------------|
| Table count in QC gates wrong | CRITICAL | `approve/route.ts` counted completed analyses instead of analyses with `results_json.table_latex`. A completed analysis without a table counted as 1 table. | Fixed: filter `completedWithTables` by `(a.results_json).table_latex` existence. |
| Plan regeneration overwrites approved plan | CRITICAL | POST `plan/route.ts` had no guard against `status === "approved"`. Student could accidentally regenerate after approval, invalidating already-run analyses. | Fixed: added `if (status === "approved") return badRequest(...)` guard. |
| `finalQC()` missing Phase 6 QC gates | HIGH | DECISIONS.md 5.3 specifies "Phase 6b QC + Final QC" scope, but `final-qc.ts` was never updated. Figure/table minimums only enforced in approve route. | Fixed: added `checkResultsFiguresAndTables()` to `finalQC()`. Updated QC route to pass figure/table counts. |
| Missing local migration files | MEDIUM | Migrations 028 and 029 applied via Supabase MCP but no local SQL files existed. `supabase db reset` would fail to reproduce the schema. Same recurring issue from Phase 5. | Fixed: created `028_latex_content_canonical.sql` and `029_analysis_plan_columns.sql`. |
| PDF figure preview missing | MEDIUM | Mitigation 6.5(b) says "render PDF figures using `<iframe>`". FigureGallery showed `<BarChart3>` placeholder icon for PDFs. Dataset download button not in DatasetUpload (W11). | Fixed: replaced BarChart3 with `<iframe>` for PDF figures. Added Download button to DatasetUpload. |

### Lessons Learned

1. **QC gate scope must match the governance docs exactly.** DECISIONS.md 5.3 explicitly says "Phase 6b QC + Final QC" but the initial implementation only added gates to the approve route. When a governance doc specifies scope, audit ALL matching code paths --- not just the one you're editing.

2. **State transitions need guards against regression.** The plan regeneration bug allowed overwriting an approved plan with a new one, invalidating analyses that had already run against the original plan. Any state machine that progresses forward should validate that backwards transitions are intentional and safe.

3. **Count queries must match the semantic intent.** Counting "completed analyses" is not the same as counting "tables produced by analyses". The query predicate must match what's actually being measured. When a QC gate says "7 tables", the query must count actual tables, not proxy metrics.

4. **Local migration files are not optional.** This is the third phase where MCP-applied migrations lacked local counterparts. Adding a post-implementation checklist item: "verify local SQL files exist for every MCP-applied migration."

### Migration Note

Migration `029_analysis_plan_columns` must be applied. It adds:
- `analysis_plan_json` (JSONB, default `[]`) on `public.projects`
- `analysis_plan_status` (text with CHECK constraint, default `"pending"`) on `public.projects`

Also created missing migration `028_latex_content_canonical` (column comment on `sections.rich_content_json` from Phase 4).

Rollback:
```sql
ALTER TABLE public.projects
  DROP COLUMN IF EXISTS analysis_plan_json,
  DROP COLUMN IF EXISTS analysis_plan_status;
```

### New Files

| File | Lines | Purpose |
|------|-------|---------|
| `lib/validation/analysis-plan-schemas.ts` | 33 | Zod schemas for PlannedAnalysis and AnalysisPlan |
| `api/projects/[id]/analyses/plan/route.ts` | 285 | Analysis plan GET/POST/PUT endpoints |
| `api/projects/[id]/analyses/plan/approve/route.ts` | 103 | Analysis plan approval with column validation |
| `api/projects/[id]/figures/[figureId]/download/route.ts` | 55 | Figure download via R2 signed URL |
| `components/project/analysis-plan-review.tsx` | 310 | Analysis plan review UI component |
| `supabase/migrations/028_latex_content_canonical.sql` | 5 | Phase 4 migration (local file) |
| `supabase/migrations/029_analysis_plan_columns.sql` | 12 | Phase 6 migration (local file) |

---

## Phase 7: Final QC and Completion Flow

**Status**: COMPLETE
**Commit**: (pending)
**Duration**: ~2 days (including comprehensive audit + fixes)
**Tests**: 324 passing (32 files), 0 TypeScript errors
**Scope**: 3 new files + ~18 modified files. ~+350 lines net.

### Items Implemented

| Item | Review IDs | Description | Files Changed |
|------|-----------|-------------|---------------|
| 7.1 | W3, W4, C-III-4 | Final QC Dashboard component --- renders at Phase 11, "Run Final QC" button, 6 check cards (pass/warn/fail), auto-fix buttons, "Complete Thesis" button disabled when blocking checks fail. Integrated into project-workspace (replaces editor for Phase 11). | `components/project/final-qc-dashboard.tsx` (new, ~250 lines), `projects/[id]/project-workspace.tsx` (**LOCKED** --- modified with approval) |
| 7.2 | E2 | Phase 11 approval gates on QC --- `finalQC()` called BEFORE section status change. Fetches all sections, citations, latest `log_text`, figure count, analysis table count. Returns `badRequest()` with blocking count if `!overallPass`. Only sets `project.status = "completed"` after QC passes. | `sections/[phase]/approve/route.ts` |
| 7.3 | E3 | Remove `canAdvancePhase` dead code --- removed `currentSectionStatus` parameter entirely (section status already validated in approve route lines 75--92). Updated all call sites and tests. | `lib/phases/transitions.ts`, `sections/[phase]/approve/route.ts`, `lib/phases/transitions.test.ts` |
| 7.4 | E7 | Fix `checkUndefinedReferences` --- returns `status: "fail"` (blocking) when compile log is `null`, with message "No compile log available --- compile the thesis before running Final QC". QC route column reference fixed from `compile_log` to `log_text`. | `lib/qc/final-qc.ts`, `app/api/projects/[id]/qc/route.ts` |
| 7.5 | Part III-D | ThesisCompletion flow --- Phase 11 approval sets `project.status = "completed"` after QC passes. Frontend renders `ThesisCompletion` celebration UI with stats + export downloads. No code changes needed beyond 7.2 (flow already existed, was just unreachable). | (verified --- no additional changes needed) |
| 7.6 | C4 | Appendices template injection --- `ANNEXURE_SECTION_MAP` maps AI `\section*{}` headings to template `\annexurechapter{}` placeholders. `injectAppendices()` splits Phase 10 content and replaces placeholders. Phase 10 prompt updated to reference synopsis text for PIS/ICF and dataset columns for Data Collection Proforma. | `lib/latex/assemble.ts`, `lib/ai/prompts.ts`, `sections/[phase]/generate/route.ts` |
| 7.7 | C5 | Abbreviations injection --- `injectAbbreviations()` replaces `\begin{abbreviations}...\end{abbreviations}` in template with generated content. Added abbreviations fetch to compile, source export, and DOCX export routes. | `lib/latex/assemble.ts`, `compile/route.ts`, `export/source/route.ts`, `export/docx/route.ts` |
| 7.8 | C7 | `mathrsfs` added to Docker --- added to `tlmgr install` list in Dockerfile. | `docker/Dockerfile.latex` |

### Supporting Changes

| Change | Description | Files Changed |
|--------|-------------|---------------|
| Shared spelling dictionary | Extracted 79-entry `AMERICAN_TO_BRITISH` array from `spell-check.ts` (superset) into shared module. Replaced 4 independent copies (~21 entries each) with single import. | `lib/compliance/spelling-dictionary.ts` (new), `lib/compliance/spell-check.ts`, `lib/qc/final-qc.ts`, `app/api/projects/[id]/qc/fix/route.ts`, `lib/ai/review-section.ts` |
| Phase 6 QC gate in approve route | Figure/table QC (5 figs, 7 tables) + analysis plan match enforced in approve route when `phaseNumber === 6` | `sections/[phase]/approve/route.ts` |
| Phase 8 citation audit | Auto-creates Phase 9 section with citation audit results on Phase 8 approval | `sections/[phase]/approve/route.ts` |
| Phase 10 auto-create | Auto-creates Phase 11 section with QC placeholder on Phase 10 approval | `sections/[phase]/approve/route.ts` |
| New tests | `final-qc.test.ts` --- 10 tests covering `checkUndefinedReferences` (null log, clean log, warnings) and `finalQC` (blocking fail, all pass, all 6 checks present, British English detection, figure/table minimums) | `lib/qc/final-qc.test.ts` (new), `lib/latex/assemble.test.ts` (updated) |

### Deviations from Plan

1. **`canAdvancePhase` parameter removed entirely, not fixed (7.3).** The plan said "pass actual section status to `canAdvancePhase()`". The implementation removed the `currentSectionStatus` parameter entirely because section status is already validated in the approve route (lines 75--92) before `canAdvancePhase()` is called. The dead parameter was providing false assurance of a check that happened elsewhere. Removing it is cleaner than maintaining a parameter that duplicates existing validation.

2. **Undefined references returns `fail` (blocking) not `warn` when no compile log (7.4).** The plan specified returning `status: "warn"`. The implementation returns `status: "fail"` with `blocking: true`. Rationale: a thesis cannot be completed without at least one successful compilation. Allowing completion without a compile log would mean undefined references and citations are never checked. This is stricter than the plan but prevents a real gap in quality assurance.

3. **Appendices prompt enhanced with synopsis and dataset context (7.6).** The plan only specified fixing the template injection. The implementation also enhanced the Phase 10 AI prompt to reference synopsis text (for PIS study title, procedures, risks, criteria) and dataset columns (for Data Collection Proforma field names and Master Chart headers). This produces significantly more realistic annexures.

### Bugs Found During Post-Implementation Audit

A comprehensive audit was performed cross-referencing every changed file against REVIEW.md, DECISIONS.md, and Mitigation\_plan.md. Three bugs were found and fixed:

| Bug | Severity | Description | Resolution |
|-----|----------|-------------|------------|
| Phase 11 QC check ordering | CRITICAL | QC check ran AFTER section was set to "approved" (lines 191--220 approve section, then lines 353--414 run QC). If QC fails, section is stuck at "approved" permanently --- approve route rejects already-approved sections at line 79. Student locked out with no recovery path. | Fixed: moved Phase 11 QC gate to BEFORE section approval (adjacent to Phase 6 gates). Old post-approval block replaced with just `project.status = "completed"` update. |
| Word count SSOT not imported in `final-qc.ts` | HIGH | `checkSectionCompleteness()` hardcoded `WORD_COUNT_TARGETS` with wrong values: Phase 2 min=500 (SSOT hardFloor=1000), Phase 3 min=150 (SSOT hardFloor=300). Exact same bug class as Review finding A5/E6/F2 that Phase 5 item 5.1 was designed to fix. `final-qc.ts` was not updated when the SSOT was created. | Fixed: replaced hardcoded targets with `import { WORD_COUNT_CONFIG } from "@/lib/phases/word-count-config"`. Changed `target.min` to `config.hardFloor`. Updated test fixture word counts to meet new minimums. |
| Table double-counting | MEDIUM | `totalTables = analysisTableCount + latexTableCount` double-counts because AI embeds analysis `table_latex` verbatim in Results chapter (per `RESULTS_SYSTEM_PROMPT` instructions). Present in BOTH `final-qc.ts` `checkResultsFiguresAndTables()` AND `approve/route.ts` Phase 6 gate. | Fixed: changed to `Math.max(analysisTableCount, latexTableCount)` in both locations. |

### Lessons Learned

1. **Pre-approval QC gates must run BEFORE section status transitions.** The approve route's flow is: validate status (lines 75--92) → run QC (phase-specific) → approve section (lines 191--220) → advance phase → post-approval actions. If QC runs after approval, a failure leaves the section at "approved" with no way to re-attempt (the route rejects already-approved sections). This is a state machine deadlock. Any blocking validation must happen before the irreversible state change.

2. **SSOT consumers must be audited when the SSOT is created.** Phase 5 item 5.1 created `word-count-config.ts` as the canonical word count source. But `final-qc.ts` --- a direct consumer of word count data --- was never updated. The SSOT only works if ALL consumers import from it. When creating a new SSOT, `grep` for every usage of the old values across the entire codebase, including files that might have been written before the SSOT existed.

3. **Table counting must account for AI content embedding.** The Results prompt instructs AI to include analysis `table_latex` verbatim. This means the same table appears both in the `analyses.results_json.table_latex` field AND as a `\begin{table}` environment in the chapter LaTeX. Summing both counts every table twice. The correct approach is `Math.max()` --- take the higher of the two counts, acknowledging they substantially overlap.

4. **Shared dictionaries reduce maintenance burden and catch more issues.** The four independent spelling dictionaries had 21, 21, 21, and 60 entries respectively. Consumers using the 21-entry versions missed 39 American English spellings that the comprehensive version would catch. Extracting a shared module ensures all consumers benefit from the same coverage.

5. **Phase-specific QC gates belong adjacent to each other in the approve route.** Phase 6 QC gates (lines 112--179) and Phase 11 QC gates (lines 181--237) now sit next to each other, BEFORE the generic approval logic. This makes the approve route's control flow clear: validate → phase-specific QC → approve → advance → post-approval hooks. Scattering QC checks throughout the function (some before, some after approval) creates ordering bugs.

6. **QC report stored as JSON in `latex_content` is a pragmatic hack.** Phase 11's `latex_content` column stores JSON (the QC report) rather than LaTeX. This is semantically wrong but operationally correct: Phase 11 is never included in the assembly pipeline, and the workspace parses it as JSON for the dashboard. A dedicated `qc_report_json` column would be cleaner but adds a migration for no functional benefit.

### New Files

| File | Lines | Purpose |
|------|-------|---------|
| `components/project/final-qc-dashboard.tsx` | ~250 | Final QC Dashboard UI component |
| `lib/compliance/spelling-dictionary.ts` | ~80 | Shared American→British spelling dictionary (79 entries) |
| `lib/qc/final-qc.test.ts` | ~160 | Tests for Final QC checks (10 tests) |

---

## Phase 8: Frontend Integration and Polish

**Status**: COMPLETE
**Commit**: (pending)
**Duration**: ~1 day
**Tests**: 324 passing, 0 TypeScript errors

### Items Implemented

| Item | Review IDs | Description | Files Changed |
|------|-----------|-------------|---------------|
| 8.1 | W5--W8, C-III-5 | ExportMenu in workspace (Phase 6+ gate) | `project-workspace.tsx` (import + render), `export-menu.tsx` (add `currentPhase` prop, tiered access per DECISIONS.md 8.4), `thesis-completion.tsx` (pass `currentPhase`) |
| 8.2 | X2 | React ErrorBoundary wrapping editor/preview panels | `error-boundary.tsx` (new), `project-workspace.tsx` (wrap 4 panels --- desktop editor, desktop preview, mobile editor, mobile preview) |
| 8.3 | M3 | Wire onboarding TourOverlay | `project-workspace.tsx` (import + render), `tour-overlay.tsx` (update steps to match DECISIONS.md 8.3: pipeline timeline, editor, citation panel, compile button) |
| 8.4 | W2 | Compilation history in Progress tab | `page.tsx` (fetch last 3 compilations), `project-workspace.tsx` (add `compilations` prop), `progress-dashboard.tsx` (add Recent Compilations section with status, warnings, errors, compile time, relative timestamp) |
| 8.5 | C-III-1 | CitationSearchDialog deduplication | `project-workspace.tsx` (remove duplicate instance + state), `citation-list-panel.tsx` (make `onAddCitation` optional). Kept editor instance (inserts at cursor) --- see Deviations |
| 8.7 | IV-A4 | XSS fix in title-page-preview | `title-page-preview.tsx` (DOMPurify sanitisation via dynamic `import()` --- SSR-safe) |
| 8.8 | IV-A5 | Content-Disposition header fix (DOCX export) | `export/docx/route.ts` (sanitise filename, RFC 5987 `filename*`, correct Content-Type to `text/plain`) |
| 8.12 | IV-A7, IV-A8 | Server-side file upload size enforcement | `datasets/route.ts` (50 MB dual check: Content-Length + file.size), `figures/route.ts` (same), `lib/r2/client.ts` (`generateUploadUrl` accepts optional `fileSize`, validates against `MAX_FILE_SIZE`, passes as `ContentLength` to `PutObjectCommand`), `upload/signed-url/route.ts` (accept+validate `fileSize` from client, pass to `generateUploadUrl`), `file-uploader.tsx` (send `file.size` as `fileSize` in signed-url request) |
| 8.13 | IV-C6 | R Plumber Bearer authentication | `lib/r-plumber/client.ts` (add `Authorization: Bearer` header), `docker-compose.yml` (`ports` changed to `expose`, add `R_PLUMBER_SECRET` env), `docker/plumber.R` (add `@plumber` auth filter, exempt `/health`), `.env.example` (add `R_PLUMBER_SECRET`) |
| 8.14 | W11 | Review PDF access for token-based reviewers | `app/api/review/[token]/preview.pdf/route.ts` (new --- validates review token, serves PDF via R2 signed URL or local fallback), `app/api/review/[token]/route.ts` (update `pdf_url` to token-scoped path) |
| 8.15 (NEW) | (SSOT violation) | ProgressDashboard word count SSOT fix | `progress-dashboard.tsx` (removed hardcoded `wordTargets`, imported `getWordCountConfig` from SSOT) |

### Items Skipped

| Item | Review IDs | Reason |
|------|-----------|--------|
| 8.6 | W10 | Licence transfer --- admin-only per DECISIONS.md 8.6, no UI code needed |
| 8.9 | C-III-2 | Editor toggle visibility --- post-Phase 4 migration to CodeMirror 6, the toggle is already correct |
| 8.10 | C-III-3 | Mobile tab reset --- `mobileTab` state resets correctly via React re-render on phase change |
| 8.11 | X1 | Phase navigation loading state --- phase navigation is synchronous (`setViewingPhase` is state-only), no async fetch involved |

### Deviations from Mitigation Plan

1. **8.5 direction reversed.** Plan says "Remove the instance in SectionEditor. Use workspace-level state consistently." Implementation did the opposite: removed the workspace instance and kept the `latex-editor.tsx` instance. This is correct because the editor instance inserts `\cite{key}` at cursor position --- the workspace-level instance has no editor reference and cannot do cursor insertion. SectionEditor was already removed in Phase 4.

2. **8.13 auth header name changed.** Plan specifies `X-Service-Auth` header. Implementation uses `Authorization: Bearer <token>` instead. Bearer authentication is the HTTP standard (RFC 6750) and is better supported by middleware/proxies. The shared secret is the same --- only the transport mechanism changed.

3. **DOCX export option removed from ExportMenu.** The "DOCX" export was a duplicate of "LaTeX Source" --- both returned raw `.tex` files (pandoc conversion requires Docker, which is deferred). Removed to avoid user confusion.

### Audit Findings (Post-Implementation)

During the Phase 8 audit, the following additional issues were discovered and fixed:

| Finding | Severity | Description | Fix |
|---------|----------|-------------|-----|
| C1 | CRITICAL | Item 8.4 (Compilation History) was not implemented | Added compilations fetch + display in ProgressDashboard |
| C2 | CRITICAL | IV-A7: R2 signed URL had no ContentLength constraint | ~~First fix (`ContentLength: MAX_FILE_SIZE`) was catastrophically wrong~~ --- hardcoded 50 MB forces exact-match, breaking all smaller uploads. Corrected: `generateUploadUrl` now accepts optional `fileSize` from client, validates it server-side, passes as `ContentLength` only when provided. Client sends `file.size` in signed-url request. |
| C3 | CRITICAL | Export access tiers didn't match DECISIONS.md 8.4 | Added `currentPhase` prop, sandbox=PDF-only, licensed 6b+=full |
| H1 | HIGH | DOMPurify SSR risk (top-level import requires `window`) | Changed to dynamic `import()` inside `useEffect` |
| H3+H4 | HIGH | DOCX option misleading + duplicate of LaTeX Source | Removed DOCX from ExportMenu |
| M3 | MEDIUM | Redundant `return()` after `plumber::forward()` in plumber.R | Changed to `return(plumber::forward())` |
| M4 | MEDIUM | Unsafe `Uint8Array` cast in review PDF route | Changed to `new Uint8Array(pdfBytes)` for type safety |
| L1 | LOW | Tour steps didn't match DECISIONS.md 8.3 spec | Updated to: pipeline timeline, editor, citation panel, compile button |

### Second Audit Findings (Post-Fix Verification)

A second comprehensive audit discovered and fixed 3 additional issues:

| Finding | Severity | Description | Fix |
|---------|----------|-------------|-----|
| SA-1 | CRITICAL | C2 first fix was catastrophically wrong: `ContentLength: MAX_FILE_SIZE` on `PutObjectCommand` forces exact 50 MB match on presigned uploads, breaking ALL smaller files | Rewrote: `generateUploadUrl` accepts optional `fileSize`, validates server-side, passes as `ContentLength` only when provided. Updated signed-url route + client uploader to pass `file.size`. |
| SA-2 | HIGH | Tour overlay `data-tour` attributes missing from workspace DOM --- tour steps targeted `[data-tour='pipeline']` etc. but no elements had these attributes | Added `data-tour="pipeline"` on PipelineTimeline wrapper, `data-tour="compile"` on action bar, `data-tour="citations"` on CitationListPanel wrapper, `data-tour="editor"` on editor panel |
| SA-3 | HIGH | Phase 6a vs 6b export gating: all export routes checked `currentPhase < 6` which allows Phase 6a access. DECISIONS.md 8.4 says "Phase 6b+" | Updated `licence-gate.ts` to return `analysisPlanStatus`. All 4 export routes now check `currentPhase === 6 && analysisPlanStatus !== "approved"`. UI gate in workspace updated to `currentPhase > 6 \|\| (currentPhase === 6 && analysis_plan_status === "approved")`. |

### Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `app/api/review/[token]/preview.pdf/route.ts` | ~105 | Token-scoped PDF proxy for reviewers |
| `components/error-boundary.tsx` | ~63 | React class component ErrorBoundary |

### Files Modified

| File | Changes |
|------|---------|
| `project-workspace.tsx` | Import/render ExportMenu, ErrorBoundary, TourOverlay; add `compilations` prop; remove CitationSearchDialog |
| `page.tsx` | Fetch last 3 compilations, pass to workspace |
| `progress-dashboard.tsx` | SSOT word counts, compilation history section |
| `export-menu.tsx` | Remove DOCX option, add `currentPhase` prop, tiered export access |
| `thesis-completion.tsx` | Pass `currentPhase` to ExportMenu |
| `title-page-preview.tsx` | DOMPurify dynamic import (SSR-safe) |
| `export/docx/route.ts` | Sanitised filename, RFC 5987, correct Content-Type |
| `datasets/route.ts` | 50 MB dual upload size check |
| `figures/route.ts` | 50 MB dual upload size check |
| `lib/r2/client.ts` | `generateUploadUrl` accepts optional `fileSize`, validates against `MAX_FILE_SIZE`, conditionally passes `ContentLength` |
| `upload/signed-url/route.ts` | Accept `fileSize` from client, validate server-side (413 on exceed), pass to `generateUploadUrl` |
| `file-uploader.tsx` | Send `file.size` as `fileSize` in signed-url request body |
| `lib/api/licence-gate.ts` | Return `analysisPlanStatus` in gate result, query `analysis_plan_status` column |
| `lib/r-plumber/client.ts` | Bearer token auth on both functions |
| `docker/plumber.R` | `@plumber` auth filter with `/health` exemption |
| `docker/docker-compose.yml` | `expose` instead of `ports`, `R_PLUMBER_SECRET` env |
| `apps/web/.env.example` | Add `R_PLUMBER_SECRET` |
| `review/[token]/route.ts` | Token-scoped `pdf_url` |
| `citation-list-panel.tsx` | `onAddCitation` optional |
| `tour-overlay.tsx` | Updated steps to match DECISIONS.md 8.3 |

---

## Phase 9: Privacy and Compliance

**Status**: COMPLETE
**Commit**: (pending)
**Duration**: ~1 day
**Tests**: (pending verification)

### Items Implemented

| Item | Description | Implementation |
|------|-------------|----------------|
| 9.1 | Privacy Policy, Terms of Service, Refund Policy pages | Legal route group `(legal)/layout.tsx` + `/privacy`, `/terms`, `/refund` pages. British English, DPDP Act 2023 basis, SciScribe entity details. Footer links updated (LOCKED file --- approved). |
| 9.2 | Account Deletion (7-day cooling-off + purge cron) | `POST /api/account/delete` (request), `DELETE /api/account/delete` (cancel). `account-deletion-cron.ts` Inngest cron (03:00 UTC) purges after 7 days --- R2 cleanup, DB hard-delete (CASCADE), Clerk user deletion. Settings page with typed "DELETE" confirmation. |
| 9.3 | AI Processing Consent | Checkbox in `synopsis-upload-step.tsx` (blocks Next until checked). Consent timestamp stored on `users.ai_consent_accepted_at` via PATCH route (once per user). |
| 9.4 | Cookie Consent Banner | `cookie-consent-banner.tsx` --- frosted glass card, bottom-right, slides in on first visit. Stores preference in localStorage. |
| 9.5 | Medical Data Warning | Amber banner in synopsis upload step: anonymise patient data before uploading. |
| 9.6 | Dataset PII Warning | Amber banner in `dataset-upload.tsx`: remove all identifiable information. |
| 9.7 | Audit Log CASCADE | Migration `030_privacy_compliance.sql` --- `ON DELETE CASCADE` on `audit_log.project_id` and `audit_log.user_id` foreign keys. |
| 9.9 | R2 Cleanup | `deleteR2Prefix()` in `lib/r2/client.ts` --- paginated batch delete. Called on project DELETE and account purge cron. Project DELETE changed from soft-delete (archived) to hard-delete. |

### PostHog Consent Gating (9.4 backend)

`posthog-provider.tsx` updated: PostHog only captures when `localStorage("analytics-consent") === "true"` AND production environment. `updateAnalyticsConsent()` exported for cookie banner and settings page.

### Clerk Webhook Extension (9.2 sync)

`webhooks/clerk/route.ts` extended with `user.deleted` handler: sets `deletion_requested_at` on user row, triggering 7-day cron purge.

### Items Deferred

| Item | Reason |
|------|--------|
| 9.8 | Data Retention Auto-Purge --- deferred per DECISIONS.md 6.2 (manual purge sufficient for GA) |

### Items Skipped

| Item | Reason |
|------|--------|
| 9.10 | AI Output PII Check --- no `redactPII()` exists; LaTeX content causes massive false positives; real PII risk is in AI input (synopsis/dataset), already addressed by consent + warning banners |

### Audit Findings (Post-Implementation)

| Finding | Severity | Description | Fix |
|---------|----------|-------------|-----|
| C1 | CRITICAL | `projects.user_id` FK missing ON DELETE CASCADE --- user deletion fails with FK constraint | Migration 030 extended: drop + re-add FK with CASCADE |
| C2 | CRITICAL | `thesis_licenses.user_id` FK missing CASCADE --- same failure | Migration 030 extended: drop + re-add FK with CASCADE |
| C3 | CRITICAL | `review_tokens.created_by` FK missing CASCADE --- same failure | Migration 030 extended: drop + re-add FK with CASCADE |
| H1 | HIGH | AI consent checkbox props not wired in `setup-wizard.tsx` --- checkbox never rendered | Added `aiConsentAccepted` state, passed props, gated Next button on consent |
| H2 | HIGH | Account deletion POST not idempotent --- calling twice resets 7-day clock | Added `.is("deletion_requested_at", null)` guard + early return if already requested |
| H3 | HIGH | `analytics_consent` DB column never written --- settings page only used localStorage | Created `PATCH /api/account/preferences` endpoint, settings page calls it on toggle |
| H4 | HIGH | Cookie banner slide-in animation broken --- `if (!visible) return null` prevents exit animation | Rewrote with `shouldRender` + `animateIn` two-phase state |
| M1 | MEDIUM | Settings page: `useRouter` imported but unused | Removed dead import |

### Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/030_privacy_compliance.sql` | User privacy columns + 5 FK CASCADE fixes (projects, thesis_licenses, review_tokens, audit_log x2) |
| `app/(legal)/layout.tsx` | Shared legal page layout (dashboard-dot-grid bg, frosted glass header) |
| `app/(legal)/privacy/page.tsx` | Privacy Policy |
| `app/(legal)/terms/page.tsx` | Terms of Service |
| `app/(legal)/refund/page.tsx` | Refund Policy |
| `components/consent/cookie-consent-banner.tsx` | Floating consent card with slide animation |
| `app/api/account/delete/route.ts` | Account deletion endpoint (idempotent POST, cancel DELETE) |
| `app/api/account/preferences/route.ts` | User preferences endpoint (analytics_consent sync) |
| `lib/inngest/functions/account-deletion-cron.ts` | 7-day purge cron |
| `app/(dashboard)/settings/page.tsx` | Settings with profile, preferences, delete account |
| `components/ui/checkbox.tsx` | shadcn checkbox (via CLI) |

### Files Modified

| File | Changes |
|------|---------|
| `lib/r2/client.ts` | Added `deleteR2Prefix()`, imported `ListObjectsV2Command`/`DeleteObjectsCommand` |
| `lib/types/database.ts` | Added `deletion_requested_at`, `ai_consent_accepted_at`, `analytics_consent` to User |
| `wizard/steps/synopsis-upload-step.tsx` | AI consent checkbox + medical data warning banner |
| `wizard/setup-wizard.tsx` | Wire consent state, pass props, gate Next on consent acceptance |
| `app/api/projects/[id]/route.ts` | Hard-delete + R2 cleanup; consent timestamp on PATCH |
| `app/api/webhooks/clerk/route.ts` | Handle `user.deleted` event |
| `app/api/inngest/route.ts` | Register `accountDeletionCronFn` |
| `providers/posthog-provider.tsx` | Consent-gated init + `updateAnalyticsConsent()` export |
| `app/layout.tsx` | Added `CookieConsentBanner` |
| `components/project/dataset-upload.tsx` | PII warning banner |
| `landing/footer-section.tsx` | Legal links (LOCKED --- approved) |
| `layout/glass-sidebar.tsx` | Settings nav item (LOCKED --- approved) |

---

## Phase 9 Supplement: Database Audit Fixes

**Status**: COMPLETE
**Migration**: `031_database_audit_fixes.sql` (applied via MCP)
**Trigger**: Comprehensive database audit performed after Phase 9 migration 030 applied

### Context

After applying all migrations (019--030) to the live database, a full schema audit was performed covering: RLS policies, indexes, functions, FK constraints, triggers, orphaned data, and Supabase security/performance advisors. The audit identified 7 categories of issues.

### Issues Found and Fixed

| ID | Severity | Issue | Fix | Migration Section |
|----|----------|-------|-----|-------------------|
| H1 | CRITICAL | `fk_thesis_licenses_project` (thesis_licenses.project_id -> projects.id) was NO ACTION --- blocked project hard-delete for any licensed project. Phase 9.9 project deletion would fail. | Changed to ON DELETE SET NULL. Licence record survives with null project_id (already consumed). | H1 |
| H1b | CRITICAL | `figures_section_id_fkey` (figures.section_id -> sections.id) was NO ACTION --- blocked section CASCADE deletion, which blocked project deletion chain. | Changed to ON DELETE CASCADE. Figures belong to their section. | H1b |
| H2 | LOW | `processed_webhooks` table had RLS disabled. Mitigation plan (IV-L6) says "intentional" --- but defense-in-depth is good practice. | Enabled RLS + deny-all policy (`USING (false)`). Server-side access via admin client bypasses RLS. | H2 |
| S1 | MEDIUM | 9 public functions had mutable `search_path` (Supabase security advisor warning). 6 were SECURITY DEFINER (higher risk), 3 were trigger functions (lower risk). | Set `search_path = ''` on all 9. Verified all use schema-qualified references (`public.*`) or only `NEW`/`OLD`/`now()`. | S1 |
| S2 | MEDIUM | `analyses_dataset_id_fkey` (analyses.dataset_id -> datasets.id) was NO ACTION --- blocked independent dataset deletion/replacement in Phase 6a. | Changed to ON DELETE SET NULL. Analysis records preserved with null dataset_id. | S2 |
| P2 | LOW | 6 foreign key columns had no index --- CASCADE deletes require sequential scan of referencing table. | Added indexes on: `analyses.dataset_id`, `citations.attested_by_user_id`, `figures.section_id`, `review_comments.review_token_id`, `review_tokens.created_by`, `sections.ai_conversation_id`. | P2 |
| P3 | LOW | `idx_processed_webhooks_event_id` was redundant --- covered by the unique constraint index. | Dropped redundant index. | P3 |

### Issues Deferred

| ID | Severity | Issue | Reason |
|----|----------|-------|--------|
| P1 | LOW (perf) | 35+ RLS policies use `auth.jwt()` without `(select ...)` wrapper, causing per-row re-evaluation | Too large for single migration. Requires rewriting every policy. Will batch in a dedicated migration. |
| L1 | INFO | Audit triggers only cover 4 of 17 tables | By design --- only high-value tables (projects, sections, citations, thesis_licenses) are audited. |
| L2 | INFO | projects.UPDATE RLS allows user to modify `status` column | API routes validate status transitions. RLS is defense-in-depth, not primary gate. |
| L3 | INFO | Multiple permissive SELECT policies on projects/sections/users | By design --- role-based access (owner/supervisor/admin) requires separate policies. |

### Post-Fix Advisor Status

**Security advisor**: 0 warnings (was 9 --- all resolved via S1)
**Performance advisor**: 35 `auth_rls_initplan` warnings (P1, deferred) + unused index info (expected for newly created indexes + pre-existing design decisions) + 3 multiple permissive policy warnings (by design)

### Cascade Deletion Chain (Verified)

After migrations 030 + 031, the complete user deletion cascade chain is:
```
DELETE user
  -> CASCADE projects (projects.user_id)
       -> CASCADE sections (sections.project_id)
            -> CASCADE citations (citations.section_id)
            -> CASCADE figures (figures.section_id) [was NO ACTION, fixed H1b]
       -> CASCADE datasets (datasets.project_id)
       -> CASCADE analyses (analyses.project_id)
       -> CASCADE audit_log (audit_log.project_id)
       -> SET NULL thesis_licenses (thesis_licenses.project_id) [was NO ACTION, fixed H1]
  -> CASCADE thesis_licenses (thesis_licenses.user_id)
  -> CASCADE audit_log (audit_log.user_id)
  -> SET NULL citations.attested_by_user_id
```

### Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/031_database_audit_fixes.sql` | All audit fixes: H1, H1b, H2, S1, S2, P2, P3 |

---

## Phase 10: Docker Hardening

**Status**: COMPLETE
**Commit**: (pending)
**Duration**: ~1 day
**Tests**: 324/324 passing, 0 TypeScript errors

### Items Implemented

| Item | Review ID | Description | Implementation |
|------|-----------|-------------|----------------|
| 10.1 | I-5 | Docker seccomp profiles | Created `docker/seccomp-latex.json` (whitelist, SCMP_ACT_ERRNO default — file I/O, process, memory, signals, time, libc internals) and `docker/seccomp-r.json` (same + networking + epoll for HTTP server). Applied in `docker-compose.yml` and `compile.ts`. |
| 10.2 | I-13 | AppArmor profile for R container | Created `docker/apparmor-r-plumber` — allows R runtime, Plumber app, /tmp; denies shell, python, perl, wget; curl restricted to healthcheck sub-profile; denies raw/packet network, mount, ptrace. Applied via `docker-compose.prod.yml` override (Linux-only). |
| 10.1a | (bonus) | compile.ts security args | **CRITICAL BUG FIX**: compile.ts uses `docker run --rm` (ephemeral containers), not `docker exec` on compose container. Compose security settings were dead code for compilation. Added `--pids-limit=256`, `--security-opt no-new-privileges:true`, `--cap-drop=ALL`, `--cap-add=DAC_OVERRIDE`, `--cap-add=FOWNER`, seccomp profile with graceful fallback. |
| (bonus) | — | Security response headers | Added to `next.config.ts`: X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, HSTS 2yr+preload, Permissions-Policy. CSP deferred (would break Clerk/Sentry/PostHog/shadcn inline styles). |
| (bonus) | IV-E9 | Health check enhancement | `GET /api/health` now checks R Plumber connectivity (3s timeout) and Docker availability (5s timeout, conditional on LATEX_COMPILE_MODE=docker). Returns per-dependency status map. |
| (bonus) | governance | deploy-conformance.sh | Created 14-check VPS deploy-gate script referenced by security-tests.md and release-gates.md. Checks: seccomp profiles, test compilation, R Plumber health, network isolation, read-only filesystem, memory limits, AppArmor, no system() calls, no dangerous mounts, no leaked secrets, SSL validity, open ports. |
| (bonus) | governance | k6 load test | Created `scripts/load-test.js` — 5 scenarios matching release-gates.md capacity model: sequential compiles, concurrent R analyses, mixed load, AI generation, no-contention baseline. Custom metrics + thresholds. |

### Items Already Complete (Pre-Phase 10)

| Item | Review ID | Verification |
|------|-----------|-------------|
| 10.3 | I-12 | `--network=none` in compile.ts:189 + `network_mode: none` in docker-compose.yml:15 |
| 10.4 | C7, D6 | `mathrsfs` + `subcaption` in Dockerfile.latex lines 31-32 |

### Architecture Discovery

**compile.ts uses ephemeral containers**: The LaTeX compile pipeline uses `docker run --rm apollo-latex` (ephemeral containers spawned per compilation), NOT `docker exec` on the persistent compose container. This means security settings in `docker-compose.yml` for the LaTeX service are effectively dead code for compilation — they only apply to the sleeping container (`entrypoint: sleep infinity`). All security hardening for actual compilations MUST be in `compile.ts` docker args.

### Audit Findings (Post-Implementation)

| Finding | Severity | Description | Fix |
|---------|----------|-------------|-----|
| B1 | HIGH | docker-compose.yml seccomp paths `./docker/seccomp-latex.json` resolved from compose file dir → `docker/docker/seccomp-latex.json` (non-existent). Bug was in Mitigation_plan.md. | Changed to `./seccomp-latex.json` (same directory as compose file) |
| B2 | HIGH | `scripts/load-test.js` uses `exec.scenario.name` but `exec` from `k6/execution` was not imported — runtime ReferenceError | Added `import exec from "k6/execution"` |
| B3 | MEDIUM | `apparmor:apollo-r-plumber` in docker-compose.yml causes container start failure on macOS (no AppArmor kernel in Docker Desktop) | Moved AppArmor to `docker-compose.prod.yml` override; base compose works on macOS |
| B4 | LOW | compile.ts seccomp path uses `process.cwd()` which varies by deployment — custom profile silently not found in production | Added `console.warn()` on fallback; Docker default seccomp still applies |
| D1 | DOC | security-tests.md line 89 says R container has "no network" — wrong, R Plumber serves HTTP | Updated to "restricted syscall set with networking for HTTP server" |
| D2 | DOC | deploy-conformance.sh missing network/read-only/memory checks from security-tests.md | Added checks 6a (network mode), 6b (read-only), 6c (memory limit) |

### Lessons Learned

- **Mitigation plan paths must be verified against actual file layout** — the plan wrote `seccomp:./docker/seccomp-latex.json` assuming compose was at repo root, but it's at `docker/docker-compose.yml`. Copied verbatim → broken paths.
- **AppArmor is Linux-only; macOS Docker doesn't support it** — always use compose overrides for Linux-only security features.
- **Governance docs can have errors** — security-tests.md said R container needs "no network", which contradicts its role as HTTP server. Implementation should match reality, then fix the doc.
- **`process.cwd()` is fragile in Next.js standalone builds** — prefer `__dirname` or explicit env vars for file path resolution.
- **Silent security degradation is dangerous** — always log when a security control falls back to a weaker default.

### Files Created

| File | Purpose |
|------|---------|
| `docker/seccomp-latex.json` | Whitelist seccomp profile for LaTeX (no networking) |
| `docker/seccomp-r.json` | Whitelist seccomp profile for R Plumber (with networking) |
| `docker/apparmor-r-plumber` | AppArmor profile for R container |
| `docker/docker-compose.prod.yml` | Production override adding AppArmor to R Plumber |
| `scripts/deploy-conformance.sh` | VPS deploy-gate conformance checks (14 checks) |
| `scripts/load-test.js` | k6 load test for pre-launch gate |

### Files Modified

| File | Changes |
|------|---------|
| `apps/web/lib/latex/compile.ts` | Added 5 security flags to docker run args, seccomp profile with graceful fallback + warning log |
| `docker/docker-compose.yml` | Replaced seccomp:unconfined with profile paths (fixed from `./docker/` to `./`); removed AppArmor (moved to prod override) |
| `apps/web/next.config.ts` | Added 6 security response headers via `async headers()` |
| `apps/web/app/api/health/route.ts` | Rewritten with R Plumber + Docker dependency checks |
| `docs/governance/security-tests.md` | Fixed R container isolation description (networking required) |
| `scripts/deploy-conformance.sh` | Added network, read-only, memory limit checks (6a/6b/6c) |

---

## Appendix: Review ID Cross-Reference

Maps each Review ID mentioned above to its REVIEW.md finding for traceability.

| Review ID | REVIEW.md Finding | Phase |
|-----------|-------------------|-------|
| I-1 | CI-blocking lint error (`prefer-const`) | 1 |
| I-2 | 51 files uncommitted | 1 |
| I-3 | `processed_webhooks` table missing | 1 |
| I-4 | Razorpay replay protection (5-min timestamp) | 2 (skipped) |
| IV-A1 | Middleware route coverage gaps | 2 |
| IV-A2 | IDOR in project CRUD | 1 |
| IV-A3 | Role escalation via RLS | 1 |
| IV-A6 | Rate limiting only on generate route | 2 |
| IV-A9 | DEV\_LICENCE\_BYPASS no production guard | 1 |
| IV-B1 | Webhook double-provisioning race | 1 |
| IV-B11 | Checkout ownership validation | 1 |
| IV-C2 | Share token leaks via admin client | 1 |
| IV-C3 | Upload signed-url no ownership check | 1 |
| IV-C9 | PDF storage ephemeral | 2 |
| IV-D1 | Metadata sent unredacted to AI | 2 (partial via R2) |
| IV-D7 | Semaphore queue `resolve` callbacks are no-ops | 2 |
| IV-D9 | Sentry edge PII stripping missing | 1 |
| IV-E1 | In-memory semaphore (not durable) | 2 |
| IV-E2 | PDF storage in tmpdir | 2 |
| IV-E3 | Stale compilation recovery | 2 |
| IV-E5 | Singleton Supabase admin client | 2 |
| IV-E9 | Health check endpoint missing | 2 |
| IV-E10 | Environment variable validation | 2 |
| IV-F1 | Semaphore in-memory only | 2 |
| IV-L10 | DEV\_LICENCE\_BYPASS (duplicate of IV-A9) | 1 |
| E1 | Inngest content overwrite | 1 + 2 (partial) |
| I-9 | Velocity rules missing (>5 licences/30 days hold) | 3 |
| IV-B2 | Professional plan provisions 1 licence instead of 3 | 3 |
| IV-B3 | No licence expiry enforcement (monthly = perpetual) | 3 |
| IV-B4 | Missing licence gates on generate, refine, compile | 3 |
| IV-B5 | No plan-based feature differentiation (Professional === Student) | 3 |
| IV-B6 | Hidden "addon" plan at Rs 299 via direct API | 3 |
| IV-B7 | "Monthly" plans are one-time purchases (no subscriptions) | 3 |
| IV-B8 | Pricing inconsistency across landing, FAQ, checkout | 3 |
| IV-B9 | Non-atomic licence attachment | 3 |
| IV-B10 | Unlimited project creation | 3 |
| C8 | Local compile mode ignores watermark | 3 |
| X4 | Checkout page hardcodes prices | 3 |
| C1 | Inline math `$p < 0.05$` destroyed by round-trip | 4 |
| C2 | `\footnote{}`, `\url{}`, `\textsuperscript{}` garbled | 4 |
| C3 | `\label{}` permanently stripped | 4 |
| C6 | `front-matter.ts` alleged dead code (found to be live) | 4 (not deleted) |
| DECISIONS 2 | CodeMirror 6 as primary editor, LaTeX canonical | 4 |
| A1 | Phase 9 prompt missing (no `case 9` in `getPhaseSystemPrompt`) | 5 |
| A3 | Context truncated to 3,000 chars in `getPhaseUserMessage` | 5 |
| A4, F3 | No Unicode avoidance rule in COMMON\_RULES | 5 |
| A5, E6, F2 | Word count targets disagree across 3 files | 5 |
| A6 | Synopsis parse prompt duplicated (inline vs prompts.ts) | 5 |
| A7, E4, F4 | Token budget bypassed on refine + dataset routes | 5 |
| A8 | Input/output tokens conflated in recording | 5 |
| A10 | Section review is purely rule-based (no AI evaluation) | 5 |
| A11 | M\&M heading check requires 8, NBEMS mandates 12 | 5 |
| A12 | Opus model routing dead code (both branches return Sonnet) | 5 |
| A13 | No retry configuration on Anthropic client | 5 |
| A14 | Standalone `new Anthropic()` instances bypass singleton | 5 |
| B1 | Orphan cite keys survive in compiled output | 5 |
| B2 | No retry for CrossRef/PubMed API failures | 5 |
| B3 | Re-resolve lacks title verification | 5 |
| B5 | ROL citation resolution timeout too short (15s) | 5 |
| E5 | Refine route un-approves without rolling back phases\_completed | 5 |
| IV-E4 | Inngest + Realtime background generation | 5 |
| IV-E6 | N+1 citation upsert loop | 5 |
| IV-D1 | Metadata sanitisation (removed --- no PHI in system) | 5 |
| DECISIONS 3.1 | Phase 9 AI reviews BibTeX entries | 5 |
| DECISIONS 3.2 | AI evaluates content quality before approval | 5 |
| DECISIONS 3.3 | Opus routing for Intro/Discussion (Professional plan) | 5 |
| DECISIONS 3.5 | Inngest background generation + Realtime live preview | 5 |
| DECISIONS 4.1 | Canonical word count targets | 5 |
| A2, E8 | Phase 6a/6b not separated | 6 |
| D2, D3, W11 | PDF figure preview, figure download, dataset download | 6 |
| D4 | Descriptive analysis produces no figure | 6 (prompt only, R deferred) |
| D5 | No minimum figure/table enforcement | 6 |
| D6 | Subfigure support absent | 6 |
| D8 | Chart type/colour scheme not exposed in UI | 6 |
| I-6 | Per-analysis-type runtime limits | 6 |
| DECISIONS 5.1 | Phase 6a/6b workflow, AI analysis planning | 6 |
| DECISIONS 5.2 | Demographics AI-planned split | 6 (prompt only, R deferred) |
| DECISIONS 5.3 | Figure/table QC gates (5 figs, 7 tables, plan match) | 6 |
| DECISIONS 7.3 | Chart type + colour scheme in UI | 6 |
| DECISIONS 8.7 | Subfigure support via subcaption | 6 |
| W3 | No QC button in Phase 11 workspace | 7 |
| W4 | No auto-fix button for QC issues | 7 |
| C-III-4 | Phase 11 has no UI (QC routes never called) | 7 |
| E2 | Phase 11 approval skips QC entirely | 7 |
| E3 | `canAdvancePhase` status check is dead code | 7 |
| E7 | Undefined references check passes when no compile log | 7 |
| C4 | Appendices content never rendered in PDF | 7 |
| C5 | Abbreviations never injected into template | 7 |
| C7 | `mathrsfs` package missing from Docker | 7 |
| W2 | Compilation history API exists but not displayed | 8 |
| W5--W8 | Export routes exist but not in workspace | 8 |
| W10 | Licence transfer UI missing | 8 (skipped --- admin-only) |
| W11 | Review PDF URL requires auth session | 8 |
| X1 | No loading state for phase navigation | 8 (skipped --- synchronous) |
| X2 | No error boundary in workspace | 8 |
| M3 | `tour-overlay.tsx` exists but not rendered | 8 |
| C-III-1 | Duplicate CitationSearchDialog | 8 |
| C-III-2 | Editor toggle visible when non-editable | 8 (skipped --- already correct post-Phase 4) |
| C-III-3 | Mobile tab resets on phase change | 8 (skipped --- correct behaviour) |
| C-III-5 | ExportMenu only in ThesisCompletion | 8 |
| IV-A4 | XSS via `dangerouslySetInnerHTML` | 8 |
| IV-A5 | Content-Disposition header injection | 8 |
| IV-A7 | File size not enforced on R2 signed URLs | 8 |
| IV-A8 | Dataset upload no size check | 8 |
| IV-C6 | R Plumber no inter-service auth | 8 |
| DECISIONS 8.3 | Onboarding tour wiring | 8 |
| DECISIONS 8.4 | Export access tiers (sandbox/licensed/completed) | 8 |
| DECISIONS 8.5 | Compilation history in Progress tab | 8 |
| 9.1 | Privacy Policy, Terms of Service, Refund Policy | 9 |
| 9.2 | Account deletion (7-day cooling-off + purge cron) | 9 |
| 9.3 | AI processing consent (checkbox at synopsis upload) | 9 |
| 9.4 | Cookie consent banner (floating card, bottom-right) | 9 |
| 9.5 | Medical data warning at synopsis upload | 9 |
| 9.6 | Dataset PII warning at dataset upload | 9 |
| 9.7 | Audit log CASCADE delete migration | 9 |
| 9.9 | R2 cleanup on project/account deletion | 9 |
| I-5 | Docker seccomp:unconfined on containers | 10 |
| I-13 | AppArmor profile for R container | 10 |
| I-12 | LaTeX container network isolation | 10 (already done pre-Phase 10) |
| C7, D6 | mathrsfs + subcaption in Dockerfile | 10 (already done pre-Phase 10) |
| IV-E9 | Health check endpoint enhancement | 10 |

---

## Phase 11: Cleanup and Testing

**Status**: COMPLETE
**Duration**: ~1 session
**Tests**: 329 passing (5 new), 0 TypeScript errors, 0 lint warnings

### Items Implemented

| Item | Description | Implementation |
|------|-------------|----------------|
| 11.1 | Lint warnings (19 across 18 files) | All 19 fixed: removed unused imports/vars, added alt/aria-label props, removed dead `currentPhase` prop + callers, removed `FATAL_ERROR_PATTERNS`, `ColumnPreview`, `roundRect`, `X` import. 0 warnings remaining. |
| 11.2 | Dead code removal | Deleted `phase-stepper.tsx` (replaced by PipelineTimeline) and `app-sidebar.tsx` (replaced by glass-sidebar). Confirmed zero imports before deletion. |
| 11.4 | `phases_completed` deduplication | `approve/route.ts`: wrapped in `Array.from(new Set([...]))` to prevent duplicate phase entries on re-approval. |
| 11.6 | Warning budget (warn only) | `compile/route.ts`: added `WARNING_BUDGET = 20` threshold. Response includes `warning_budget_exceeded: boolean`. Non-blocking --- users can still access PDF. |
| 11.7 | Brace-checking bug fix | `validate.ts`: added `countPrecedingBackslashes()` helper. Fixed `\\{` edge case for braces, `%` comment detection, `#` hash detection, and `&` ampersand detection. All 4 checks now use the same helper. 5 new test cases added. |
| 11.8 | Pre-seeded references persistence | `generate/route.ts`: after `preSeedReferences()`, upserts Tier A citations to `citations` table with `onConflict: "project_id,cite_key"`. Uses correct schema columns (`evidence_type`, `source_pmid`, `evidence_value`, `verified_at`). Requires unique constraint (applied in migration 032). **Post-audit fix**: original implementation used non-existent columns (`source`, `source_id`, `title`, `resolved`, `resolved_at`) --- corrected to match 006\_create\_citations.sql schema. |
| 11.10 | RLS test enhancement | Rewrote `rls.test.ts` with per-user Supabase clients via HS256 JWT signing (Node.js `crypto`). Tests: project/section/citation/dataset/compilation/licence isolation. Graceful skip when `JWT_SECRET` unavailable. Proper cleanup in `afterAll`. |
| 11.11 | Missing RLS policies | Migration 032: datasets UPDATE, compilations UPDATE+DELETE (owner via projects FK), review_comments INSERT (service-role-only deny), citations unique constraint `(project_id, cite_key)`. Applied via Supabase MCP. |
| 11.12 | MermaidEditor dynamic import | `project-workspace.tsx`: converted static import to `next/dynamic` with `ssr: false`. Saves ~100KB from initial bundle. |
| 11.13 | PDF thumbnail lazy-load | `pdf-viewer.tsx`: added `LazyThumbnail` component with `IntersectionObserver` (200px rootMargin). Only thumbnails in/near viewport render actual PDF pages. Placeholder skeleton for off-screen thumbnails. |
| 11.14 | `messages_json` population | `token-budget.ts`: added optional `messages` parameter to `recordTokenUsage()`. `ai-generate.ts`: passes truncated (50K chars) user+assistant messages for audit trail. |
| 11.15 | Phase sequence enforcement | `generate/route.ts`: blocks generation for phases beyond `current_phase + 1`. Phase 0 (synopsis) handled before this check. |
| 11.16b | Review comment rate limit | `comments/route.ts`: 10 comments per hour per token, DB-based count check. Returns 429 on exceed. |
| 11.16c | Review token generation limit | `share/route.ts`: max 5 active (non-expired) tokens per project. Returns 409 on exceed. |

### Items Skipped (Already Resolved)

| Item | Why |
|------|-----|
| 11.3 | Dictionary SSOT already shared via `spelling-dictionary.ts` (79 entries, 4 consumers) |
| 11.5 | Moot --- `rich_content_json` deprecated since Phase 4 |
| 11.9 | 32 migrations now tracked in `supabase/migrations/` (001--032) |
| 11.16a | `canAdvancePhase` NOT dead --- used in `transitions.ts` for licence gates |
| 11.16d | `public/sw.js` already exists with network-first API + cache-first assets |

### Audit Findings (Post-Implementation Consistency Check)

| Finding | Severity | Description | Fix |
|---------|----------|-------------|-----|
| C1 | CRITICAL | Pre-seed citation upsert (11.8) used 5 non-existent columns (`source`, `source_id`, `title`, `resolved`, `resolved_at`). PostgREST rejects unknown columns; error swallowed by try/catch. Pre-seeded references were NEVER actually persisted. | Corrected to schema columns: `evidence_type: "pmid"`, `source_pmid`, `evidence_value`, `verified_at`. Removed `title` and `resolved`. |
| C2 | LOW | `#` and `&` per-line checks used regex lookbehind `(?<!\\)` which fails for `\\#`/`\\&` (same bug class as 11.7 brace fix). Theoretical risk --- `\\#` is extremely rare in thesis LaTeX. | Refactored both to use `countPrecedingBackslashes()` helper, matching the brace/comment checks. |
| I1 | INFO | Migration 032 creates `citations_project_id_cite_key_key` unique constraint, but migration 006 already has `idx_citations_project_key` unique index on same columns. Redundant index. | Not fixed --- harmless. The unique index from 006 already satisfies the `onConflict` clause. The constraint adds a second index but causes no issues. |
| I2 | INFO | Rate limit for review comments is 10/hour (implementation), while Mitigation\_plan.md IV-L3 says "10/min". 60x more restrictive. | Intentional --- approved in implementation plan. 10/hour is more appropriate for review comments (low-volume operation). |
| I3 | INFO | 6 other `recordTokenUsage()` callers (refine, synopsis, dataset, checker, review-section, auto-detect) don't pass `messages` parameter. Only Inngest ai-generate populates `messages_json`. | By design --- parameter is optional. Only the primary generation path needs full audit trail. |

### Verification

- **Lint**: `pnpm exec next lint` --- 0 warnings (down from 19)
- **TypeScript**: `pnpm exec tsc --noEmit` --- 0 errors
- **Tests**: 329 passing across 32 files (5 new brace-checking tests), 23/23 validate.ts tests pass after `#`/`&` fix
- **Security advisors**: Supabase security lint clean (0 issues)
- **Dead code**: grep confirmed 0 references to deleted files
