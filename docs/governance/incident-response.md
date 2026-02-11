# Incident Response Playbook

> Reference: `docs/PLAN.md` > Governance > Incident Response Playbook

## Severity Levels

| Level | Description | Examples | Response Time |
|-------|-------------|---------|---------------|
| **P0** | Data breach, security compromise | Unauthorised data access, leaked credentials, RLS bypass | Immediate (< 1 hour) |
| **P1** | Service down, data loss risk | VPS unresponsive, Supabase outage, compilation pipeline broken | < 1 hour |
| **P2** | Degraded service | Slow compiles, intermittent AI timeouts, R analysis failures | < 4 hours |
| **P3** | Minor issue | UI bugs, warning messages, cosmetic issues | Next business day |

## Response Steps

### 1. Detection
- Sentry alerts (error rate spikes, new error types)
- Betterstack uptime monitor (service availability)
- User reports (in-app feedback, email, support)
- Monitoring anomalies (PostHog event drops, unusual patterns)

### 2. Triage (< 1 hour for P0/P1)
- Classify severity using the table above
- Identify affected scope: how many users? which features?
- Assign incident owner (single point of accountability)
- Document start time and initial assessment

### 3. Containment (P0/P1 only)
- **Data breach**: Disable affected API endpoints; rotate compromised credentials immediately
- **Service down**: Check Coolify dashboard; restart containers if needed
- **RLS bypass**: Enable maintenance mode; block affected queries
- **Credential leak**: Rotate all secrets (Claude API, Stripe, Razorpay, Supabase); deploy updated env vars via Coolify

### 4. Investigation
- Review audit logs (`audit_log` table) filtered by affected time window
- Check Sentry for error traces and stack traces
- Review structured logs on VPS (7-day retention; search by `project_id`, `user_id`)
- Check Inngest dashboard for workflow failures
- Document timeline of events

### 5. Resolution
- Fix root cause (not symptoms)
- Deploy patch via normal CI/CD (Coolify git webhook)
- Verify fix in staging before production
- Run relevant security tests to confirm no regression

### 6. Communication
- **P0 (data breach)**: Notify affected users within 72 hours (DPDP Act target; confirm exact requirement with legal counsel)
- **P1 (service down)**: Status page update (if available) or email to affected users
- **P2/P3**: No external communication unless >4 hours of degradation

### 7. Post-Mortem (within 48 hours)
- Document: what happened, when, impact, root cause, fix, prevention
- Update `agent-guidance/lessons.md` with what was learned
- Update security controls if needed (new RLS policy, new test, etc.)
- File follow-up tasks for any identified improvements

## Disaster Recovery Scenarios

| Scenario | Impact | Recovery |
|----------|--------|----------|
| VPS dies | Next.js + LaTeX + R down; Supabase + R2 + Storage Box unaffected | Provision new CX23 (~5 min), deploy via Coolify git webhook (~10 min), verify health checks. Total: ~30 min |
| Supabase outage | Auth + DB down; VPS and R2 unaffected | Wait for Supabase recovery (their SLA: 99.9%). No self-hosted fallback on free tier. Communicate downtime to users |
| R2 outage | File access down; app and DB unaffected | Serve from Storage Box backup via rclone or temporary nginx fallback. Restore when R2 recovers |
| Data corruption | Depends on scope | Restore from Supabase backup (≤24h old) + R2 backup (≤7 days old). Accept data loss within RPO window |

## Recovery Targets

- **RPO (Recovery Point Objective)**: 24 hours
- **RTO (Recovery Target Objective)**: 4 hours

## Credential Rotation Checklist (P0)

When any credential is potentially compromised:

- [ ] Claude API key: Rotate in Anthropic console → update Coolify env → redeploy
- [ ] Supabase service role key: Rotate in Supabase dashboard → update Coolify env → redeploy
- [ ] Stripe secret key: Rotate in Stripe dashboard → update Coolify env → update webhook endpoint → redeploy
- [ ] Razorpay key/secret: Rotate in Razorpay dashboard → update Coolify env → update webhook endpoint → redeploy
- [ ] R2 access keys: Rotate in Cloudflare dashboard → update Coolify env → redeploy
- [ ] GitHub PAT: Rotate in GitHub settings → update Coolify webhook → update MCP config
- [ ] Verify all rotated credentials work before marking incident resolved
