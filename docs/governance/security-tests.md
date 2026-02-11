# Security Test Checklist

> Reference: `docs/PLAN.md` > Governance > Security Tests
> Tests are split between CI (GitHub Actions) and VPS deploy-time conformance checks.

## CI Tests (GitHub Actions — Every PR)

Run via `pnpm test:security` and `pnpm test:rls`.

### RLS Policy Tests
- [ ] User A cannot read User B's projects
- [ ] User A cannot read User B's sections
- [ ] User A cannot read User B's citations
- [ ] User A cannot read User B's datasets
- [ ] User A cannot read User B's analyses
- [ ] User A cannot read User B's figures
- [ ] User A cannot read User B's compilations
- [ ] User A cannot write to User B's projects
- [ ] User A cannot write to User B's sections
- [ ] Supervisor can read (but not write) shared project sections
- [ ] Admin can read all projects in their organisation
- [ ] Admin cannot read projects in other organisations

### Tenant Isolation Tests
- [ ] Cross-organisation data access blocked for all tables
- [ ] Organisation membership required for org-level queries
- [ ] User role changes are reflected immediately in RLS

### Auth Tests
- [ ] Unauthenticated requests to all API routes return 401
- [ ] Expired JWT tokens return 401
- [ ] Wrong-role requests return 403 (e.g., student accessing admin endpoints)
- [ ] Supervisor without Professional/Institutional license gets 403 on share endpoint

### Signed URL Tests
- [ ] Expired signed URLs return 403
- [ ] Signed URLs for other users' files return 403
- [ ] Signed URLs cannot be reused after expiry
- [ ] Upload signed URLs reject wrong file types

### Rate Limit Tests
- [ ] AI generation endpoint returns 429 after limit exceeded (10/hr student, 30/hr professional)
- [ ] Rate limit response includes `retry_after_seconds` in details
- [ ] Rate limits are per-user, not global

### Upload Validation Tests
- [ ] Non-whitelisted file types rejected (only PDF, CSV, XLSX, PNG, JPG)
- [ ] Files exceeding 50MB rejected
- [ ] Filenames with path traversal characters rejected

### License Gate Tests
- [ ] Export endpoints return 402 without active license
- [ ] Phase 2+ generation blocked for sandbox projects
- [ ] Phase 1→2 approval requires attached license
- [ ] Supervisor sharing blocked for Student Monthly licenses
- [ ] Compilation in sandbox mode produces watermarked output

### Phase Transition Tests
- [ ] Invalid transitions rejected with 409 (e.g., Phase 0 → Phase 3)
- [ ] Phase can only increment by 1
- [ ] Approval requires section status = 'approved'
- [ ] Re-approving an already-approved phase is a no-op (idempotent)
- [ ] Phase 1→2 transition checks license attachment AND identity binding

### Payment Webhook Tests
- [ ] Valid Razorpay signature accepted
- [ ] Invalid Razorpay signature rejected with 400
- [ ] Valid Stripe signature accepted
- [ ] Invalid Stripe signature rejected with 400
- [ ] Duplicate event IDs return 200 with no side effects (idempotency)
- [ ] Stale Razorpay webhooks (>5 min) rejected
- [ ] Stripe retried webhooks (up to 72h) accepted (no age-based rejection)
- [ ] Successful payment → license provisioned atomically
- [ ] Failed DB insert → 500 returned (provider retries)

## VPS Deploy-Time Conformance Checks

Run via `./scripts/deploy-conformance.sh`. Fail the deploy if any check fails.

### LaTeX Container Isolation
- [ ] Seccomp profile active (`docker inspect` confirms security profile)
- [ ] No network access (`--network=none` or equivalent)
- [ ] Read-only root filesystem
- [ ] `/tmp` is writable (only writable mount)
- [ ] Memory limit: 1GB (`docker inspect` confirms)
- [ ] Timeout: 120 seconds enforced

### R Container Isolation
- [ ] Same isolation as LaTeX container (seccomp, no network, read-only, /tmp only)
- [ ] AppArmor profile loaded (`apparmor_status` confirms)
- [ ] No `system()` calls in Plumber endpoints (static analysis of R code)
- [ ] Runtime limits enforced per analysis type (15s-60s depending on type)

### Host Filesystem
- [ ] Containers cannot mount host paths outside designated volumes
- [ ] No bind mounts to `/`, `/etc`, `/home`, or similar sensitive paths

### Secret Isolation
- [ ] API keys (Claude, Stripe, Razorpay) not accessible from compile/R containers
- [ ] Environment variables in Next.js container only, not propagated to compute containers
- [ ] `docker inspect` confirms no secret env vars in compile/R containers

### SSL Certificate
- [ ] Valid SSL certificate (Let's Encrypt)
- [ ] Certificate not expiring within 14 days
- [ ] HTTPS redirect working (HTTP → HTTPS)

### Deploy Script Verification
The `deploy-conformance.sh` script runs:
```bash
docker inspect <latex-container> | jq '.HostConfig.SecurityOpt'
docker inspect <r-container> | jq '.HostConfig.SecurityOpt'
ss -tlnp  # verify no unexpected open ports
apparmor_status  # verify R container profile
# Exit non-zero on any failure
```
