# Apollo Web SaaS: Development Rules

> These rules govern all Claude Code agent sessions working on the Apollo web app.
> Read `docs/PLAN.md` for full architecture and design decisions.

## Non-Negotiable Rules

1. **Read before writing**: Never modify a file you haven't read. Understand existing patterns before suggesting changes.
2. **Plan file is the source of truth**: All architecture decisions, data model, API contracts, and security rules are in `docs/PLAN.md`. Do not deviate without explicit user approval.
3. **No secrets in code**: API keys, tokens, and credentials go in environment variables only. Never hardcode, never commit to git. Use `.env.local` for development.
4. **British English everywhere**: All user-facing text, comments in user-visible code, and documentation use British English (colour, behaviour, analyse, etc.). Internal dev comments can use either.
5. **No over-engineering**: Only build what the current sprint requires. Do not add abstractions, feature flags, or "future-proofing" unless explicitly requested.
6. **Security by default**: RLS policies on every new table. Auth checks on every API route. Signed URLs for every file access. No exceptions.

## Code Review Checklist (Before Every Commit)

- [ ] No secrets or PII in diff
- [ ] RLS policy exists for any new/modified table
- [ ] API route checks auth + ownership
- [ ] Error responses use standard schema (see `docs/PLAN.md` > API Error Response Schema)
- [ ] No `any` types in TypeScript (use `unknown` + type guards if needed)
- [ ] British English in user-facing strings
- [ ] New dependencies justified (prefer existing packages from Import Don't Build list)

## File Organisation

```
Apollo/
├── apps/web/                  # Next.js 15 app (created in Sprint 1-2)
│   ├── app/                   # App Router pages and API routes
│   ├── components/            # React components
│   ├── lib/                   # Shared utilities, Supabase client, etc.
│   └── ...
├── templates/                 # LaTeX templates (DO NOT MODIFY — copy to Docker image)
├── guides/                    # GOLD Standard plan, writing guide (reference only)
├── agent-guidance/            # THIS DIRECTORY — dev rules for Claude agents
├── docs/                      # Plan, governance, architecture docs
│   ├── PLAN.md                # Frozen implementation plan
│   └── governance/            # Security, compliance, incident response
├── scripts/                   # Build, deploy, analysis scripts
├── docker/                    # Dockerfiles for LaTeX, R, compose
└── .github/workflows/         # CI/CD pipelines
```

## Dependency Management

- Use `pnpm` as package manager (not npm, not yarn)
- Pin all dependencies to exact versions in `pnpm-lock.yaml`
- Before adding a new package, check the Import Don't Build list in `docs/PLAN.md`
- Maximum 1 package for any given need (no duplicate solutions)

## Database Rules

- All schema changes via Supabase migrations (never manual SQL in production)
- Every table has RLS enabled with policies
- Every migration includes a rollback comment block
- New columns must have defaults or be nullable
- Test migrations against staging before production

## Git Workflow

- Branch naming: `sprint-N/short-description` (e.g., `sprint-1/setup-wizard`)
- Commit messages: imperative, concise, reference sprint (e.g., "Add synopsis upload API route [S1]")
- Never force-push to `main`
- All PRs require CI green before merge
