# Apollo Web SaaS: Code Standards

## TypeScript

- **Strict mode**: `"strict": true` in `tsconfig.json`. No `any` types.
- **Prefer `interface` over `type`** for object shapes (extendable, better error messages)
- **Prefer `const` over `let`**. Never use `var`.
- **Use explicit return types** for exported functions. Inferred types for internal/private.
- **Naming**:
  - `camelCase` for variables, functions, methods
  - `PascalCase` for types, interfaces, components, classes
  - `SCREAMING_SNAKE_CASE` for constants and env vars
  - `kebab-case` for file names and directories

## React / Next.js

- **Server Components by default**. Only add `"use client"` when genuinely needed (interactivity, hooks, browser APIs).
- **Colocation**: Keep components, hooks, and utils close to where they're used. Only lift to `lib/` when shared across 3+ files.
- **No prop drilling beyond 2 levels**. Use React Context or server-side data fetching instead.
- **Forms**: Use React Hook Form + Zod for validation. Never roll custom form state.
- **Loading states**: Use Next.js `loading.tsx` and Suspense boundaries. No manual loading booleans.
- **Error handling**: Use Next.js `error.tsx` boundaries. API routes return standard error schema.

## Styling

- **Tailwind CSS only**. No CSS modules, no styled-components, no inline styles.
- **shadcn/ui components first**. Check if a shadcn component exists before building custom.
- **Responsive**: Mobile-first (`sm:`, `md:`, `lg:` breakpoints). Test at 375px width minimum.
- **Dark mode**: Not in MVP. Do not add dark mode support unless explicitly requested.

## API Routes (Next.js App Router)

```typescript
// Standard pattern for API routes
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Not authenticated", action: null, details: {} } },
      { status: 401 }
    );
  }

  // RLS handles tenant isolation — just query normally
  const { data, error } = await supabase.from("projects").select("*");

  if (error) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Database error", action: "retry", details: {} } },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
```

## Supabase

- **Always use `createClient()` from `@/lib/supabase/server`** for server-side. Never use the service role key in client code.
- **RLS does the heavy lifting**: Queries don't need `WHERE user_id = ...` — RLS policies enforce it. But always verify RLS policies are correct.
- **Realtime**: Use sparingly. Only for phase progress updates and compilation status.

## Testing

- **Vitest** for unit tests. Colocate test files (`foo.test.ts` next to `foo.ts`).
- **Playwright** for E2E (Sprint 7+). Three viewports: mobile (375px), tablet (768px), desktop (1280px).
- **Security tests**: Dedicated `tests/security/` directory for RLS, auth, and license gate tests.
- **Naming**: `describe("ComponentName")` → `it("should do specific thing")`.

## Error Handling

- **API routes**: Always return the standard error schema. Never throw unhandled.
- **Client components**: Wrap in Error Boundaries. Show user-friendly messages, log to Sentry.
- **Server actions**: Return `{ success: boolean; data?: T; error?: string }` — never throw from server actions.
- **External services** (Claude API, R, LaTeX): Wrap in try/catch with timeout. Return partial results where possible.

## Imports

- **Absolute imports**: Use `@/` prefix (maps to `apps/web/`). No relative `../../` beyond 1 level.
- **Import order** (enforced by ESLint):
  1. React / Next.js
  2. External packages
  3. Internal `@/lib/` utilities
  4. Internal `@/components/`
  5. Relative imports
  6. Types (using `import type`)
