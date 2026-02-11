# Apollo Web SaaS: MCP Server Configuration

> MCP servers are added progressively. Only configure what the current sprint needs.
> Configuration lives in `.claude/settings.json` under `mcpServers`.

## Sprint 0 (Required to Start)

### Supabase
Database operations, schema management, RLS policy testing.

```bash
claude mcp add supabase -s project \
  -e SUPABASE_ACCESS_TOKEN=<your-token> \
  -- npx -y @supabase/mcp-server-supabase@latest --project-ref=<project-ref>
```

**Required environment variables:**
- `SUPABASE_ACCESS_TOKEN` — from Supabase dashboard > Account > Access Tokens
- `--project-ref` — from Supabase dashboard > Project Settings > General

### GitHub
PR management, issues, code review.

```bash
claude mcp add-json github '{
  "type": "http",
  "url": "https://api.githubcopilot.com/mcp",
  "headers": {
    "Authorization": "Bearer <github-pat>"
  }
}'
```

**Required**: GitHub Personal Access Token with `repo` scope.

## Before Sprint 7-8 (E2E Testing)

### Playwright
Visual regression testing, screenshot comparison, E2E flows.

```bash
claude mcp add playwright -- npx @playwright/mcp@latest
```

No additional credentials needed. Configure viewports in `playwright.config.ts`:
- Mobile: 375px
- Tablet: 768px
- Desktop: 1280px

## Before Sprint 9-10 (Payments)

### Stripe
International payment integration, subscription management.

```bash
claude mcp add stripe -- npx -y @stripe/mcp --tools=all --api-key=<sk_test_xxx>
```

**Required**: Stripe test API key (`sk_test_...`). Never use live keys in development.

Note: Razorpay does not have an MCP server. Use the `react-razorpay` package and Razorpay REST API directly.

## Before Beta Launch (Recommended)

### Sentry
Error tracking, production debugging, performance monitoring.

```bash
claude mcp add sentry \
  -e SENTRY_TOKEN=<token> \
  -e SENTRY_ORGANIZATION=<org-slug> \
  -- npx -y @sentry/mcp-server
```

## Verification

After adding any MCP server, verify it's working:

```bash
# Check configured servers
cat .claude/settings.json | jq '.mcpServers'

# The server should appear in Claude Code's tool list
# Test with a simple operation (e.g., list Supabase tables)
```

## Troubleshooting

- **"Server not found"**: Check that the npx package is installed and accessible
- **Auth errors**: Verify tokens haven't expired; regenerate if needed
- **Timeout**: MCP servers have a startup delay on first use; retry after 10 seconds
- **Port conflicts**: Each MCP server runs on its own port; check for conflicts with `lsof -i`
