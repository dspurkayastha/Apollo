# Apollo Production Deployment Guide

Step-by-step guide for deploying Apollo to production at `apollo.sciscribesolutions.com` on Hetzner CX23 via Coolify.

---

## Prerequisites

- Hetzner CX23 VPS (2 vCPU, 4 GB RAM, 40 GB SSD) with Ubuntu 22.04+
- Domain `sciscribesolutions.com` with DNS access
- Accounts created (free tiers are fine to start):
  - [Supabase](https://supabase.com) (database + auth policies)
  - [Clerk](https://clerk.com) (authentication)
  - [Cloudflare](https://cloudflare.com) (R2 storage + optional DNS)
  - [Anthropic](https://console.anthropic.com) (Claude API)
  - [Upstash](https://upstash.com) (Redis)
  - [Inngest](https://inngest.com) (background jobs)
  - [Razorpay](https://razorpay.com) (INR payments)
  - [Stripe](https://stripe.com) (USD payments)
  - Optional: [Sentry](https://sentry.io), [PostHog](https://posthog.com)

---

## Step 1: Domain and DNS Setup

### 1a. Create subdomain for Apollo

Since `sciscribesolutions.com` is already running, use a subdomain. Go to your DNS provider (likely Cloudflare or your registrar):

```
Type: A
Name: apollo
Value: <your-hetzner-vps-ip>
TTL: 300 (5 min during setup, increase to 3600 after)
```

This creates `apollo.sciscribesolutions.com` pointing to your VPS.

### 1b. Verify DNS propagation

```bash
dig apollo.sciscribesolutions.com +short
# Should return your Hetzner VPS IP
```

### 1c. (Optional) Add a www redirect

```
Type: CNAME
Name: www.apollo
Value: apollo.sciscribesolutions.com
```

### 1d. Reactivate dormant domain

If the domain has been dormant for 6 months:
1. **Check registrar expiry** --- renew if within 30 days of expiring
2. **Check nameservers** --- verify they point to your DNS provider (Cloudflare, Route53, etc.)
3. **Remove any "parked" page** --- update DNS records to point to your VPS
4. **Verify email** --- some registrars suspend domains after prolonged inactivity; check registrar dashboard for any "domain on hold" notices
5. The main `sciscribesolutions.com` website continues working on its current server; only the `apollo` subdomain points to Hetzner

---

## Step 2: Hetzner VPS Setup

### 2a. Initial server setup

```bash
# SSH into your VPS
ssh root@<vps-ip>

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker

# Install Docker Compose plugin
apt install -y docker-compose-plugin

# Verify
docker --version    # Should be 24+
docker compose version  # Should be v2+
```

### 2b. Install Coolify

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

After installation:
1. Open `http://<vps-ip>:8000` in your browser
2. Create your admin account
3. Complete the initial setup wizard

### 2c. Configure Coolify domain

In Coolify dashboard:
1. Go to **Settings** > **General**
2. Set your instance FQDN to `coolify.sciscribesolutions.com` (or use IP)
3. Configure SSL (Coolify auto-generates Let's Encrypt certs)

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
npm install -g supabase

# Link to your project
cd Apollo/apps/web
supabase link --project-ref <your-project-ref>

# Push all migrations
supabase db push
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

From Settings > Database:
- Note the JWT Secret (needed for RLS tests, not for app)

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
3. Name: `apollo-uploads`
4. Location hint: Choose closest region

### 5b. Create API token

1. Go to R2 > Manage R2 API Tokens
2. Click **Create API token**
3. Permissions: **Object Read & Write**
4. Specify bucket: `apollo-uploads`
5. TTL: No expiry (or set a long expiry and rotate)

### 5c. Collect credentials

- `R2_ACCOUNT_ID` = Your Cloudflare Account ID (top-right of dashboard)
- `R2_ACCESS_KEY_ID` = Access Key ID from the API token
- `R2_SECRET_ACCESS_KEY` = Secret Access Key from the API token
- `R2_BUCKET_NAME` = `apollo-uploads`

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

After deployment, Inngest needs to know your app URL:
1. Go to Inngest Dashboard > Apps
2. Set the app URL to: `https://apollo.sciscribesolutions.com/api/inngest`
3. Inngest will auto-discover your functions

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

### 11a. Build images on VPS

```bash
# SSH into VPS
ssh root@<vps-ip>

# Clone the repo (or pull latest)
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

# Test R Plumber health
curl http://localhost:8787/health
# Should return {"status":"ok","r_version":"4.4.0",...}

# Test LaTeX compilation
docker run --rm apollo-latex pdflatex --version
# Should show pdfTeX version info
```

---

## Step 12: Deploy Next.js App via Coolify

### 12a. Add Git repository to Coolify

1. Open Coolify dashboard (`http://<vps-ip>:8000`)
2. Go to **Projects** > **Add New Resource** > **Application**
3. Source: **Git Repository** (public or add deploy key for private)
4. Repository URL: `<your-repo-url>`
5. Branch: `main`
6. Build Pack: **Nixpacks** (auto-detects Next.js)

### 12b. Configure build settings

In the application settings:
- **Base Directory**: `apps/web`
- **Build Command**: `pnpm install && pnpm build`
- **Start Command**: `node .next/standalone/server.js`
- **Port**: `3000`

### 12c. Set domain

In Coolify > Application > Domain:
1. Add domain: `apollo.sciscribesolutions.com`
2. Enable HTTPS (Let's Encrypt auto-configured by Coolify)
3. Force HTTPS redirect: Yes

### 12d. Set environment variables

In Coolify > Application > Environment Variables, add ALL of these:

```env
# === REQUIRED ===

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
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
R2_BUCKET_NAME=apollo-uploads

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# Inngest
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...

# LaTeX
LATEX_COMPILE_MODE=docker
LATEX_CONTAINER_NAME=apollo-latex

# R Plumber
R_PLUMBER_URL=http://localhost:8787
R_PLUMBER_SECRET=<same-as-docker-env>

# Razorpay
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
RAZORPAY_PLAN_ID_STUDENT_MONTHLY=plan_...
RAZORPAY_PLAN_ID_ADDON=plan_...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_STUDENT_ONETIME=price_...
STRIPE_PRICE_ID_STUDENT_MONTHLY=price_...
STRIPE_PRICE_ID_PROFESSIONAL_ONETIME=price_...
STRIPE_PRICE_ID_ADDON=price_...

# === OPTIONAL ===

# Sentry
# SENTRY_DSN=https://...@sentry.io/...
# NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...

# PostHog
# NEXT_PUBLIC_POSTHOG_KEY=phc_...

# CrossRef (recommended for faster lookups)
# CROSSREF_MAILTO=admin@sciscribesolutions.com

# PubMed (10 req/s instead of 3 req/s)
# PUBMED_API_KEY=...
```

### 12e. Deploy

1. Click **Deploy** in Coolify
2. Watch the build logs (first build takes 3-5 minutes)
3. Coolify auto-configures:
   - SSL certificate via Let's Encrypt
   - Reverse proxy (Traefik) from port 443 to 3000
   - Auto-restart on crash
   - Git push auto-deploy

---

## Step 13: Post-Deployment Verification

### 13a. Basic health checks

```bash
# App health
curl https://apollo.sciscribesolutions.com/api/health
# Should return {"status":"ok","dependencies":{"r_plumber":"ok","docker":"ok"}}

# SSL check
curl -I https://apollo.sciscribesolutions.com
# Should show HTTP/2 200 with security headers
```

### 13b. Run deploy conformance script

```bash
cd /opt/apollo
APOLLO_DOMAIN=apollo.sciscribesolutions.com bash scripts/deploy-conformance.sh
# All 12 checks should PASS (AppArmor may WARN on first run)
```

### 13c. Test critical flows

1. **Sign up** --- go to `https://apollo.sciscribesolutions.com/sign-up`, create account
2. **Create project** --- verify Supabase write works
3. **Upload synopsis** --- verify AI parsing works (Anthropic API)
4. **Generate content** --- verify background generation (Inngest + Claude)
5. **Compile PDF** --- verify Docker LaTeX compilation
6. **Upload dataset** --- verify R2 storage works
7. **Run analysis** --- verify R Plumber statistical analysis

### 13d. Test webhooks

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

### 13e. Register Inngest app

1. Go to Inngest Dashboard > Apps
2. Your app should auto-register when the first event is sent
3. If not, manually add: `https://apollo.sciscribesolutions.com/api/inngest`
4. Verify functions are discovered (should show: `thesis/section.generate`, `stale-cleanup`, `licence-expiry-cron`, `account-deletion-cron`, `analysis/run`)

---

## Step 14: Load Testing (Optional but Recommended)

```bash
# Install k6
brew install k6  # macOS
# or: apt install k6  # Linux

# Run against production
cd /opt/apollo
APOLLO_BASE_URL=https://apollo.sciscribesolutions.com k6 run scripts/load-test.js
```

Expected capacity (CX23):
- 1 concurrent LaTeX compile
- 2 concurrent R analyses
- 5 concurrent AI generations

---

## Step 15: Beta Launch Checklist

Before sharing with beta testers:

- [ ] All health checks passing
- [ ] SSL certificate valid (verify in browser)
- [ ] Sign up flow works end-to-end
- [ ] At least one complete thesis generation test (all 11 phases)
- [ ] PDF compilation produces correct output
- [ ] Payment flow works (test mode first, then live)
- [ ] Webhook delivery confirmed for all 3 providers (Clerk, Razorpay, Stripe)
- [ ] Inngest functions registered and running
- [ ] Error tracking configured (Sentry) or monitoring in place
- [ ] Backup strategy: Supabase daily backups enabled (Dashboard > Settings > Database)
- [ ] Razorpay KYC/verification complete (required for live payments in India)
- [ ] Legal pages accessible: `/privacy`, `/terms`, `/refund`

---

## Domain Recommendation

**`apollo.sciscribesolutions.com` is an excellent choice** because:

1. **Keeps main site running** --- `sciscribesolutions.com` continues serving its current website
2. **Clear brand hierarchy** --- Apollo is a product under the SciScribe Solutions umbrella
3. **Easy SSL** --- Coolify auto-generates Let's Encrypt certs for subdomains
4. **No migration risk** --- no need to touch existing DNS records for the main domain
5. **Professional appearance** --- `apollo.sciscribesolutions.com` is clean and memorable

If you later want `apollo.sciscribesolutions.com` to be the canonical URL, you can always add a redirect from a shorter domain.

---

## Rollback Procedure

If something goes wrong during deployment:

1. **Coolify**: Click "Rollback" to previous deployment in the application dashboard
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
# Push to main branch --- Coolify auto-deploys
git push origin main

# If Docker images need rebuilding (after Dockerfile changes):
ssh root@<vps-ip>
cd /opt/apollo
git pull
docker build -t apollo-latex -f docker/Dockerfile.latex .
docker build -t apollo-r-plumber -f docker/Dockerfile.r-plumber .
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d
```

### Monitoring
- **Coolify dashboard**: Application logs, deployment status, resource usage
- **Supabase dashboard**: Database size, API requests, auth events
- **Inngest dashboard**: Background job success/failure rates
- **Upstash dashboard**: Redis usage, rate limit hits
- **(Optional) Sentry**: Error tracking with stack traces
- **(Optional) PostHog**: User analytics and session recordings
