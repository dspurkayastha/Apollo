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

**Status**: NOT STARTED

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
