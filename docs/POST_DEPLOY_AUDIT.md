# Post-Deployment Audit & Mitigation Plan

## Flow Terminology (Reference)

### Setup Flow (5 steps)
The setup wizard at `/projects/[id]/setup`:

| Stage | Name | Component | Description |
|-------|------|-----------|-------------|
| **S1** | University Selection | `university-step.tsx` | Pick WBUHS / SSUHS / Other |
| **S2** | Synopsis Upload | `synopsis-upload-step.tsx` | Upload PDF, AI parses it |
| **S3** | Parsed Data Review | `parsed-data-review-step.tsx` | Review/edit AI-extracted fields |
| **S4** | Metadata Form | `metadata-form-step.tsx` | Fill candidate/guide/academic details |
| **S5** | Title Page Preview | `title-page-preview-step.tsx` | Preview title page, proceed to workspace |

### Pipeline Flow (12 phases)
The workspace at `/projects/[id]`:

| Phase | Name | Short Label | Sandbox? |
|-------|------|-------------|----------|
| **P0** | Orientation | ORIENT. | Yes |
| **P1** | Front Matter | FRONT | Yes |
| **P2** | Introduction | INTRO | Yes |
| **P3** | Aims & Objectives | AIMS | No (licence required) |
| **P4** | Review of Literature | ROL | No |
| **P5** | Materials & Methods | M & M | No |
| **P6** | Results | RESULTS | No |
| **P7** | Discussion | DISCUSS. | No |
| **P8** | Conclusion | CONCL. | No |
| **P9** | References | REFS | No |
| **P10** | Appendices | APPEND. | No |
| **P11** | Final QC | FINAL QC | No |

### Checkout Flow
`/checkout` page --> payment provider --> webhook --> licence provisioning

### Transition
**S5 --> P0**: The handoff from setup wizard to workspace pipeline. **Currently broken.**

---

## Issue Registry

### Critical (Blocks Core Functionality)

| ID | Issue | Scope | Discovered |
|----|-------|-------|------------|
| **C1** | Docker compile fails: `mkdir: cannot create directory '/thesis': Operation not permitted` | Pipeline (all phases) | 2026-02-20 |
| **C2** | AI generation stuck at "Generating" --- Inngest jobs may not execute | Pipeline (all phases) | 2026-02-20 |
| **C3** | No transition from S5 to workspace --- users stuck after setup | Setup --> Pipeline | 2026-02-20 |

### High (Breaks User Experience)

| ID | Issue | Scope | Discovered |
|----|-------|-------|------------|
| **H1** | SSUHS full form wrong everywhere: "Sri Siddhartha" instead of "Srimanta Sankaradeva" | S1, title page, template gallery | 2026-02-20 |
| **H2** | Checkout 500 for subscription plans --- missing Razorpay plan IDs | Checkout Flow | 2026-02-20 |
| **H3** | Licence banner shows too early (Phase 1) with wrong text | Pipeline workspace | 2026-02-20 |
| **H4** | Compile returns 422 in workspace --- consequence of C2 (no generated content to compile) | Pipeline P1+ | 2026-02-20 |
| **H5** | Clerk proxy domain errors (ERR_INTERNET_DISCONNECTED) | All pages | 2026-02-20 |

### Medium (UX Improvements)

| ID | Issue | Scope | Discovered |
|----|-------|-------|------------|
| **M1** | Hero 3D scene axes too light | Landing page | 2026-02-20 |
| **M2** | Setup wizard missing fields: co-guide, institute, university in AI parse + forms | S2, S3, S4 | 2026-02-20 |
| **M3** | No auto-fill from parsed synopsis to metadata form | S3 --> S4 | 2026-02-20 |
| **M4** | "Year" label should be "Submission Month & Year"; session needs format validation | S4 | 2026-02-20 |
| **M5** | Co-guide and institute not wired into LaTeX generation | Pipeline compile | 2026-02-20 |

### Low (Cosmetic/External)

| ID | Issue | Scope | Discovered |
|----|-------|-------|------------|
| **L1** | Razorpay payment page loads images from localhost:7071 (ERR_CONNECTION_REFUSED) | Checkout | 2026-02-20 |

---

## Detailed Diagnosis

### C1: Docker Compile Failure --- Volume Mount Missing `:rw`

**Error**: `mkdir: cannot create directory '/thesis': Operation not permitted`

**Root Cause**: Phase 10 Docker hardening added `--read-only` flag to the container but forgot to add `:rw` suffix to the `/thesis` volume mount.

**File**: `apps/web/lib/latex/compile.ts` line 199

```
Current:  "-v", `${workDir}:/thesis`
Required: "-v", `${workDir}:/thesis:rw`
```

**Chain of events**:
1. `compile.ts:191` sets `--read-only` (entire container filesystem read-only)
2. `compile.ts:192` sets `--tmpfs /tmp:rw,size=512m` (tmp is writable --- correct)
3. `compile.ts:199` mounts work directory as `/thesis` **without `:rw`** --- inherits read-only
4. `compile.sh:21` runs `mkdir -p /thesis/output` --- fails with EPERM
5. Seccomp profile DOES allow `mkdir`/`mkdirat` (confirmed in `seccomp-latex.json:18`)
6. Capabilities (`DAC_OVERRIDE`, `FOWNER`) are present --- not a capability issue
7. It's purely the read-only filesystem blocking the write

**Fix**: One-character change: add `:rw` to the volume mount flag.

**Introduced in**: Commit `b90d04f` (Phase 10: Docker hardening)

---

### C2: AI Generation Stuck at "Generating"

**Symptom**: User clicks "Generate with AI" on any phase. Section status changes to "generating" and never progresses. The editor shows "Generating" badge indefinitely.

**Root Cause**: Inngest background job execution failure. Multiple possible causes:

**File**: `apps/web/app/api/projects/[id]/sections/[phase]/generate/route.ts`

**Flow**:
1. Route sets `section.status = "generating"` (line 334)
2. Route calls `inngest.send({ name: "thesis/section.generate", ... })` (line 351)
3. Route returns 200 `{ status: "generating" }` immediately
4. Inngest Cloud should deliver the event to `/api/inngest` webhook endpoint
5. `aiGenerateFn` processes the event, calls Claude API, writes content, sets `status = "review"`
6. **If step 4 or 5 fails, status stays "generating" forever**

**Diagnosis checklist** (must verify on production VPS):

| Check | How | Expected |
|-------|-----|----------|
| Env vars set? | `echo $INNGEST_EVENT_KEY $INNGEST_SIGNING_KEY` | Both non-empty |
| Inngest Cloud sees app? | Inngest Dashboard --> Apps --> apollo | App synced, 6 functions discovered |
| Webhook reachable? | `curl -I https://apollo.sciscribesolutions.com/api/inngest` | 200 or 405 (not 401/403/502) |
| Events being sent? | Inngest Dashboard --> Events --> `thesis/section.generate` | Recent events visible |
| Functions executing? | Inngest Dashboard --> Functions --> `ai-generate` --> Runs | Recent runs (not empty) |
| Anthropic API key valid? | Check `ANTHROPIC_API_KEY` on VPS | Key present and not expired |

**Stale recovery**: `generate/route.ts:29` defines `STALE_GENERATING_MS = 5 * 60 * 1000`. After 5 minutes, the stale cleanup cron (Inngest function) resets stuck sections to "draft". But if the stale cleanup cron itself isn't running (also Inngest), nothing recovers.

**Fix** (code change): Add explicit error handling around `inngest.send()`:
```ts
// In generate/route.ts, around line 351:
try {
  await inngest.send({ name: "thesis/section.generate", data: { ... } });
} catch (err) {
  console.error("[generate] Failed to enqueue Inngest job:", err);
  // Roll back status so user can retry
  await supabase.from("sections").update({ status: "draft" }).eq("id", section.id);
  return internalError("Failed to start generation. Please try again.");
}
```

**Fix** (infrastructure): Verify Inngest Cloud configuration, webhook reachability, and all env vars.

---

### C3: No Transition from Setup Flow (S5) to Pipeline Workspace

**Symptom**: After completing S5 (title page preview), sandbox users see only "Activate with a Licence" with no way to proceed to the workspace. Licensed users see "Setup Complete" with no action button.

**File**: `apps/web/components/wizard/setup-wizard.tsx` lines 260--273

```tsx
{currentStep < 5 ? (
  <button ... onClick={handleNext}>Next</button>
) : (
  <div>{/* No next button on the final step */}</div>  // ← EMPTY
)}
```

**File**: `apps/web/components/wizard/steps/title-page-preview-step.tsx` lines 44--56

Sandbox users see an amber banner with only "Activate with a Licence" link. There is no "Continue to Workspace" button.

**Fix**: Add navigation buttons on S5:
- **All users**: "Continue to Workspace" primary button --> navigates to `/projects/${project.id}`
- **Sandbox users**: Additional text: "You can explore the workspace and generate content up to Introduction (Phase 2). To unlock full thesis generation, attach a licence."
- **Sandbox users**: Secondary "Get Licence" button --> `/checkout?attach=${project.id}`

---

### H1: SSUHS Full Form Wrong Everywhere

**Current (WRONG)**: "Sri Siddhartha University of Health Sciences" + location "Tumkur, Karnataka"
**Correct**: "Srimanta Sankaradeva University of Health Sciences" + location "Guwahati, Assam"

"Sri Siddhartha" is a completely different university in Karnataka. SSUHS is in Assam.

**Files to fix**:

| File | Line(s) | Current | Correct |
|------|---------|---------|---------|
| `components/wizard/steps/university-step.tsx` | 19 | `"Sri Siddhartha University of Health Sciences"` | `"Srimanta Sankaradeva University of Health Sciences"` |
| `lib/preview/title-page.ts` | 13 | `"Sri Siddhartha University of Health Sciences"` | `"Srimanta Sankaradeva University of Health Sciences"` |
| `lib/preview/title-page.ts` | 20 | `"Tumkur, Karnataka"` | `"Guwahati, Assam"` |
| `components/project/template-gallery.tsx` | 81 | `"SSUHS / Assam"` | OK (already says Assam) |

Also check and fix in:
- `ssuhs-thesis.cls` --- verify the `\universityname` default matches
- Any hardcoded references in LaTeX generation code

---

### H2: Checkout 500 for Subscription Plans

**Symptom**: "Student One-Time" plan works (reaches Razorpay). "Student Monthly", "Add-on Thesis", and "Professional One-Time" show `POST /api/checkout 500`.

**Root Cause**: Subscription plans (billingType = "monthly") call `createRazorpaySubscription()` which requires Razorpay Plan IDs stored in env vars. These env vars don't exist.

**File**: `apps/web/lib/payments/razorpay.ts` lines 76--90

```ts
const envKey = RAZORPAY_PLAN_ENV[planType];  // e.g. "RAZORPAY_PLAN_ID_STUDENT_MONTHLY"
const razorpayPlanId = process.env[envKey];   // undefined → throws
```

**Plan status**:

| Plan | Type | INR | Status |
|------|------|-----|--------|
| `student_onetime` | one_time | `createRazorpayOrder()` | **Works** |
| `student_monthly` | monthly | `createRazorpaySubscription()` | **500** --- missing `RAZORPAY_PLAN_ID_STUDENT_MONTHLY` |
| `professional_onetime` | one_time | `createRazorpayOrder()` | **Should work** (verify) |
| `professional_monthly` | monthly | Blocked at route line 27 | **Blocked** (coming soon) |
| `addon` | monthly | `createRazorpaySubscription()` | **500** --- missing `RAZORPAY_PLAN_ID_ADDON` |

**Fix options**:

**Option A (recommended for launch)**: Disable subscription plans temporarily:
- Mark `student_monthly` and `addon` as `comingSoon: true` in both `pricing/config.ts` and `checkout/page.tsx`
- This prevents the 500 error entirely while you create Razorpay plans

**Option B (full fix)**: Create Razorpay subscription plans:
1. Razorpay Dashboard --> Plans --> Create Plan:
   - Student Monthly: period=monthly, interval=1, amount=549900 paise
   - Add-on Thesis: period=monthly, interval=1, amount=399900 paise
2. Add env vars on VPS:
   ```
   RAZORPAY_PLAN_ID_STUDENT_MONTHLY=plan_xxxxxxxxxxxxx
   RAZORPAY_PLAN_ID_ADDON=plan_xxxxxxxxxxxxx
   ```
3. Similarly for Stripe (USD path):
   ```
   STRIPE_PRICE_ID_STUDENT_MONTHLY=price_xxxxxxxxxxxxx
   STRIPE_PRICE_ID_ADDON=price_xxxxxxxxxxxxx
   ```

**Additional checkout issue**: The checkout page does NOT gate `professional_onetime` with `comingSoon`. The backend should work (it's one-time), but verify the `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` env vars are set.

---

### H3: Licence Banner Wrong Threshold and Text

**File**: `apps/web/components/project/licence-banner.tsx`

**Current behaviour**: Banner appears at Phase 1 (Front Matter) saying:
> "Attach a thesis licence to continue beyond Phase 1. Your work in Phase 0 and Phase 1 is preserved."

**Correct behaviour**: Banner should appear from Phase 2 onwards (Introduction is the last sandbox phase). Text should say:
> "Attach a thesis licence to continue beyond Introduction (Phase 2). Your work in Phases 0--2 is preserved."

**Fix**:
- Line 21: `currentPhase < 1` --> `currentPhase < 2`
- Line 31: "beyond Phase 1" --> "beyond Introduction (Phase 2)"
- Line 32: "Phase 0 and Phase 1" --> "Phases 0--2"

---

### H4: Compile Returns 422

**Symptom**: Clicking "Compile PDF" in workspace returns 422 with validation errors.

**Root Cause**: This is a **consequence of C2**. When AI generation never completes, sections have no `latex_content`. The compile route's pre-flight validation (`compile/route.ts:186-214`) checks chapter files for LaTeX syntax errors. Empty or missing chapters trigger validation failures --> 422.

**Not a separate bug.** Fixing C1 (Docker volume mount) and C2 (Inngest execution) will resolve this.

The Docker error in the screenshot (`mkdir: cannot create directory '/thesis'`) confirms C1 is also active. So both issues compound: even if content existed, the Docker container can't write output.

---

### H5: Clerk Proxy Domain Errors

**Symptom**: Console shows repeated `Failed to load resource: clerk.apollo.sciscri... net::ERR_INTERNET_DISCONNECTED`

**Root Cause**: Clerk's JavaScript SDK automatically constructs a proxy domain: `clerk.<your-app-domain>`. For `apollo.sciscribesolutions.com`, it tries to reach `clerk.apollo.sciscribesolutions.com`. Without a DNS CNAME record, this fails.

**Diagnosis**: The user says they're using the default Clerk domain. But the Clerk SDK on the production site is attempting to use a proxy subdomain, which means either:
1. The Clerk publishable key is configured for a production instance that expects `clerk.apollo.sciscribesolutions.com`
2. Or Clerk auto-detects the custom domain and tries to proxy

**Fix**: Add a CNAME DNS record:
```
clerk.apollo.sciscribesolutions.com  CNAME  frontend-api.clerk.dev
```

Or, in Clerk Dashboard --> Domains, verify the proxy configuration matches your setup. If not using Clerk proxy, ensure the publishable key matches a development/production instance that uses Clerk's default domain (`*.clerk.accounts.dev`).

**Impact**: Authentication may work intermittently (Clerk falls back to its default domain), but console errors and potentially degraded auth performance.

---

### L1: Razorpay localhost:7071 Image Errors

**Symptom**: Razorpay payment page shows `GET http://localhost:7071/*.png` ERR_CONNECTION_REFUSED errors.

**Root Cause**: This is NOT in the Apollo codebase. The `localhost:7071` references come from Razorpay's own payment page loading your **business branding images** configured in the Razorpay Dashboard.

**Fix**: In Razorpay Dashboard --> Settings --> Brand:
- Upload a proper logo image hosted on your production domain
- Remove any localhost references in branding/image URLs
- If using Razorpay live mode: ensure all branding assets use HTTPS production URLs

---

## Changes from Original Plan (Preserved)

### Change 1: Hero 3D Scene --- Darken Graph Axes

**File**: `apps/web/components/landing/hero-3d-scene.tsx` (LOCKED --- user explicitly approved)

Line 343: `const AXIS_COLOR = "#C0C0C0"` --> `"#2A2A2A"`

One-line change. Controls all axis lines, arrowheads, and tick marks.

---

### Change 2: Setup Wizard Form Improvements

#### 2A: Add 6 new fields to AI synopsis parsing

**`apps/web/lib/ai/prompts.ts`**
- `SYNOPSIS_PARSE_SYSTEM_PROMPT` (after line 38 `keywords` bullet): Add 6 extraction fields:
  - `candidate_name`: The name of the candidate/student submitting the thesis (string or null)
  - `registration_no`: The candidate's registration or enrolment number (string or null)
  - `guide_name`: The name of the thesis guide/supervisor (string or null)
  - `co_guide_name`: The name of the co-guide/co-supervisor, if any (string or null)
  - `institute_name`: The name of the institute, hospital, or medical college (string or null)
  - `university_name`: The name of the university the thesis is submitted to (string or null)
- `SynopsisParseResult` interface (line 673--687): Add all 6 fields (all `string | null`)

**`apps/web/lib/ai/parse-synopsis-response.ts`** (return block, lines 26--53)
- Add 6 new field extractions with `typeof string` guard

#### 2B: Align `ParsedSynopsis` with `SynopsisParseResult`

**`apps/web/lib/synopsis/parser.ts`** (lines 1--11)
- Add to `ParsedSynopsis`: `department`, `duration`, `setting`, `keywords`, `candidate_name`, `registration_no`, `guide_name`, `co_guide_name`, `institute_name`, `university_name`
- Add `null` defaults in `parseSynopsis()` initialiser

#### 2C: Display new fields in Step 3 (Parsed Data Review)

**`apps/web/components/wizard/steps/parsed-data-review-step.tsx`**
- After "Study Type" input, add 2-col grid: Candidate Name, Registration No., Guide Name, Co-Guide Name, Department, Institute Name, University Name
- All editable text inputs using existing `inputClass` pattern

#### 2D: Update `ProjectMetadata` type

**`apps/web/lib/types/database.ts`** (lines 58--69)
- Add `co_guide_name?: string;`, `institute_name?: string;`
- Keep `year` field name (avoid DB migration) --- only change UI label
- `university_name` NOT added to ProjectMetadata --- already captured by `university_type` in S1

#### 2E: Metadata form changes (Step 4)

**`apps/web/components/wizard/steps/metadata-form-step.tsx`**
1. Add "Co-Guide Name" field in Supervision fieldset (after Guide Name, before HOD)
2. Add "Institute Name" field in Academic fieldset (after Department)
3. Rename "Year" label --> "Submission Month & Year", placeholder --> "e.g. March 2026"
4. Add session format hint: `Format: YYYY-YYYY` + `pattern="\d{4}-\d{4}"` with red border on invalid

#### 2F: Auto-fill metadata from parsed synopsis

**`apps/web/components/wizard/setup-wizard.tsx`** (lines 100--106, `handleNext` step 3)
- Seed metadata from parsedData: `candidate_name`, `registration_no`, `guide_name`, `co_guide_name`, `department`, `institute_name`
- Only fill empty fields (`if (!metadata.xxx)` guard)
- Final persist at S4 completion via `patchProject({ metadata_json })`

---

### Change 3: Sandbox User Flow --- Enable Workspace Access

#### 3A: "Continue to Workspace" button on S5

**`apps/web/components/wizard/steps/title-page-preview-step.tsx`** (lines 44--56)
- Replace sandbox block with two buttons:
  - **Primary (blue)**: "Continue to Workspace" --> `/projects/${project.id}`
  - **Secondary (outlined amber)**: "Get Licence" --> `/checkout?attach=${project.id}`
- Text: "You can explore the workspace and generate content up to Introduction. To unlock full thesis generation, attach a licence."

**`apps/web/components/wizard/setup-wizard.tsx`** (lines 260--273)
- Replace empty div on final step with "Continue to Workspace" navigation button

#### 3B: Update licence banner text and threshold

**`apps/web/components/project/licence-banner.tsx`**
- Line 21: `currentPhase < 1` --> `currentPhase < 2`
- Line 31: "beyond Phase 1" --> "beyond Introduction (Phase 2)"
- Line 32: "Phase 0 and Phase 1" --> "Phases 0--2"

---

### Change 4: Wire `co_guide_name` into LaTeX Generation

#### 4A: `generate-tex.ts` --- Handle commented template lines

**`apps/web/lib/latex/generate-tex.ts`** (after FIELD_MAP loop, line 95)

```ts
// Uncomment and set co-guide if provided
if (metadata.co_guide_name) {
  const escaped = escapeLatexArg(metadata.co_guide_name);
  tex = tex.replace(/^%\\cosupervisorname\{[^}]*\}/m, `\\cosupervisorname{${escaped}}`);
  tex = tex.replace(/^%\\cosupervisordesignation\{[^}]*\}/m, "\\cosupervisordesignation{Associate Professor}");
}

// Uncomment and set institute if provided
if (metadata.institute_name) {
  const escaped = escapeLatexArg(metadata.institute_name);
  tex = tex.replace(/^%\\institutename\{[^}]*\}/m, `\\institutename{${escaped}}`);
}
```

#### 4B: `front-matter.ts` --- co-guide + institute + acknowledgements

**`apps/web/lib/latex/front-matter.ts`**
- After guide block: add co-guide lines if `meta.co_guide_name` is set
- After department block: add institute line if `meta.institute_name` is set
- In `generateAcknowledgements`: add co-guide paragraph

#### 4C: Title page preview --- show co-guide + institute

**`apps/web/lib/preview/title-page.ts`**
- Add co-guide block if `metadata.co_guide_name` is set
- Use `metadata.institute_name` in footer section if present, falling back to department

---

## Implementation Order

### Phase A: Critical Fixes (unblocks core functionality)

| Step | Issue | Change | Files |
|------|-------|--------|-------|
| A1 | C1 | Docker volume mount `:rw` | `compile.ts` |
| A2 | C2 | Inngest diagnosis + error handling in generate route | `generate/route.ts` + VPS env check |
| A3 | C3 | "Continue to Workspace" button on S5 | `title-page-preview-step.tsx`, `setup-wizard.tsx` |
| A4 | H1 | Fix SSUHS full form + location | `university-step.tsx`, `title-page.ts` |

### Phase B: High-priority fixes

| Step | Issue | Change | Files |
|------|-------|--------|-------|
| B1 | H2 | Disable subscription plans OR create Razorpay plan IDs | `config.ts`, `checkout/page.tsx` OR env vars |
| B2 | H3 | Licence banner threshold + text | `licence-banner.tsx` |
| B3 | H5 | Clerk proxy domain DNS | DNS config (external) |

### Phase C: UX improvements (from original plan)

| Step | Issue | Change | Files |
|------|-------|--------|-------|
| C1 | M1 | Hero axis colour | `hero-3d-scene.tsx` |
| C2 | M2 | Types: `ParsedSynopsis` + `ProjectMetadata` + `SynopsisParseResult` | `parser.ts`, `database.ts`, `prompts.ts` |
| C3 | M2 | AI prompt + response parser | `prompts.ts`, `parse-synopsis-response.ts` |
| C4 | M2 | Parsed data review UI (S3) | `parsed-data-review-step.tsx` |
| C5 | M4 | Metadata form: co-guide, year rename, session validation | `metadata-form-step.tsx` |
| C6 | M3 | Auto-fill metadata from parsed data | `setup-wizard.tsx` |
| C7 | M5 | LaTeX: co-guide + institute wiring | `generate-tex.ts`, `front-matter.ts`, `title-page.ts` |

### Phase D: External/cosmetic

| Step | Issue | Change | Where |
|------|-------|--------|-------|
| D1 | L1 | Razorpay branding images | Razorpay Dashboard |

---

## Verification Checklist

### After Phase A (Critical)
- [ ] `docker run ... -v /tmp/test:/thesis:rw --read-only apollo-latex` succeeds on VPS
- [ ] Inngest Dashboard shows function runs for `thesis/section.generate`
- [ ] New project --> S5 --> "Continue to Workspace" button navigates to `/projects/[id]`
- [ ] SSUHS displays as "Srimanta Sankaradeva University of Health Sciences" in S1 and title page

### After Phase B (High)
- [ ] Subscription plan buttons show "Coming Soon" or Razorpay checkout completes
- [ ] Licence banner shows from P2 (Introduction) onwards, not P1
- [ ] No Clerk ERR_INTERNET_DISCONNECTED errors in console

### After Phase C (UX)
- [ ] Hero section axes are dark grey
- [ ] Synopsis parse extracts candidate/guide/co-guide/institute/university
- [ ] S3 shows all 7 new editable fields
- [ ] S4 is pre-filled from S3 parsed data
- [ ] Session field validates YYYY-YYYY format
- [ ] "Year" label shows "Submission Month & Year"
- [ ] Co-guide appears on compiled title page and certificate
- [ ] `npx tsc --noEmit` --- 0 errors
- [ ] `npx next lint` --- 0 new warnings

### After Phase D (External)
- [ ] Razorpay payment page shows production logo, no localhost errors
