# Apollo Production Deployment Guide

Step-by-step guide for deploying Apollo to production at `apollo.sciscribesolutions.com` on Hetzner CX23.

**Architecture**: Next.js runs natively on the host (not containerised) because it calls `docker run` for LaTeX compilation. Caddy handles reverse proxy + auto-SSL. Docker Compose manages LaTeX and R Plumber services.

---

## Prerequisites

- Hetzner CX23 VPS (2 vCPU, 4 GB RAM, 40 GB SSD) with Ubuntu 22.04+
- Domain `sciscribesolutions.com` with DNS access
- Accounts created (free tiers are fine to start):
  - [Supabase](https://supabase.com) (database + auth + RLS)
  - [Clerk](https://clerk.com) (authentication)
  - [Cloudflare](https://cloudflare.com) (R2 storage + optional DNS)
  - [Anthropic](https://console.anthropic.com) (Claude API)
  - [Upstash](https://upstash.com) (Redis)
  - [Inngest](https://inngest.com) (background jobs)
  - [Razorpay](https://razorpay.com) (INR payments)
  - [Stripe](https://stripe.com) (USD payments)
  - Optional: [Sentry](https://sentry.io), [PostHog](https://posthog.com)

---

## Step 1: Reactivate Domain + Provision Hetzner VPS (do in parallel)

These two tasks have no dependency on each other --- start both simultaneously.

### 1a. Reactivate dormant domain (while VPS provisions)

If `sciscribesolutions.com` has been dormant for 6 months:
1. **Log into your registrar** (GoDaddy, Namecheap, Cloudflare, etc.)
2. **Check expiry date** --- renew immediately if within 90 days. Some registrars auto-delete after expiry + 30-day grace
3. **Check domain status** --- look for "clientHold", "serverHold", or "parked". Contact registrar support if suspended
4. **Verify nameservers** --- confirm they still point to your DNS provider (Cloudflare, Route53, etc.). If nameservers were reset, reconfigure them
5. **Verify the main site** --- confirm `sciscribesolutions.com` resolves and loads your existing website. The `apollo` subdomain will NOT affect it

### 1b. Provision Hetzner VPS

1. Go to [Hetzner Cloud Console](https://console.hetzner.cloud)
2. Create a new server:
   - **Location**: Falkenstein (EU) or Ashburn (US) --- pick closest to your users (Indian users: Falkenstein has lower latency than Ashburn)
   - **Image**: Ubuntu 22.04
   - **Type**: CX23 (2 vCPU, 4 GB RAM, 40 GB SSD) --- ~EUR 4.50/month
   - **SSH key**: Add your public key (or use password)
3. Click **Create & Buy Now**
4. **Note the IP address** --- you need this for the next step

---

## Step 2: DNS + VPS Setup (depends on Step 1)

Now that you have the VPS IP and the domain is active, wire them together.

### 2a. Create subdomain DNS record

Go to your DNS provider and add:

```
Type: A
Name: apollo
Value: <your-hetzner-vps-ip-from-step-1b>
TTL: 300 (5 min during setup, increase to 3600 after stable)
```

This creates `apollo.sciscribesolutions.com` pointing to your VPS.
Your main `sciscribesolutions.com` site is completely unaffected.

### 2b. Verify DNS propagation (wait 2--10 minutes)

```bash
dig apollo.sciscribesolutions.com +short
# Should return your Hetzner VPS IP

# If using Cloudflare DNS, propagation is nearly instant
# Other providers may take up to 30 minutes
```

### 2c. Install server dependencies

```bash
# SSH into VPS
ssh root@<vps-ip>

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker

# Install Docker Compose plugin
apt install -y docker-compose-plugin

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Install PM2 (process manager)
npm install -g pm2

# Install Caddy (reverse proxy + auto-SSL)
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

# Set up firewall (only allow SSH, HTTP, HTTPS)
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Verify installations
docker --version       # Should be 24+
docker compose version # Should be v2+
node --version         # Should be v20.x
pnpm --version         # Should be 9+
pm2 --version          # Should be 5+
caddy version          # Should be 2.x
```

---

## Step 3: Supabase (Database)

### 3a. Create production project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Name: `apollo-production`
4. Region: Choose closest to your users (e.g., `ap-south-1` Mumbai for India)
5. Generate a strong database password --- **save this**

### 3b. Apply all migrations

You have 32 migrations (001--032). Apply them in order:

**Option A: Via Supabase CLI** (recommended)
```bash
# Install Supabase CLI
npx supabase --version   # Uses npx, no global install needed

# Link to your project
cd /opt/apollo/apps/web
npx supabase link --project-ref <your-project-ref>

# Push all migrations
npx supabase db push
```

**Option B: Via SQL Editor**
1. Go to Supabase Dashboard > SQL Editor
2. Run each migration file from `apps/web/supabase/migrations/` in numerical order (001 through 032)
3. **Critical**: Run them in order --- later migrations depend on earlier ones

### 3c. Verify schema

```sql
-- Run in SQL Editor to verify
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public';
-- Should return 17 tables
```

### 3d. Collect credentials

From Supabase Dashboard > Settings > API:
- `NEXT_PUBLIC_SUPABASE_URL` = Project URL (e.g., `https://xxxxx.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` = service_role key (**keep secret**)

---

## Step 4: Clerk (Authentication)

### 4a. Create production instance

1. Go to [clerk.com/dashboard](https://clerk.com/dashboard)
2. If you have a development instance, click **Create production instance** (or create new app)
3. Set application name: `Apollo`

### 4b. Configure sign-in methods

In Clerk Dashboard > User & Authentication:
- Enable **Email address** (primary)
- Enable **Google OAuth** (optional but recommended)
- Disable username/phone if not needed

### 4c. Configure URLs

In Clerk Dashboard > Paths:
- Sign-in URL: `/sign-in`
- Sign-up URL: `/sign-up`
- After sign-in URL: `/dashboard`
- After sign-up URL: `/dashboard`

### 4d. Set up webhooks

In Clerk Dashboard > Webhooks:
1. Click **Add Endpoint**
2. URL: `https://apollo.sciscribesolutions.com/api/webhooks/clerk`
3. Events to subscribe:
   - `user.created`
   - `user.deleted`
4. Copy the **Signing Secret** --- you'll need this as `CLERK_WEBHOOK_SECRET`

### 4e. Collect credentials

From Clerk Dashboard > API Keys:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = Publishable key (starts with `pk_live_`)
- `CLERK_SECRET_KEY` = Secret key (starts with `sk_live_`)
- `CLERK_WEBHOOK_SECRET` = Webhook signing secret from Step 4d

### 4f. Migrate from dev to prod

If you have users in development:
- Clerk production instances start fresh (no user migration)
- Beta testers will need to create new accounts
- This is expected --- dev and prod are separate

---

## Step 5: Cloudflare R2 (File Storage)

### 5a. Create R2 bucket

1. Go to Cloudflare Dashboard > R2
2. Click **Create bucket**
3. Name: `apollo-files`
4. Location hint: Choose closest region

### 5b. Create API token

1. Go to R2 > Manage R2 API Tokens
2. Click **Create API token**
3. Permissions: **Object Read & Write**
4. Specify bucket: `apollo-files`
5. TTL: No expiry (or set a long expiry and rotate)

### 5c. Collect credentials

- `R2_ACCOUNT_ID` = Your Cloudflare Account ID (top-right of dashboard)
- `R2_ACCESS_KEY_ID` = Access Key ID from the API token
- `R2_SECRET_ACCESS_KEY` = Secret Access Key from the API token
- `R2_BUCKET_NAME` = `apollo-files`

### 5d. Configure CORS (for client-side uploads)

In R2 bucket settings > CORS policy:
```json
[
  {
    "AllowedOrigins": ["https://apollo.sciscribesolutions.com"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## Step 6: Anthropic (Claude AI)

### 6a. Get API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key
3. Set billing --- Apollo uses Claude Sonnet 4.5 (primary) and Haiku 4.5 (validation/planning)
4. Estimated cost: ~$0.50--$2.00 per thesis (varies by length and refinement count)

### 6b. Set budget alerts

In Anthropic Console > Usage:
- Set a monthly spending limit (e.g., $100 for beta)
- Enable email alerts at 80% usage

Credential: `ANTHROPIC_API_KEY` = `sk-ant-...`

---

## Step 7: Upstash Redis

### 7a. Create database

1. Go to [console.upstash.com](https://console.upstash.com)
2. Create a new Redis database
3. Name: `apollo-production`
4. Region: Choose closest (e.g., `ap-southeast-1` Singapore for India)
5. Type: Regional (not Global --- saves cost)

### 7b. Collect credentials

From the database detail page:
- `UPSTASH_REDIS_REST_URL` = REST URL (starts with `https://`)
- `UPSTASH_REDIS_REST_TOKEN` = REST token

---

## Step 8: Inngest (Background Jobs)

### 8a. Create account and app

1. Go to [inngest.com](https://inngest.com) and sign up
2. Create a new app: `apollo`
3. Environment: Production

### 8b. Collect credentials

From Inngest Dashboard > Manage > Keys:
- `INNGEST_EVENT_KEY` = Event Key
- `INNGEST_SIGNING_KEY` = Signing Key

### 8c. Configure event source

After deployment (Step 13), Inngest needs to know your app URL:
1. Go to Inngest Dashboard > Apps
2. Set the app URL to: `https://apollo.sciscribesolutions.com/api/inngest`
3. Inngest will auto-discover your functions (6 total):
   - `thesis-phase-workflow` --- orchestrates phase transitions
   - `ai-generate-section` --- AI content generation (concurrency: 5)
   - `analysis-runner` --- R statistical analyses
   - `stale-cleanup` --- cleans stale compilations (every 5 min)
   - `licence-expiry-cron` --- sweeps expired licences (daily 2 AM)
   - `account-deletion-cron` --- purges deleted accounts (daily 3 AM)

---

## Step 9: Razorpay (INR Payments)

### 9a. Create account

1. Go to [razorpay.com](https://razorpay.com) and complete business verification
2. This can take 2--5 business days for Indian businesses

### 9b. Get API keys

Dashboard > Account & Settings > API Keys:
- `RAZORPAY_KEY_ID` = Key ID (starts with `rzp_live_`)
- `RAZORPAY_KEY_SECRET` = Key Secret

### 9c. Create subscription plans

Dashboard > Products > Subscriptions > Plans:

**Plan 1: Student Monthly**
- Name: `Apollo Student Monthly`
- Amount: 5499 (paise) = Rs 5,499/month
- Period: monthly
- Copy Plan ID -> `RAZORPAY_PLAN_ID_STUDENT_MONTHLY`

**Plan 2: Addon**
- Name: `Apollo Addon`
- Amount: 3999 (paise) = Rs 3,999/month
- Period: monthly
- Copy Plan ID -> `RAZORPAY_PLAN_ID_ADDON`

### 9d. Configure webhooks

Dashboard > Account & Settings > Webhooks:
1. Add new webhook
2. URL: `https://apollo.sciscribesolutions.com/api/webhooks/razorpay`
3. Events:
   - `payment.captured`
   - `subscription.charged`
   - `subscription.cancelled`
4. Secret: Generate one -> `RAZORPAY_WEBHOOK_SECRET`

---

## Step 10: Stripe (USD Payments)

### 10a. Create account

1. Go to [stripe.com](https://stripe.com) and complete verification

### 10b. Get API keys

Dashboard > Developers > API keys:
- `STRIPE_SECRET_KEY` = Secret key (starts with `sk_live_`)

### 10c. Create products and prices

Dashboard > Products:

**Product 1: Student One-Time**
- Name: `Apollo Student One-Time`
- Price: $189 USD (one-time)
- Copy Price ID -> `STRIPE_PRICE_ID_STUDENT_ONETIME`

**Product 2: Professional One-Time**
- Name: `Apollo Professional One-Time`
- Price: $379 USD (one-time)
- Copy Price ID -> `STRIPE_PRICE_ID_PROFESSIONAL_ONETIME`

**Product 3: Student Monthly**
- Name: `Apollo Student Monthly`
- Price: $65/month (recurring)
- Copy Price ID -> `STRIPE_PRICE_ID_STUDENT_MONTHLY`

**Product 4: Addon**
- Name: `Apollo Addon`
- Price: $49/month (recurring)
- Copy Price ID -> `STRIPE_PRICE_ID_ADDON`

### 10d. Configure webhooks

Dashboard > Developers > Webhooks:
1. Add endpoint
2. URL: `https://apollo.sciscribesolutions.com/api/webhooks/stripe`
3. Events:
   - `checkout.session.completed`
   - `invoice.paid`
   - `customer.subscription.deleted`
4. Reveal signing secret -> `STRIPE_WEBHOOK_SECRET`

---

## Step 11: Build and Deploy Docker Containers

### 11a. Clone repository and build images

```bash
# SSH into VPS
ssh root@<vps-ip>

# Clone the repo (if private, add a deploy key first: https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys)
cd /opt
git clone <your-repo-url> apollo
cd apollo

# Build LaTeX image (~5-10 min first time)
docker build -t apollo-latex -f docker/Dockerfile.latex .

# Build R Plumber image (~10-15 min first time)
docker build -t apollo-r-plumber -f docker/Dockerfile.r-plumber .
```

### 11b. Load AppArmor profile

```bash
# Copy AppArmor profile
cp docker/apparmor-r-plumber /etc/apparmor.d/apollo-r-plumber

# Load it
sudo apparmor_parser -r /etc/apparmor.d/apollo-r-plumber
```

### 11c. Set R Plumber secret

Generate a random secret:
```bash
openssl rand -hex 32
```
Save this as `R_PLUMBER_SECRET` (used in both Docker env and Next.js env).

### 11d. Start containers

```bash
cd /opt/apollo/docker

# Create .env for R Plumber secret
echo "R_PLUMBER_SECRET=<your-generated-secret>" > .env

# Start with production overrides (includes AppArmor)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 11e. Verify containers

```bash
# Check both are running
docker ps
# Should show apollo-latex (sleeping) and apollo-r-plumber (healthy)

# Test R Plumber health (port 8787 is mapped to localhost)
curl http://localhost:8787/health
# Should return {"status":"ok","r_version":"4.4.0",...}

# Test LaTeX compilation
docker run --rm apollo-latex pdflatex --version
# Should show pdfTeX version info
```

---

## Step 12: Deploy Next.js App

Next.js runs directly on the host (not in Docker) because it needs to call `docker run` for LaTeX compilation and access the Docker socket. We use `next start` (not the standalone server.js) because `compile.ts` resolves template and seccomp paths relative to `process.cwd()` --- standalone mode overrides cwd and breaks these paths.

### 12a. Update next.config.ts for production

Before building, update the Supabase image hostname to your **production** project:

```bash
cd /opt/apollo/apps/web
nano next.config.ts
```

In the `images.remotePatterns` array, replace the dev hostname:
```typescript
// Change this:
hostname: "ugkqdopvsmtzsqvnnmck.supabase.co",
// To your production project:
hostname: "<your-prod-project-ref>.supabase.co",
```

### 12b. Install dependencies

```bash
cd /opt/apollo/apps/web
pnpm install --frozen-lockfile
```

### 12c. Set environment variables

Create and edit `/opt/apollo/apps/web/.env.local`:

```bash
cp .env.example .env.local
nano .env.local
```

Fill in ALL production values:

```env
# === REQUIRED (app fails to start without these) ===

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Anthropic AI
ANTHROPIC_API_KEY=sk-ant-...

# Cloudflare R2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=apollo-files

# App URL (used for Stripe checkout redirects and review share links)
NEXT_PUBLIC_APP_URL=https://apollo.sciscribesolutions.com

# === REQUIRED FOR PRODUCTION FEATURES ===

# LaTeX
LATEX_COMPILE_MODE=docker
LATEX_CONTAINER_NAME=apollo-latex

# R Plumber
R_PLUMBER_URL=http://localhost:8787
R_PLUMBER_SECRET=<same-as-docker-env-from-step-11c>

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# Inngest
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...

# Razorpay (INR payments)
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
RAZORPAY_PLAN_ID_STUDENT_MONTHLY=plan_...
RAZORPAY_PLAN_ID_ADDON=plan_...

# Stripe (USD payments)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_STUDENT_ONETIME=price_...
STRIPE_PRICE_ID_STUDENT_MONTHLY=price_...
STRIPE_PRICE_ID_PROFESSIONAL_ONETIME=price_...
STRIPE_PRICE_ID_ADDON=price_...

# === OPTIONAL ===

# Sentry error tracking
# SENTRY_DSN=https://...@sentry.io/...
# NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...

# PostHog analytics
# NEXT_PUBLIC_POSTHOG_KEY=phc_...

# CrossRef (recommended for faster DOI lookups)
# CROSSREF_MAILTO=admin@sciscribesolutions.com

# PubMed (10 req/s instead of 3 req/s)
# PUBMED_API_KEY=...
```

**Important**: Do NOT include `DEV_LICENCE_BYPASS=true` in production.

### 12d. Build

`NEXT_PUBLIC_*` vars are baked in at build time. Server-side vars are read at runtime from `.env.local`. The build will fail fast if any required env vars are missing (validated by `lib/env.ts`).

```bash
cd /opt/apollo/apps/web
pnpm build
```

### 12e. Create PM2 ecosystem config

```bash
cat > /opt/apollo/apps/web/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: "apollo-web",
    script: "node_modules/.bin/next",
    args: "start -H 127.0.0.1 -p 3000",
    cwd: "/opt/apollo/apps/web",
    env: {
      NODE_ENV: "production",
    },
  }],
};
EOF
```

**Why `next start` instead of standalone**: The standalone `server.js` calls `process.chdir(__dirname)`, which overrides the working directory to `.next/standalone/`. This breaks `compile.ts` which resolves template and Docker seccomp paths relative to `process.cwd()` (expects `apps/web/` so `../../templates` reaches the repo root). `next start` preserves the correct working directory.

**Why `-H 127.0.0.1`**: Next.js only accepts connections from localhost. Caddy handles all external traffic and proxies to port 3000.

### 12f. Start the app

```bash
cd /opt/apollo/apps/web
pm2 start ecosystem.config.js

# Save PM2 process list (auto-restart on reboot)
pm2 save
pm2 startup
# Run the command PM2 outputs to enable boot startup
```

### 12g. Verify Next.js is running

```bash
# Direct test (from VPS)
curl http://127.0.0.1:3000/api/health
# Should return:
# {"status":"ok","timestamp":"...","version":"0.1.0","checks":{"r_plumber":"ok","docker":"ok"}}

# Check PM2 status
pm2 status
# Should show apollo-web as "online"
```

---

## Step 13: Configure Caddy (Reverse Proxy + SSL)

Caddy automatically obtains and renews Let's Encrypt SSL certificates.

### 13a. Configure Caddyfile

```bash
cat > /etc/caddy/Caddyfile << 'EOF'
apollo.sciscribesolutions.com {
    reverse_proxy localhost:3000

    # Security headers
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
        -Server
    }
}
EOF
```

### 13b. Restart Caddy

```bash
sudo systemctl restart caddy
sudo systemctl enable caddy

# Verify SSL certificate was obtained
curl -I https://apollo.sciscribesolutions.com
# Should show HTTP/2 200 with security headers
```

Caddy automatically:
- Obtains Let's Encrypt SSL certificate
- Redirects HTTP to HTTPS
- Renews certificates before expiry

---

## Step 14: Post-Deployment Verification

### 14a. Basic health checks

```bash
# App health (via Caddy/SSL)
curl https://apollo.sciscribesolutions.com/api/health
# Should return:
# {"status":"ok","timestamp":"...","version":"0.1.0","checks":{"r_plumber":"ok","docker":"ok"}}

# SSL check
curl -I https://apollo.sciscribesolutions.com
# Should show HTTP/2 200 with security headers
```

### 14b. Run deploy conformance script

```bash
cd /opt/apollo
APOLLO_DOMAIN=apollo.sciscribesolutions.com bash scripts/deploy-conformance.sh
# All checks should PASS (AppArmor may WARN on first run)
```

### 14c. Test critical flows

1. **Sign up** --- go to `https://apollo.sciscribesolutions.com/sign-up`, create account
2. **Create project** --- verify Supabase write works
3. **Upload synopsis** --- verify AI parsing works (Anthropic API)
4. **Generate content** --- verify background generation (Inngest + Claude)
5. **Compile PDF** --- verify Docker LaTeX compilation
6. **Upload dataset** --- verify R2 storage works
7. **Run analysis** --- verify R Plumber statistical analysis

### 14d. Test webhooks

**Razorpay** (test mode first):
```bash
# Use Razorpay test keys initially, then switch to live
# Create a test payment and verify webhook delivery
```

**Stripe**:
```bash
stripe listen --forward-to https://apollo.sciscribesolutions.com/api/webhooks/stripe
# Use Stripe CLI to forward test events
```

**Clerk**:
- Create a test user in Clerk dashboard
- Verify `user.created` webhook fires and user appears in Supabase

### 14e. Register Inngest app

1. Go to Inngest Dashboard > Apps
2. Your app should auto-register when the first event is sent
3. If not, manually add: `https://apollo.sciscribesolutions.com/api/inngest`
4. Verify all 6 functions are discovered:
   - `thesis-phase-workflow`
   - `ai-generate-section`
   - `analysis-runner`
   - `stale-cleanup`
   - `licence-expiry-cron`
   - `account-deletion-cron`

---

## Step 15: Load Testing (Optional but Recommended)

```bash
# Install k6
brew install k6  # macOS
# or: apt install k6  # Linux

# Run against production
cd /opt/apollo
BASE_URL=https://apollo.sciscribesolutions.com k6 run scripts/load-test.js
```

Expected capacity (CX23):
- 1 concurrent LaTeX compile
- 2 concurrent R analyses
- 5 concurrent AI generations

---

## Step 16: Beta Launch Checklist

Before sharing with beta testers:

- [ ] All health checks passing (`/api/health` returns `"status":"ok"`)
- [ ] SSL certificate valid (verify in browser)
- [ ] Sign up flow works end-to-end
- [ ] At least one complete thesis generation test (all 11 phases)
- [ ] PDF compilation produces correct output
- [ ] Payment flow works (test mode first, then live)
- [ ] Webhook delivery confirmed for all 3 providers (Clerk, Razorpay, Stripe)
- [ ] Inngest functions registered and running (6 functions)
- [ ] Error tracking configured (Sentry) or monitoring in place
- [ ] Backup strategy: Supabase daily backups enabled (Dashboard > Settings > Database)
- [ ] Razorpay KYC/verification complete (required for live payments in India)
- [ ] Legal pages accessible: `/privacy`, `/terms`, `/refund`

---

## Domain Recommendation

**`apollo.sciscribesolutions.com` is an excellent choice** because:

1. **Keeps main site running** --- `sciscribesolutions.com` continues serving its current website
2. **Clear brand hierarchy** --- Apollo is a product under the SciScribe Solutions umbrella
3. **Easy SSL** --- Caddy auto-generates Let's Encrypt certs for the subdomain
4. **No migration risk** --- no need to touch existing DNS records for the main domain
5. **Professional appearance** --- `apollo.sciscribesolutions.com` is clean and memorable

If you later want a shorter URL, you can always add a redirect from a custom domain.

---

## Auto-Deploy Script

Create a deploy script for easy updates:

```bash
cat > /opt/apollo/deploy.sh << 'SCRIPT'
#!/bin/bash
set -euo pipefail
echo "=== Apollo Deploy ==="

cd /opt/apollo
git pull origin main

# Rebuild Next.js
cd apps/web
pnpm install --frozen-lockfile
pnpm build

# Restart app
pm2 restart apollo-web

# Rebuild Docker images only if Dockerfiles changed
if git diff HEAD~1 --name-only | grep -q "docker/Dockerfile"; then
    echo "Docker images changed, rebuilding..."
    cd /opt/apollo
    docker build -t apollo-latex -f docker/Dockerfile.latex .
    docker build -t apollo-r-plumber -f docker/Dockerfile.r-plumber .
    cd docker
    docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
fi

echo "=== Deploy complete ==="
pm2 status
SCRIPT
chmod +x /opt/apollo/deploy.sh
```

Usage: `ssh root@<vps-ip> /opt/apollo/deploy.sh`

Or set up a git post-receive hook for automatic deploys on push.

---

## Rollback Procedure

If something goes wrong during deployment:

1. **App**: `cd /opt/apollo && git checkout <previous-commit> && cd apps/web && pnpm install --frozen-lockfile && pnpm build && pm2 restart apollo-web`
2. **Database**: Supabase point-in-time recovery (Settings > Database > Backups)
3. **Docker**: Containers are stateless --- rebuild from Dockerfiles
4. **DNS**: Revert the A record if the subdomain needs to be taken offline

---

## Maintenance

### Routine tasks
- **Weekly**: Check Supabase usage (free tier limits: 500 MB DB, 1 GB bandwidth)
- **Monthly**: Rotate API keys if security policy requires
- **Per deploy**: Run `deploy-conformance.sh` after any Docker image rebuild

### Updating the app
```bash
# Simple deploy
ssh root@<vps-ip> /opt/apollo/deploy.sh

# Or manually:
ssh root@<vps-ip>
cd /opt/apollo && git pull
cd apps/web && pnpm install --frozen-lockfile && pnpm build
pm2 restart apollo-web
```

### Monitoring
- **PM2**: `pm2 monit` (CPU, memory, restart count, logs)
- **Supabase dashboard**: Database size, API requests, auth events
- **Inngest dashboard**: Background job success/failure rates
- **Upstash dashboard**: Redis usage, rate limit hits
- **(Optional) Sentry**: Error tracking with stack traces
- **(Optional) PostHog**: User analytics and session recordings
