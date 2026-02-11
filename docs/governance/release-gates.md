# Release Gate Registry

> Reference: `docs/PLAN.md` > Governance > Release Gate Registry
> Every sprint must pass ALL applicable gates before merging to main.

## Gate Definitions

| Gate | Owner | Tool / Command | Timeout | Pass Threshold | Failure Action |
|------|-------|---------------|---------|---------------|----------------|
| **RLS tests** | Dev | `pnpm test:rls` (CI) | 5 min | All green | Block deploy |
| **Security (CI)** | Dev | `pnpm test:security` (CI) | 5 min | All green | Block deploy |
| **Security (VPS)** | Dev | `./scripts/deploy-conformance.sh` (VPS) | 2 min | All green | Abort deploy; alert |
| **SLO compliance** | Dev | Betterstack + Sentry dashboard | 24 hr soak | No breach in staging | Block deploy |
| **Compile test** | Dev | `pnpm test:compile` — both CLS files | 3 min | Zero blocking errors; ≤20 warnings | Block deploy |
| **Citation audit** | Dev | `pnpm test:citations` on test project | 1 min | Bidirectional integrity passes | Block deploy |
| **Schema migration** | Dev | Run on prod snapshot; verify rollback | 10 min | Clean run + clean rollback | Block deploy; manual review |
| **Browser test** | Dev | `pnpm test:playwright` — 3 viewports | 5 min | Screenshots match baseline (±5% diff) | Block deploy |
| **AI output quality** | Dev | Quality rubric on 3 test theses | 30 min | All checks pass per rubric | Block deploy; review rubric |
| **Load test** | Dev | `k6 run load-test.js` | 15 min | See capacity model thresholds | Do not launch |

## Gate Applicability by Sprint

| Gate | S0 | S1-2 | S3-4 | S5-6 | S7 | S8 | S9-10 |
|------|:--:|:----:|:----:|:----:|:--:|:--:|:-----:|
| RLS tests | — | Yes | Yes | Yes | Yes | Yes | Yes |
| Security (CI) | — | Yes | Yes | Yes | Yes | Yes | Yes |
| Security (VPS) | — | — | Yes | Yes | Yes | Yes | Yes |
| SLO compliance | — | — | — | — | — | Yes | Yes |
| Compile test | — | Yes | Yes | Yes | Yes | Yes | Yes |
| Citation audit | — | — | — | Yes | Yes | Yes | Yes |
| Schema migration | — | Yes | Yes | Yes | Yes | Yes | Yes |
| Browser test | — | — | — | — | Yes | Yes | Yes |
| AI output quality | — | — | — | Yes | Yes | Yes | Yes |
| Load test | — | — | — | — | — | — | Launch |

## Escalation

If any gate fails and cannot be resolved within 4 hours:
1. Document the failure (what failed, why, attempted fixes)
2. Escalate to product owner for scope/timeline decision
3. **Never skip gates** — either fix the issue or defer the release

## Load Test Thresholds (Pre-Launch — Hard Gate)

These thresholds must pass on the target VPS before launch:

- [ ] 3 sequential compiles with 2 queued: complete without OOM or exceed 3.8 GB RSS
- [ ] 2 concurrent R analyses (including survival/meta-analysis): complete within runtime limits
- [ ] 1 compile + 1 analysis concurrent: compile p95 does not exceed 90s
- [ ] 10 concurrent AI generations: stream without timeout
- [ ] Compile p95 under no-contention load: < 60s
- [ ] Compile p95 under mixed load: < 90s

**If any threshold fails**: Upgrade to CX33 (8GB RAM, 4 vCPU, ~$7/mo) BEFORE launch. Do not launch on CX23 if load test fails.
