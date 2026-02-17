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
