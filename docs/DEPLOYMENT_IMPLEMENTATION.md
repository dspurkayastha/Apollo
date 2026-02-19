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
| `next.config.ts` output mode | PASS | `output: "standalone"` (build artifact created but we use `next start`) |
| `next.config.ts` image hostname | ACTION NEEDED | Hardcoded dev hostname `ugkqdopvsmtzsqvnnmck.supabase.co` — must update for production |

### Existing Cloud Resources (Development)

| Resource | Status | Details |
|----------|--------|---------|
| Supabase (dev) | Active | `ugkqdopvsmtzsqvnnmck.supabase.co`, 17 tables, 13/32 migrations applied via MCP |
| Upstash Redis | Active | `apollo` database, free tier, region: `ap-south-1` (Mumbai), endpoint: `patient-kid-40113.upstash.io` |
| Supabase security advisors | CLEAN | 0 security lints |

### Issues Found During Audit

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| 1 | INFO | `CLERK_WEBHOOK_SECRET` is not in `lib/env.ts` required or optional lists | Not blocking — it's validated at runtime in the webhook route. Consider adding to optional list post-deploy |
| 2 | INFO | `output: "standalone"` in next.config.ts is unnecessary since we use `next start` | Non-blocking — standalone build artifact is generated but unused. Can remove post-deploy to save ~30s build time |
| 3 | ACTION | Dev Supabase has only 13 of 32 migrations via MCP | Production project will get all 32 via `supabase db push`. Not an issue |

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

**1a. Domain**: Pending confirmation — need to verify `sciscribesolutions.com` is active before creating DNS record.

**Deliverables**:
- [x] VPS IP address: `37.27.211.131`
- [ ] Domain status: pending confirmation
- [ ] SSH access confirmed: pending

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

## Step 3: Supabase (Production Database)

**Status**: NOT STARTED
**Owner**: User creates project; Claude can apply migrations via MCP or verify schema
**Can Claude do this?**: Partially — can apply migrations via MCP if production project is connected

### Instructions for User

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project** (do NOT reuse the dev project)
3. Name: `apollo-production`, Region: `ap-south-1` (Mumbai)
4. Save the database password securely
5. From Settings > API, collect:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Migration Options

**Option A (Recommended): Supabase CLI on VPS**
```bash
cd /opt/apollo/apps/web
npx supabase link --project-ref <project-ref>
npx supabase db push
```

**Option B: SQL Editor** — run each of the 32 migration files in order

**Option C: MCP** — if you connect the production project to the Supabase MCP, Claude can apply migrations

### Verification
```sql
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
-- Expected: 17 tables
```

**Deliverables to report back**:
- [ ] Production Supabase project created
- [ ] 3 credentials collected
- [ ] 32 migrations applied
- [ ] 17 tables verified

---

## Step 4: Clerk (Authentication)

**Status**: NOT STARTED
**Owner**: User (manual — Clerk dashboard)
**Can Claude do this?**: No — requires Clerk dashboard access

### Instructions for User

1. Create **production instance** in Clerk (separate from dev)
2. Enable Email + optional Google OAuth sign-in
3. Configure paths: sign-in `/sign-in`, sign-up `/sign-up`, after-auth `/dashboard`
4. Add webhook endpoint: `https://apollo.sciscribesolutions.com/api/webhooks/clerk`
   - Events: `user.created`, `user.deleted`
   - Copy signing secret
5. Collect: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`

**Deliverables to report back**:
- [ ] Production Clerk instance created
- [ ] Webhook endpoint configured
- [ ] 3 credentials collected

---

## Step 5: Cloudflare R2 (File Storage)

**Status**: NOT STARTED
**Owner**: User (manual — Cloudflare dashboard)
**Can Claude do this?**: No — requires Cloudflare account access

### Instructions for User

1. Create R2 bucket named `apollo-files` (should already exist from dev)
2. Create API token: Object Read & Write, scoped to `apollo-files`
3. Configure CORS:
```json
[{
  "AllowedOrigins": ["https://apollo.sciscribesolutions.com"],
  "AllowedMethods": ["GET", "PUT", "HEAD"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}]
```
4. Collect: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`

**Important**: If reusing the existing `apollo-files` bucket, update CORS to include the production origin.

**Deliverables to report back**:
- [ ] Bucket exists: `apollo-files`
- [ ] API token created with correct scope
- [ ] CORS updated for production domain
- [ ] 3 credentials collected

---

## Step 6: Anthropic (Claude AI)

**Status**: NOT STARTED (likely already have API key from dev)
**Owner**: User
**Can Claude do this?**: No

### Instructions for User

1. Verify existing `ANTHROPIC_API_KEY` is active at [console.anthropic.com](https://console.anthropic.com)
2. Set monthly spending limit (suggest $100 for beta)
3. Enable 80% usage email alerts

**Note**: Same API key can be used for dev and production. No separate "production" key needed.

**Deliverables to report back**:
- [ ] API key verified active
- [ ] Spending limit set

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

**Status**: NOT STARTED
**Owner**: User (manual — Inngest dashboard)
**Can Claude do this?**: No — requires Inngest account

### Instructions for User

1. Sign up at [inngest.com](https://inngest.com)
2. Create app: `apollo`, Environment: Production
3. Collect: `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
4. **After deployment (Step 14)**: Set app URL to `https://apollo.sciscribesolutions.com/api/inngest`

The 6 functions will auto-register when the first event fires:
- `thesis-phase-workflow`, `ai-generate-section`, `analysis-runner`
- `stale-cleanup` (every 5 min), `licence-expiry-cron` (daily 2 AM), `account-deletion-cron` (daily 3 AM)

**Deliverables to report back**:
- [ ] Inngest account created
- [ ] 2 credentials collected
- [ ] (Post-deploy) App URL configured and 6 functions discovered

---

## Step 9: Razorpay (INR Payments)

**Status**: PARTIALLY COMPLETE (KYC done)
**Owner**: User
**Can Claude do this?**: No

### Current State

Razorpay is already verified under the parent legal entity SciScribe Solutions.

### Remaining Steps

1. Get API keys: Dashboard > Account & Settings > API Keys
   - `RAZORPAY_KEY_ID` (starts with `rzp_live_`)
   - `RAZORPAY_KEY_SECRET`
2. Create 2 subscription plans (Dashboard > Products > Subscriptions > Plans):
   - Student Monthly: Rs 5,499/month -> `RAZORPAY_PLAN_ID_STUDENT_MONTHLY`
   - Addon: Rs 3,999/month -> `RAZORPAY_PLAN_ID_ADDON`
3. Configure webhook: `https://apollo.sciscribesolutions.com/api/webhooks/razorpay`
   - Events: `payment.captured`, `subscription.charged`, `subscription.cancelled`
   - Generate secret -> `RAZORPAY_WEBHOOK_SECRET`

**Deliverables to report back**:
- [x] Business verification complete (SciScribe Solutions)
- [ ] 2 plans created with Plan IDs
- [ ] Webhook configured
- [ ] 4 credentials collected

---

## Step 10: Stripe (USD Payments)

**Status**: NOT STARTED
**Owner**: User (manual)
**Can Claude do this?**: No

### Instructions for User

See DEPLOYMENT.md Step 10 for full details. Key points:
- Create 4 products/prices
- Configure webhook: `https://apollo.sciscribesolutions.com/api/webhooks/stripe`
- Events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`

**Deliverables to report back**:
- [ ] 4 price IDs collected
- [ ] Webhook configured
- [ ] 3 credentials collected (secret key, webhook secret, + price IDs)

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

**Status**: NOT STARTED
**Owner**: User (SSH into VPS) + Claude (can prepare files)
**Can Claude do this?**: Partially — can prepare ecosystem.config.js and review .env.local template

### Instructions for User

```bash
cd /opt/apollo/apps/web

# Update next.config.ts — replace dev Supabase hostname with production
nano next.config.ts
# Change: hostname: "ugkqdopvsmtzsqvnnmck.supabase.co"
# To:     hostname: "<your-prod-project-ref>.supabase.co"

# Install deps
pnpm install --frozen-lockfile

# Create .env.local (copy from .env.example, fill ALL values)
cp .env.example .env.local
nano .env.local
# See DEPLOYMENT.md Step 12c for the full list

# Build (NEXT_PUBLIC_* vars baked in at build time)
pnpm build

# Create PM2 config
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: "apollo-web",
    script: "node_modules/.bin/next",
    args: "start -H 127.0.0.1 -p 3000",
    cwd: "/opt/apollo/apps/web",
    env: { NODE_ENV: "production" },
  }],
};
EOF

# Start and persist
pm2 start ecosystem.config.js
pm2 save && pm2 startup
# Run the command PM2 outputs

# Verify
curl http://127.0.0.1:3000/api/health
pm2 status
```

**Critical reminders**:
- Do NOT include `DEV_LICENCE_BYPASS=true`
- `LATEX_COMPILE_MODE=docker` (not mock)
- `R_PLUMBER_SECRET` must match the one from Step 11

**Deliverables to report back**:
- [ ] next.config.ts updated with prod Supabase hostname
- [ ] .env.local populated with all production values
- [ ] Build succeeded
- [ ] PM2 running and persisted
- [ ] Health check returns `{"status":"ok"}`

---

## Step 13: Configure Caddy (Reverse Proxy + SSL)

**Status**: NOT STARTED
**Owner**: User (SSH into VPS)
**Can Claude do this?**: No

### Instructions for User

```bash
cat > /etc/caddy/Caddyfile << 'EOF'
apollo.sciscribesolutions.com {
    reverse_proxy localhost:3000
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
        -Server
    }
}
EOF

sudo systemctl restart caddy && sudo systemctl enable caddy
curl -I https://apollo.sciscribesolutions.com
```

**Deliverables to report back**:
- [ ] Caddy configured and running
- [ ] SSL certificate auto-obtained
- [ ] HTTPS returns 200 with security headers

---

## Step 14: Post-Deployment Verification

**Status**: NOT STARTED
**Owner**: User (runs commands) + Claude (reviews results)
**Can Claude do this?**: Partially — can review results you paste

### Checklist

- [ ] `curl https://apollo.sciscribesolutions.com/api/health` returns `{"status":"ok"}`
- [ ] `APOLLO_DOMAIN=apollo.sciscribesolutions.com bash scripts/deploy-conformance.sh` — all PASS
- [ ] Sign up flow works
- [ ] Create project works (Supabase write)
- [ ] Upload synopsis works (AI parsing)
- [ ] Generate content works (Inngest + Claude)
- [ ] Compile PDF works (Docker LaTeX)
- [ ] Upload dataset works (R2 storage)
- [ ] Run analysis works (R Plumber)
- [ ] Inngest app registered with 6 functions

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

### S1: Consider removing `output: "standalone"` from next.config.ts

Since we use `next start` (not standalone server.js), the `output: "standalone"` config generates an unused `.next/standalone/` directory during build. Removing it saves ~30s build time and avoids confusion.

**Trade-off**: If you ever want to containerise Next.js itself (e.g., for horizontal scaling), you'd want standalone back. For a single-VPS deploy, it's unnecessary.

### S2: Add `CLERK_WEBHOOK_SECRET` to env.ts optional list

Currently `CLERK_WEBHOOK_SECRET` is validated at runtime in the webhook route but isn't in `lib/env.ts`. Adding it to the optional list would give a build-time warning if missing, which is helpful for new deployments.

### S3: Upstash Redis — consider creating a production database

The current `apollo` Redis is free-tier with 500K request limit. For production, consider:
- Creating a separate `apollo-production` database (clean separation)
- Or upgrading to pay-as-you-go if you exceed free tier limits

### S4: Supabase free tier limits

Free tier: 500 MB database, 1 GB bandwidth/month, 50 MB file storage. With 148 users and 141 projects already in dev, monitor usage closely. Supabase Pro ($25/month) gives 8 GB DB + 250 GB bandwidth.

### S5: Consider a non-root deploy user on VPS

Running everything as root works but is not best practice. Consider:
```bash
adduser apollo --disabled-password
usermod -aG docker apollo
# Clone repo and run PM2 as apollo user
```

### S6: Automated SSL monitoring

Caddy auto-renews, but add a cron to alert if certificate is < 14 days from expiry:
```bash
# Already covered by deploy-conformance.sh check #11
```

---

## Deferred / TODO Items

| Item | Priority | Notes |
|------|----------|-------|
| Load testing (Step 15) | Medium | Run before public launch, after beta stabilises |
| Sentry error tracking | Medium | Optional but highly recommended for production |
| PostHog analytics | Low | Optional, can add post-launch |
| Non-root deploy user (S5) | Low | Security improvement, not blocking |
| Remove `output: "standalone"` (S1) | Low | Optimisation, not blocking |
| Add `CLERK_WEBHOOK_SECRET` to env.ts (S2) | Low | Developer experience improvement |
| ~~Razorpay KYC verification~~ | ~~High~~ | DONE — verified under SciScribe Solutions |
| Full thesis E2E test | High | Must complete at least one full 11-phase thesis before beta invite |

---

## Lessons Learnt

1. **[Pre-deploy]** The Supabase MCP-connected project has only 13 of 32 migrations applied — production must use `supabase db push` or SQL Editor to apply all 32 in order.
2. **[Pre-deploy]** `next.config.ts` has a hardcoded dev Supabase hostname in `images.remotePatterns` — easy to forget during deployment. Should be parameterised via env var in a future refactor.
3. **[Pre-deploy]** `compile.ts` resolves paths relative to `process.cwd()` (lines 113, 178, 323). This is why `next start` (preserves cwd) works but standalone `server.js` (overrides cwd via `process.chdir`) would break LaTeX compilation entirely.
4. **[Step 11]** TeX Live 2025 absorbed `subcaption` and `mathrsfs` into `scheme-small` collections. Package names change between TL releases — always verify against the TL2025 repository before adding specific packages.
5. **[Step 11]** Docker Compose v5 is stricter than v2 — duplicate list entries in YAML overlays (e.g., `security_opt`) cause hard errors. Base compose must not repeat entries that prod overlay also sets.
6. **[Step 11]** AppArmor profiling on Debian merged-usr systems requires dual paths (`/bin/*` AND `/usr/bin/*`) for all shell utilities. The `/bin` → `/usr/bin` symlink means processes can reference either path.
7. **[Step 11]** R's `/usr/bin/R` is a bash wrapper script, not a binary. AppArmor profile must use `rix` (read+inherit+execute) not just `ix` for scripts, because bash needs to READ the script to execute it.
8. **[Step 11]** Custom seccomp allowlists are too fragile for complex runtimes like R. Docker's default seccomp (~44 blocked dangerous syscalls) + AppArmor + cap_drop:ALL provides equivalent protection with far fewer maintenance issues.
9. **[Step 11]** AppArmor glob syntax treats `[` as regex metacharacter. Paths like `/usr/bin/[` cannot be whitelisted directly — use the equivalent binary name (`/usr/bin/test`).
10. **[Step 11]** Always profile AppArmor in complain mode first (`apparmor_parser -C`), analyse `dmesg` audit logs, then switch to enforce mode. Never skip straight to enforce — the deny surface is too large to predict.

---

## Completion Summary

| Step | Status | Blocker |
|------|--------|---------|
| Pre-deploy audit | COMPLETE | - |
| Step 1: Domain + VPS | COMPLETE | VPS: `37.27.211.131` Helsinki. Domain pending |
| Step 2: DNS + VPS setup | COMPLETE | DNS propagated, all deps installed |
| Step 3: Supabase | NOT STARTED | User creates project |
| Step 4: Clerk | NOT STARTED | User action required |
| Step 5: R2 | NOT STARTED | User action required (may reuse existing) |
| Step 6: Anthropic | NOT STARTED | Likely reuse existing key |
| Step 7: Upstash | COMPLETE | Reusing existing `apollo` DB (ap-south-1) |
| Step 8: Inngest | NOT STARTED | User action required |
| Step 9: Razorpay | PARTIAL | KYC done (SciScribe Solutions). Plans + webhook remaining |
| Step 10: Stripe | NOT STARTED | User action required |
| Step 11: Docker containers | COMPLETE | Both healthy, AppArmor enforced, 8 issues resolved |
| Step 12: Next.js deploy | NOT STARTED | Depends on Steps 3-10 |
| Step 13: Caddy + SSL | NOT STARTED | Depends on Step 12 |
| Step 14: Verification | NOT STARTED | Depends on Step 13 |
| Step 15: Load testing | DEFERRED | Post-beta |
| Step 16: Beta checklist | NOT STARTED | Depends on Step 14 |
