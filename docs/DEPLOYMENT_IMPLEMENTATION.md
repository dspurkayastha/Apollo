# Apollo Deployment Implementation Log

**Started**: 2026-02-19
**Target**: `apollo.sciscribesolutions.com` on Hetzner CX23
**Guide**: `docs/DEPLOYMENT.md` (source of truth)

---

## Pre-Deployment Codebase Audit

Before starting deployment, we verified every reference in DEPLOYMENT.md against the actual codebase.

### Verification Results

| Check | Status | Notes |
|-------|--------|-------|
| Migration files (32) | PASS | 001-032 all present in `apps/web/supabase/migrations/` |
| `docker-compose.yml` | PASS | LaTeX + R Plumber services defined |
| `docker-compose.prod.yml` | PASS | AppArmor overlay for R Plumber |
| `Dockerfile.latex` | PASS | Exists at `docker/Dockerfile.latex` |
| `Dockerfile.r-plumber` | PASS | Exists at `docker/Dockerfile.r-plumber` |
| `seccomp-latex.json` | PASS | Valid JSON at `docker/seccomp-latex.json` |
| `seccomp-r.json` | PASS | Valid JSON at `docker/seccomp-r.json` |
| `apparmor-r-plumber` | PASS | Exists at `docker/apparmor-r-plumber` |
| `deploy-conformance.sh` | PASS | 12 checks, exists at `scripts/deploy-conformance.sh` |
| `load-test.js` | PASS | k6 script at `scripts/load-test.js`, uses `BASE_URL` env var |
| Health endpoint | PASS | Returns `{status, timestamp, version, checks}` shape |
| Inngest functions (6) | PASS | All 6 IDs match: `thesis-phase-workflow`, `ai-generate-section`, `analysis-runner`, `stale-cleanup`, `licence-expiry-cron`, `account-deletion-cron` |
| `lib/env.ts` validation | PASS | 10 required vars (fail-fast), 15 optional vars (warn) |
| `CLERK_WEBHOOK_SECRET` usage | PASS | Used in `api/webhooks/clerk/route.ts` but NOT in env.ts required/optional lists |
| `compile.ts` path resolution | PASS | Uses `process.cwd() + ../../templates` — requires cwd = `apps/web/` |
| `next.config.ts` output mode | FIXED | `output: "standalone"` removed during deploy — `next start` incompatible with standalone mode |
| `next.config.ts` image hostname | N/A | Reusing same Supabase project (`ugkqdopvsmtzsqvnnmck`) — no change needed |

### Cloud Resources (Reused for Production)

| Resource | Status | Details |
|----------|--------|---------|
| Supabase | Active | `ugkqdopvsmtzsqvnnmck.supabase.co`, wiped and rebuilt with all 32 migrations via MCP |
| Upstash Redis | Active | `apollo` database, free tier, region: `ap-south-1` (Mumbai), endpoint: `patient-kid-40113.upstash.io` |
| Supabase security advisors | CLEAN | 0 security lints after all 32 migrations |

### Issues Found During Audit

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| 1 | INFO | `CLERK_WEBHOOK_SECRET` is not in `lib/env.ts` required or optional lists | Not blocking — it's validated at runtime in the webhook route. Consider adding to optional list post-deploy |
| 2 | FIXED | `output: "standalone"` in next.config.ts blocks `next start` | Removed from `next.config.ts` on VPS during deploy. Pending git commit |
| 3 | FIXED | Supabase had only 13 of 32 migrations | Wiped schema, applied all 32 sequentially via MCP. Fixed circular dep in migration 001/002 |

---

## Step 1: Domain + VPS Provisioning

**Status**: COMPLETE (VPS provisioned)
**Owner**: User
**Completed**: 2026-02-19

### Results

**1b. Hetzner VPS**:
- **Name**: `hetzner-sciscribe`
- **IP**: `37.27.211.131`
- **Spec**: CX23 | x86 | 40 GB SSD | 2 vCPU | 4 GB RAM
- **Location**: Helsinki (eu-central) — Finland
- **OS**: Ubuntu (assumed 22.04)

**1a. Domain**: `sciscribesolutions.com` active. Subdomain `apollo.sciscribesolutions.com` configured.

**Deliverables**:
- [x] VPS IP address: `37.27.211.131`
- [x] Domain active and DNS configured
- [x] SSH access confirmed

---

## Step 2: DNS + VPS Setup

**Status**: COMPLETE
**Owner**: User
**Completed**: 2026-02-19

### Results

**DNS**: `apollo.sciscribesolutions.com` → `37.27.211.131` (propagated)

**Installed versions**:
| Component | Version |
|-----------|---------|
| Docker | 29.2.1 |
| Docker Compose | v5.0.2 |
| Node.js | v20.20.0 |
| pnpm | 10.30.0 |
| PM2 | 6.0.14 |
| Caddy | v2.10.2 |

**Firewall**: UFW enabled (SSH, 80, 443)

**Deliverables**:
- [x] DNS propagation confirmed
- [x] All dependencies installed
- [x] UFW firewall enabled

---

## Step 3: Supabase (Database)

**Status**: COMPLETE
**Owner**: User + Claude (MCP)
**Completed**: 2026-02-20

### Decision

Reused existing Supabase project (`ugkqdopvsmtzsqvnnmck`) rather than creating a new one. Wiped all data and applied all 32 migrations cleanly from scratch via MCP.

### Process

1. Dropped `public` schema with CASCADE, recreated it
2. Cleared `supabase_migrations.schema_migrations` tracking table
3. Applied all 32 migrations sequentially via MCP (`mcp__supabase__apply_migration`)
4. Fixed circular dependency: migration 001 (`organisations`) had RLS policy referencing `users` table that doesn't exist yet. Split: create table in 001 without policy, add policy in 002 after `users` exists
5. Fixed duplicate index: `citations` had both `citations_project_id_cite_key_key` (unique constraint from 032) and `idx_citations_project_key` (unique index from 006). Dropped redundant index

### Verification

- 17 tables, all with RLS enabled
- 2 seed organisations (WBUHS, SSUHS)
- 0 data rows (clean slate)
- 0 security lints
- 32 tracked migrations

**Deliverables**:
- [x] Supabase project reused (same credentials)
- [x] Schema wiped and rebuilt clean
- [x] All 32 migrations applied via MCP
- [x] 17 tables verified
- [x] 0 security advisors

---

## Step 4: Clerk (Authentication)

**Status**: COMPLETE
**Owner**: User
**Completed**: 2026-02-20

### Results

- Production instance created with DNS verification and SSL
- Webhook configured: `https://apollo.sciscribesolutions.com/api/webhooks/clerk`
  - Events: `user.created`, `user.deleted`
  - Signing secret collected
- Test mode configured for Razorpay verification (test email: `+clerk_test` subaddress, code: `424242`)

**Deliverables**:
- [x] Production Clerk instance created
- [x] DNS verified and SSL active
- [x] Webhook endpoint configured (2 events)
- [x] 3 credentials collected (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`)

---

## Step 5: Cloudflare R2 (File Storage)

**Status**: COMPLETE
**Owner**: User
**Completed**: 2026-02-20

### Results

Reused existing `apollo-files` bucket and API token. Updated CORS to include production origin (`https://apollo.sciscribesolutions.com`).

**Deliverables**:
- [x] Bucket exists: `apollo-files`
- [x] Existing API token reused (same credentials)
- [x] CORS updated for production domain
- [x] 3 credentials carried over (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`)

---

## Step 6: Anthropic (Claude AI)

**Status**: COMPLETE
**Owner**: User
**Completed**: 2026-02-20

### Results

Using personal API token on Max plan for beta testing. No spending limit needed (Max plan).

**Deliverables**:
- [x] API key verified active (personal Max plan)
- [x] `ANTHROPIC_API_KEY` added to `.env.local`

---

## Step 7: Upstash Redis

**Status**: COMPLETE (reusing existing)
**Owner**: Claude
**Completed**: 2026-02-19

### Resolution

Reusing existing `apollo` database (free tier only allows 1 DB).
- **Name**: `apollo`
- **Region**: `ap-south-1` (Mumbai)
- **Tier**: Free (500K requests/month)
- **Endpoint**: `patient-kid-40113.upstash.io`
- **REST URL**: `https://patient-kid-40113.upstash.io`

Will flush dev data (`FLUSHDB`) before go-live during Step 14 verification.

Credentials available from Upstash MCP — will be added to `.env.local` during Step 12.

---

## Step 8: Inngest (Background Jobs)

**Status**: COMPLETE
**Owner**: User
**Completed**: 2026-02-20

### Results

- App `apollo` created in Production environment
- App URL set: `https://apollo.sciscribesolutions.com/api/inngest`
- Auto-synced after deploy --- all 6 functions discovered:
  - `thesis-phase-workflow` (thesis/phase.approved)
  - `ai-generate-section` (thesis/section.generate)
  - `analysis-runner` (analysis/run.requested)
  - `stale-cleanup` (cron: every 5 min)
  - `licence-expiry-cron` (cron: daily)
  - `account-deletion-cron` (cron: daily)
- SDK version: 3.52.0, Framework: Next.js, Method: Serve

**Note**: Event key format is `TPKsL_xxx` (not legacy `evt_xxx`). This is fine --- Inngest changed key prefixes.

**Deliverables**:
- [x] Inngest app created (Production)
- [x] 2 credentials collected (`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`)
- [x] App URL configured and 6 functions auto-discovered

---

## Step 9: Razorpay (INR Payments)

**Status**: COMPLETE (webhook pending site verification)
**Owner**: User
**Completed**: 2026-02-20

### Results

- Business verified under SciScribe Solutions
- Website `https://apollo.sciscribesolutions.com` submitted for verification (pending --- site was just deployed)
- Test account credentials shared with Razorpay (Clerk test mode: `+clerk_test` email, code `424242`)
- API keys collected and added to `.env.local`

### Subscription Plans Created

| Plan ID | Name | Amount | Billing |
|---------|------|--------|---------|
| `plan_SI9MbZXkWHAflo` | Student Monthly | Rs 5,499/month | Monthly |
| `plan_SI9NmdAviNoFvv` | Professional Monthly | Rs 14,999/month | Monthly |
| `plan_SI9P2LiSDWy5qi` | Add-on Thesis | Rs 3,999/month | Monthly |

**Note**: Professional Monthly price (Rs 14,999) differs from codebase config (`lib/pricing/config.ts` has Rs 0, `comingSoon: true`). Codebase update pending.

### Pending

- [ ] Webhook endpoint: `https://apollo.sciscribesolutions.com/api/webhooks/razorpay` (create after site verification)
- [ ] `RAZORPAY_WEBHOOK_SECRET` (generated when webhook is created)

**Deliverables**:
- [x] Business verification complete
- [x] 3 subscription plans created with Plan IDs
- [x] API keys collected (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`)
- [x] Plan IDs added to `.env.local`
- [ ] Webhook configuration (pending site verification)

---

## Step 10: Stripe (USD Payments)

**Status**: DEFERRED
**Owner**: User
**Notes**: Deferred for initial beta launch. INR payments (Razorpay) are primary. Stripe env vars left blank in `.env.local` --- `lib/env.ts` treats them as optional (warns but doesn't fail).

### When Ready

See DEPLOYMENT.md Step 10 for full details:
- Create 4 products/prices (Student OT, Student Monthly, Professional OT, Addon)
- Configure webhook: `https://apollo.sciscribesolutions.com/api/webhooks/stripe`
- Events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`

---

## Step 11: Build and Deploy Docker Containers

**Status**: COMPLETE
**Owner**: User + Claude
**Completed**: 2026-02-20

### Results

Both Docker containers running with full security hardening:

```
CONTAINER ID   IMAGE              STATUS                    PORTS                      NAMES
ac2757469570   apollo-latex       Up (sleeping)                                        apollo-latex
c4ceef6bc9f3   apollo-r-plumber   Up (healthy)              127.0.0.1:8787->8787/tcp   apollo-r-plumber
```

**Security stack**:
- `apollo-latex`: `cap_drop:ALL` + `no-new-privileges` + custom seccomp (`seccomp-latex.json`) + read-only filesystem + network:none
- `apollo-r-plumber`: `cap_drop:ALL` + `no-new-privileges` + AppArmor enforce mode (`apollo-r-plumber`) + read-only filesystem + Docker default seccomp

**Deliverables**:
- [x] Both Docker images built (apollo-latex, apollo-r-plumber)
- [x] AppArmor profile loaded and enforced (zero denials in steady state)
- [x] R Plumber healthy at localhost:8787 (`{"status":["ok"]}`)
- [x] LaTeX compilation verified (pdflatex available)
- [x] R_PLUMBER_SECRET generated and saved

### Issues Encountered and Resolved

| # | Issue | Root Cause | Fix | Commit |
|---|-------|-----------|------|--------|
| 1 | Wrong branch on VPS | Default branch != main | `git checkout main && git pull` | — |
| 2 | `subcaption`, `mathrsfs` missing in TL2025 | Absorbed into `scheme-small` collections | Removed from Dockerfile.latex | `9c0bcec` |
| 3 | Docker Compose v5 rejects duplicate `security_opt` | v5 strict YAML validation — `no-new-privileges` in both base + prod overlay | Removed duplicate from prod overlay | `17f8975` |
| 4 | AppArmor denied `/bin/bash` | R's `/usr/bin/R` is a bash wrapper script | Added bash execution rules to profile | `f034b13` |
| 5 | AppArmor denied R library execution | Profile had `mr` (read+mmap) not `mrix` (read+mmap+inherit+execute) | Changed to `mrix` for R library paths | `4f95f26` |
| 6 | Custom seccomp-r.json too restrictive | Missing `prlimit64`, `sysinfo`, `socketpair`, etc. | Reverted to Docker default seccomp for R | `a594e68` |
| 7 | AppArmor missing Debian merged-usr paths | `/bin` symlinks to `/usr/bin` in Debian — both paths needed | Added dual paths for all shell utilities | `2cc8856` |
| 8 | AppArmor parse error on `/usr/bin/[` | `[` is regex metacharacter in AppArmor glob syntax | Removed rule (covered by `/usr/bin/test`) | `ed4948a` |

### AppArmor Profiling Methodology

1. Loaded profile in **complain mode** (`apparmor_parser -C`) to audit without blocking
2. Ran container under complain mode and collected `dmesg` DENIED entries
3. Categorised all denied paths and added them to the profile with minimum permissions
4. Switched to **enforce mode** (`apparmor_parser -r`) and verified zero operational denials
5. Added `/proc/version_signature r` for the last non-critical denial (R reads kernel version)

### Security Note

Custom seccomp (`seccomp-r.json`) proved too fragile for R/bash startup — the allowlist approach requires tracking every libc syscall used by bash, R, and all R packages. Docker's default seccomp (blocks ~44 dangerous syscalls like `ptrace`, `kexec_load`, `mount`, `reboot`, etc.) provides sufficient protection when combined with `cap_drop:ALL` + `no-new-privileges` + AppArmor + read-only filesystem.

---

## Step 12: Deploy Next.js App

**Status**: COMPLETE
**Owner**: User + Claude
**Completed**: 2026-02-20

### Process

1. **12a. next.config.ts**: No hostname change needed (reusing same Supabase project). Removed `output: "standalone"` (was blocking `next start` --- see Issues below)
2. **12b. Dependencies**: `pnpm install --frozen-lockfile` --- 1245 packages, 39.3s
3. **12c. .env.local**: Created with all production values (Stripe vars intentionally blank)
4. **12d. Build**: `pnpm build` --- compiled in 2.6min, 24 static + 70 dynamic routes, 0 errors
5. **12e. PM2 config**: `ecosystem.config.js` created (see final config below)
6. **12f. Start + persist**: `pm2 start`, `pm2 save`, `pm2 startup` (systemd service enabled)
7. **12g. Verify**: Health check returns `{"status":"ok","checks":{"r_plumber":"ok","docker":"ok"}}`

### Final PM2 Config

```javascript
module.exports = {
  apps: [{
    name: "apollo-web",
    script: "node_modules/next/dist/bin/next",
    args: "start -H 0.0.0.0 -p 3000",
    cwd: "/opt/apollo/apps/web",
    env: { NODE_ENV: "production" },
  }],
};
```

### Issues Encountered and Resolved

| # | Issue | Root Cause | Fix |
|---|-------|-----------|------|
| 1 | PM2 SyntaxError on `node_modules/.bin/next` | `.bin/next` is a shell script, not a Node module. PM2 tried to run it with Node | Changed script to `node_modules/next/dist/bin/next` (actual JS entry point) |
| 2 | `"next start" does not work with "output: standalone"` | `next.config.ts` had `output: "standalone"` which is incompatible with `next start` | Removed `output: "standalone"` via `sed` on VPS. Required `rm -rf .next` + full rebuild |
| 3 | `Failed to proxy http://localhost:3000/api/health [Error: socket hang up]` | Next.js bound to `127.0.0.1` (IPv4) but middleware rewrites to `localhost:3000`. On this Ubuntu system, `localhost` resolves to `::1` (IPv6 only): `getent hosts localhost` returns `::1 localhost` | Changed `-H 127.0.0.1` to `-H 0.0.0.0` (listen all interfaces). Added `ufw deny 3000` to block external access |

### Firewall Update

- Added `ufw deny 3000` (both IPv4 and IPv6) to block external access to Next.js directly
- All external traffic goes through Caddy (ports 80/443)

**Deliverables**:
- [x] `output: "standalone"` removed from next.config.ts (pending git commit)
- [x] .env.local populated with all production values
- [x] Build succeeded (0 errors, 94 routes)
- [x] PM2 running and boot-persistent (systemd)
- [x] Health check returns `{"status":"ok","checks":{"r_plumber":"ok","docker":"ok"}}`
- [x] UFW blocks port 3000 externally

---

## Step 13: Configure Caddy (Reverse Proxy + SSL)

**Status**: COMPLETE
**Owner**: User
**Completed**: 2026-02-20

### Results

```
HTTP/2 200
alt-svc: h3=":443"; ma=2592000
strict-transport-security: max-age=63072000; includeSubDomains; preload
x-content-type-options: nosniff
x-frame-options: DENY
referrer-policy: strict-origin-when-cross-origin
permissions-policy: camera=(), microphone=(), geolocation=()
via: 1.1 Caddy
```

- Let's Encrypt SSL certificate auto-obtained
- HTTP/2 enabled with h3 (QUIC) alt-svc
- All security headers present
- `-Server` header stripped (no Caddy version leak)

**Deliverables**:
- [x] Caddyfile configured at `/etc/caddy/Caddyfile`
- [x] SSL certificate auto-obtained (Let's Encrypt)
- [x] HTTPS returns HTTP/2 200 with all security headers
- [x] Caddy enabled as systemd service (auto-start on reboot)

---

## Step 14: Post-Deployment Verification

**Status**: IN PROGRESS
**Owner**: User + Claude
**Started**: 2026-02-20

### Checklist

- [x] `curl https://apollo.sciscribesolutions.com/api/health` returns `{"status":"ok"}`
- [x] Inngest app registered with 6 functions (auto-synced)
- [x] Landing page loads in browser via HTTPS
- [ ] `APOLLO_DOMAIN=apollo.sciscribesolutions.com bash scripts/deploy-conformance.sh` --- all PASS
- [ ] Sign-up flow works (Clerk)
- [ ] Clerk webhook fires (user row in Supabase `users` table)
- [ ] Create project works (Supabase write)
- [ ] Upload synopsis works (AI parsing)
- [ ] Generate content works (Inngest + Claude)
- [ ] Compile PDF works (Docker LaTeX)
- [ ] Upload dataset works (R2 storage)
- [ ] Run analysis works (R Plumber)

---

## Step 15: Load Testing

**Status**: DEFERRED (post-beta)
**Owner**: User

Run from local machine (not VPS):
```bash
BASE_URL=https://apollo.sciscribesolutions.com k6 run scripts/load-test.js
```

---

## Step 16: Beta Launch Checklist

**Status**: NOT STARTED

See DEPLOYMENT.md Step 16 for full checklist.

---

## Suggestions and Alternatives

### S1: ~~Remove `output: "standalone"` from next.config.ts~~ DONE

Removed during deploy (Step 12). `next start` is incompatible with standalone mode. Pending git commit.

### S2: Add `CLERK_WEBHOOK_SECRET` to env.ts optional list

Currently `CLERK_WEBHOOK_SECRET` is validated at runtime in the webhook route but isn't in `lib/env.ts`. Adding it to the optional list would give a build-time warning if missing, which is helpful for new deployments.

### S3: Upstash Redis --- consider creating a production database

The current `apollo` Redis is free-tier with 500K request limit. For production, consider:
- Creating a separate `apollo-production` database (clean separation)
- Or upgrading to pay-as-you-go if you exceed free tier limits

### S4: Supabase free tier limits

Free tier: 500 MB database, 1 GB bandwidth/month, 50 MB file storage. Database was wiped and rebuilt clean (0 rows). Monitor usage as beta users onboard. Supabase Pro ($25/month) gives 8 GB DB + 250 GB bandwidth.

### S5: Consider a non-root deploy user on VPS

Running everything as root works but is not best practice. Consider:
```bash
adduser apollo --disabled-password
usermod -aG docker apollo
# Clone repo and run PM2 as apollo user
```

### S6: Update `lib/pricing/config.ts` for Professional Monthly

Razorpay plan created at Rs 14,999/month but codebase has `professional_monthly` as `comingSoon: true` with `prices: { INR: 0, USD: 0 }`. Update config before enabling the plan in the UI.

---

## Deferred / TODO Items

| Item | Priority | Notes |
|------|----------|-------|
| Stripe setup (Step 10) | Medium | USD payments deferred for beta. INR (Razorpay) is primary |
| Razorpay webhook | High | Pending site verification by Razorpay. Create webhook after approval |
| Update `professional_monthly` pricing (S6) | Medium | Codebase says Rs 0 / comingSoon, Razorpay plan is Rs 14,999 |
| Load testing (Step 15) | Medium | Run before public launch, after beta stabilises |
| Sentry error tracking | Medium | Optional but highly recommended for production |
| PostHog analytics | Low | Optional, can add post-launch |
| Non-root deploy user (S5) | Low | Security improvement, not blocking |
| Add `CLERK_WEBHOOK_SECRET` to env.ts (S2) | Low | Developer experience improvement |
| Full thesis E2E test | High | Must complete at least one full 11-phase thesis before beta invite |
| ~~Razorpay KYC verification~~ | ~~High~~ | DONE --- verified under SciScribe Solutions |
| ~~Remove `output: "standalone"` (S1)~~ | ~~Low~~ | DONE --- removed during deploy, pending git commit |

---

## Lessons Learnt

1. **[Pre-deploy]** The Supabase MCP-connected project has only 13 of 32 migrations applied --- production must use `supabase db push` or SQL Editor to apply all 32 in order.
2. **[Pre-deploy]** `next.config.ts` has a hardcoded dev Supabase hostname in `images.remotePatterns` --- easy to forget during deployment. Should be parameterised via env var in a future refactor.
3. **[Pre-deploy]** `compile.ts` resolves paths relative to `process.cwd()` (lines 113, 178, 323). This is why `next start` (preserves cwd) works but standalone `server.js` (overrides cwd via `process.chdir`) would break LaTeX compilation entirely.
4. **[Step 11]** TeX Live 2025 absorbed `subcaption` and `mathrsfs` into `scheme-small` collections. Package names change between TL releases --- always verify against the TL2025 repository before adding specific packages.
5. **[Step 11]** Docker Compose v5 is stricter than v2 --- duplicate list entries in YAML overlays (e.g., `security_opt`) cause hard errors. Base compose must not repeat entries that prod overlay also sets.
6. **[Step 11]** AppArmor profiling on Debian merged-usr systems requires dual paths (`/bin/*` AND `/usr/bin/*`) for all shell utilities. The `/bin` -> `/usr/bin` symlink means processes can reference either path.
7. **[Step 11]** R's `/usr/bin/R` is a bash wrapper script, not a binary. AppArmor profile must use `rix` (read+inherit+execute) not just `ix` for scripts, because bash needs to READ the script to execute it.
8. **[Step 11]** Custom seccomp allowlists are too fragile for complex runtimes like R. Docker's default seccomp (~44 blocked dangerous syscalls) + AppArmor + cap_drop:ALL provides equivalent protection with far fewer maintenance issues.
9. **[Step 11]** AppArmor glob syntax treats `[` as regex metacharacter. Paths like `/usr/bin/[` cannot be whitelisted directly --- use the equivalent binary name (`/usr/bin/test`).
10. **[Step 11]** Always profile AppArmor in complain mode first (`apparmor_parser -C`), analyse `dmesg` audit logs, then switch to enforce mode. Never skip straight to enforce --- the deny surface is too large to predict.
11. **[Step 3]** Supabase migration ordering matters for RLS policies. Migration 001 created `organisations` with RLS referencing `users` (doesn't exist yet). Fix: split table creation and policy creation into separate migrations.
12. **[Step 3]** Duplicate indexes waste space and confuse the query planner. Migration 006 created `idx_citations_project_key` (unique index) and migration 032 added `citations_project_id_cite_key_key` (unique constraint). Same columns --- drop the redundant index.
13. **[Step 12]** `output: "standalone"` in `next.config.ts` is **incompatible** with `next start`. Next.js 15 hard-errors: `"next start" does not work with "output: standalone" configuration`. Must use one or the other, not both.
14. **[Step 12]** PM2 `script` must point to a JS file, not a shell script. `node_modules/.bin/next` is a bash shim --- PM2 tries to parse it as JS and gets `SyntaxError: missing ) after argument list`. Use `node_modules/next/dist/bin/next` instead.
15. **[Step 12]** On Ubuntu, `localhost` resolves to IPv6 `::1` only (`getent hosts localhost` returns `::1`). Next.js middleware internally rewrites to `http://localhost:3000/...`. If the server is bound to `127.0.0.1` (IPv4 only), the rewrite proxy fails with `ECONNRESET`. Fix: bind to `0.0.0.0` + firewall, or ensure `localhost` resolves to `127.0.0.1`.
16. **[Step 12]** When cleaning a stale `.next` build, `rm -rf .next` is required. Changing `next.config.ts` alone doesn't invalidate the build cache --- the old standalone metadata persists and Next.js continues to warn/error.

---

## Pending Git Commits

Changes made directly on VPS during deployment that need to be committed and pushed:

| File | Change | Reason |
|------|--------|--------|
| `apps/web/next.config.ts` | Removed `output: "standalone"` (line 23) | Incompatible with `next start`. Next.js 15 hard-errors when both are used |

**Note**: `ecosystem.config.js` and `.env.local` are VPS-only files (not tracked in git). The Caddyfile lives at `/etc/caddy/Caddyfile` on the VPS (also not tracked).

### To commit (after initial testing)

```bash
# On local machine
# Edit next.config.ts to remove output: "standalone"
git add apps/web/next.config.ts
git commit -m "Remove output: standalone from next.config.ts

next start is incompatible with standalone mode in Next.js 15.
The standalone server.js also breaks compile.ts path resolution
(process.chdir overrides cwd). Using next start with PM2 instead.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push origin main
```

---

## Completion Summary

| Step | Status | Notes |
|------|--------|-------|
| Pre-deploy audit | COMPLETE | All 16 checks passed, 3 issues found and resolved |
| Step 1: Domain + VPS | COMPLETE | VPS: `37.27.211.131` Helsinki, domain active |
| Step 2: DNS + VPS setup | COMPLETE | DNS propagated, all deps installed, UFW enabled |
| Step 3: Supabase | COMPLETE | Reused project, wiped + rebuilt, 32 migrations, 17 tables |
| Step 4: Clerk | COMPLETE | Production instance, webhook, test mode configured |
| Step 5: R2 | COMPLETE | Reused bucket + token, CORS updated |
| Step 6: Anthropic | COMPLETE | Personal Max plan API key |
| Step 7: Upstash | COMPLETE | Reusing existing `apollo` DB (ap-south-1) |
| Step 8: Inngest | COMPLETE | App synced, 6 functions discovered |
| Step 9: Razorpay | COMPLETE* | 3 plans created, API keys set. *Webhook pending site verification |
| Step 10: Stripe | DEFERRED | USD payments deferred for beta launch |
| Step 11: Docker containers | COMPLETE | Both healthy, AppArmor enforced, 8 issues resolved |
| Step 12: Next.js deploy | COMPLETE | PM2 running, health OK, 3 issues resolved |
| Step 13: Caddy + SSL | COMPLETE | HTTP/2, Let's Encrypt SSL, all security headers |
| Step 14: Verification | IN PROGRESS | Health + Inngest done, user testing remaining |
| Step 15: Load testing | DEFERRED | Post-beta |
| Step 16: Beta checklist | NOT STARTED | Depends on Step 14 |
