# Apollo — AI-Powered Thesis Generation Platform

## Project Overview

Apollo is a web SaaS platform (responsive PWA, mobile-first) for Indian medical PG students. It accepts a synopsis, optional dataset, and university selection, then guides the student through iterative, AI-assisted thesis generation following the 12-phase GOLD Standard methodology.

**Full architecture and design decisions**: `docs/PLAN.md` (frozen — do not modify without explicit approval)

## Tech Stack (Web App)

- **Framework**: Next.js 15 (App Router), TypeScript (strict mode)
- **UI**: Tailwind CSS + shadcn/ui + Novel (rich text) + CodeMirror (LaTeX) + react-pdf
- **Auth + DB**: Supabase Free Tier (PostgreSQL + Auth + Realtime + RLS)
- **Storage**: Cloudflare R2 (signed URLs)
- **AI**: Claude Sonnet 4.5 / Opus 4.5 (prompt caching, SSE streaming)
- **Compute**: TeX Live 2025 + R 4.4 Plumber in Docker on Hetzner VPS
- **Workflow**: Inngest (durable 12-phase pipeline)
- **Hosting**: Hetzner CX23 + Coolify (docker-compose, git-push deploys)
- **Package manager**: pnpm (not npm, not yarn)

## CRITICAL RULES (NON-NEGOTIABLE)

1. **Read before writing**: Never modify a file you haven't read. Understand existing patterns first
2. **Plan file is source of truth**: All architecture decisions are in `docs/PLAN.md`. Do not deviate without explicit approval
3. **No secrets in code**: API keys and credentials in environment variables only (`.env.local` for dev)
4. **British English everywhere**: All user-facing text uses British English (colour, behaviour, analyse)
5. **No over-engineering**: Only build what the current sprint requires
6. **Security by default**: RLS on every table, auth on every API route, signed URLs for every file access
7. **No `any` types**: Use `unknown` + type guards if needed
8. **Server Components by default**: Only add `"use client"` when genuinely needed

## Agent Guidance Files

Read these before starting any work:

| File | Purpose |
|------|---------|
| `agent-guidance/rules.md` | Development rules, code review checklist, file organisation |
| `agent-guidance/code-standards.md` | TypeScript, React, Tailwind, API, testing standards |
| `agent-guidance/workflow.md` | Sprint workflow, branching, PR process, deployment |
| `agent-guidance/lessons.md` | Known issues, debugging patterns, pitfalls to avoid |
| `agent-guidance/mcp-servers.md` | MCP server setup and configuration |

## Governance Docs

| File | Purpose |
|------|---------|
| `docs/governance/data-classification.md` | Data types, retention, residency, DPDP Act compliance |
| `docs/governance/incident-response.md` | Severity levels, response steps, disaster recovery |
| `docs/governance/security-tests.md` | CI + VPS deploy-time security test checklist |
| `docs/governance/release-gates.md` | Per-sprint release gates and load test thresholds |

## Key Directories

```
Apollo/
├── apps/web/                  # Next.js 15 app (App Router)
│   ├── app/                   # Pages and API routes
│   ├── components/            # React components
│   └── lib/                   # Shared utilities, Supabase client
├── templates/                 # LaTeX templates (DO NOT MODIFY — copy to Docker image)
│   ├── sskm-thesis.cls        # WBUHS format
│   ├── ssuhs-thesis.cls       # SSUHS format
│   ├── main.tex               # Topic-agnostic template
│   └── logo/                  # University logos
├── guides/                    # GOLD Standard plan, writing guide (reference only)
├── agent-guidance/            # Dev rules for Claude agents (read these!)
├── docs/                      # Plan + governance docs
│   ├── PLAN.md                # Frozen implementation plan (git-ignored)
│   └── governance/            # Security, compliance, incident response
├── scripts/                   # Build, deploy, analysis scripts
├── docker/                    # Dockerfiles for LaTeX, R, compose
└── .github/workflows/         # CI/CD pipelines
```

## University Template System

Two CLS files with a **harmonised 50+ command API**. Switching requires only changing `\documentclass`:
- `sskm-thesis.cls` — WBUHS/Kolkata (Director, REFERENCES, bottom-centre pages)
- `ssuhs-thesis.cls` — SSUHS/Assam (Principal, BIBLIOGRAPHY, bottom-right pages + dept footer)

**Never use `\def\@variable`** — causes certificate truncation. Use `\renewcommand` pattern.

## LaTeX Compilation (for Docker service)

```bash
# Full cycle (required after .bib changes)
pdflatex -interaction=nonstopmode main.tex
bibtex main
pdflatex -interaction=nonstopmode main.tex
pdflatex -interaction=nonstopmode main.tex
```

See `agent-guidance/lessons.md` for known compilation issues (DOI underscores, table widths, etc.).

## Workflow (12-Phase GOLD Standard)

Phase 0: Orientation → Phase 1: Front Matter → Phase 2: Introduction → Phase 3: Aims →
Phase 4: ROL → Phase 5: M&M → Phase 6a: Dataset → Phase 6b: Results →
Phase 7: Discussion → Phase 8: Conclusion → Phase 9: References →
Phase 10: Appendices → Phase 11: Final QC

Each phase requires explicit approval before advancing. Phase 1→2 requires an active thesis license.

## Quick Reference

- **API error schema**: Standard JSON envelope with `code`, `message`, `action`, `details` (see `docs/PLAN.md`)
- **Citation tiers**: A (DOI/PMID, auto), B (ISBN/URL, student-confirmed), C (manual), D (unresolvable — blocks Final QC only)
- **Thesis licenses**: 1 license = 1 thesis. Projects start as sandbox. License required for Phase 2+
- **Compile warnings budget**: ≤20 tolerated (overfull hbox, font substitution). 0 blocking errors
- **Capacity**: 1 concurrent compile, 2 concurrent R analyses, 5 concurrent AI generations
