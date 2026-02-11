# Apollo Web SaaS: Development Workflow

## Sprint Cycle

- **Sprint duration**: 2 weeks
- **Sprint numbering**: Sprint 0 (setup), Sprint 1-2, 3-4, etc. (see `docs/PLAN.md` > MVP Roadmap)
- **Acceptance criteria**: Defined per sprint in the plan. Every sprint has explicit pass/fail criteria

## Branch Strategy

```
main                          # Production-ready. Protected. All PRs need CI green
└── sprint-N/short-description   # Feature branches per sprint task
    └── sprint-N/sub-feature     # Sub-branches if needed (rare)
```

### Branch naming
- Format: `sprint-N/short-description` (e.g., `sprint-1/setup-wizard`)
- Use kebab-case for the description
- Keep descriptions under 5 words

### Commit messages
- Imperative mood, concise
- Reference sprint: `Add synopsis upload API route [S1]`
- Reference issue if applicable: `Fix RLS policy for citations (#42) [S5]`

## PR Process

1. Create PR from `sprint-N/feature` → `main`
2. PR title: short, under 70 characters
3. PR body: Summary (1-3 bullets) + Test Plan (checklist)
4. CI must pass (lint, type-check, security tests, compile test)
5. Self-review the diff before requesting merge
6. Never force-push to `main`

## Development Flow

### Starting a new task
1. Read the relevant sprint section in `docs/PLAN.md`
2. Read any files you'll modify (non-negotiable)
3. Check `agent-guidance/lessons.md` for known issues
4. Create feature branch from `main`
5. Implement with tests
6. Run CI checks locally: `pnpm lint && pnpm type-check && pnpm test`
7. Commit and push

### Before every commit
Run through the checklist in `agent-guidance/rules.md` > Code Review Checklist

### Deployment
- **Target**: Hetzner CX23 VPS via Coolify
- **Method**: Git push → Coolify webhook → Docker build → deploy
- **SSL**: Let's Encrypt via nginx (auto-managed by Coolify)
- **Rollback**: Coolify supports instant rollback to previous deployment

### Environment variables
- Development: `.env.local` (git-ignored)
- Production: Coolify environment variables (never in code)
- Required vars documented in `.env.example` (committed, no real values)

## Docker Compose (Local Development)

```bash
# Start all services
docker compose up

# Start specific service
docker compose up web
docker compose up latex
docker compose up r-plumber

# Rebuild after Dockerfile changes
docker compose up --build
```

## Testing

### Local commands (run from `apps/web/`)

```bash
# Unit tests (Vitest) — run before every commit
pnpm test

# Unit tests with coverage report
pnpm test:coverage

# Unit tests in watch mode (during development)
pnpm test:watch

# Security + RLS tests (Vitest, separate test files)
pnpm test:security
pnpm test:rls

# Compile tests (both CLS files)
pnpm test:compile

# Citation bidirectional integrity
pnpm test:citations

# E2E tests (Playwright) — all 3 viewports (375px, 768px, 1280px)
pnpm test:e2e

# E2E with UI mode (interactive debugging)
pnpm test:e2e:ui

# Full local CI check (run before pushing)
pnpm lint && pnpm type-check && pnpm test && pnpm test:e2e
```

### Test matrix

| Type | Tool | Config | Directory | CI | Local |
|------|------|--------|-----------|:--:|:-----:|
| Unit | Vitest | `vitest.config.ts` | Colocated (`*.test.ts` next to source) | Yes | Yes |
| Security | Vitest | `vitest.config.ts` | `tests/security/` | Yes (Sprint 1-2+) | Yes |
| RLS | Vitest | `vitest.config.ts` | `tests/security/` | Yes (Sprint 1-2+) | Yes |
| Compile | Custom | — | `tests/` | Yes (Sprint 3-4+) | Yes |
| Citations | Custom | — | `tests/` | Yes (Sprint 5-6+) | Yes |
| E2E | Playwright | `playwright.config.ts` | `e2e/` | No (local only until Sprint 7+) | Yes |

### Test naming convention
- Unit: `describe("ComponentName")` → `it("should do specific thing")`
- E2E: `test.describe("Feature")` → `test("user can do action")`
- Security: `describe("RLS: table_name")` → `it("should deny cross-user access")`

### Playwright viewports
- **Mobile**: 375px × 812px (iPhone 13)
- **Tablet**: 768px × 1024px (iPad Mini)
- **Desktop**: 1280px × 720px (Chrome)

## package.json scripts

These scripts must be defined in `apps/web/package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:security": "vitest run tests/security/",
    "test:rls": "vitest run tests/security/rls.test.ts",
    "test:compile": "vitest run tests/compile.test.ts",
    "test:citations": "vitest run tests/citations.test.ts",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

## MCP Server Usage

See `agent-guidance/mcp-servers.md` for configuration details. MCP servers are added progressively — only configure what the current sprint needs.
