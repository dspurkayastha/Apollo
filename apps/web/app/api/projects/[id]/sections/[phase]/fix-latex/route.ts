import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  badRequest,
  internalError,
  rateLimited,
} from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isValidPhase } from "@/lib/phases/transitions";
import { getAnthropicClient } from "@/lib/ai/client";
import { extractCiteKeys } from "@/lib/citations/extract-keys";
import { sanitiseLatexOutput } from "@/lib/ai/sanitise-latex";
import { checkTokenBudget, recordTokenUsage } from "@/lib/ai/token-budget";
import { checkLicenceForPhase } from "@/lib/api/licence-phase-gate";
import { parseLatexLog } from "@/lib/latex/parse-log";
import { PHASE_CHAPTER_MAP, splitBibtex } from "@/lib/latex/assemble";
import {
  extractErrorContexts,
  buildTargetedUserMessage,
  parseFixResponse,
  applyLineFixes,
} from "@/lib/latex/fix-latex-helpers";
import type { Section } from "@/lib/types/database";

// ── System prompts ──────────────────────────────────────────────────────────

const TARGETED_SYSTEM_PROMPT = `You are a LaTeX syntax repair tool. Return ONLY the fixed lines.

OUTPUT FORMAT — one line per fix:
NN| fixed line content

Where NN is the original line number. Only include lines you changed.
If no changes are needed, respond with exactly: NO_CHANGES_NEEDED

COMMON FIXES:
- Bare subscripts/superscripts outside math mode: wrap in $...$ (e.g., x_1 → $x_1$, p<0.05 → $p<0.05$)
- Double subscript errors: use braces (e.g., $x_a_b$ → $x_{a_b}$)
- Unmatched braces: add missing { or }
- Bare & outside tabular: escape as \\&
- Bare # outside macro definition: escape as \\#
- Bare % not intended as comment: escape as \\%
- Unicode characters: replace with LaTeX equivalents (— → ---, " " → \`\` '', é → \\'e)
- Missing $ inserted: find mathematical expressions and wrap in $...$
- Undefined control sequence: fix typos in command names or remove unknown commands

RULES:
1. Fix ONLY the syntax errors described in the error messages.
2. Do NOT change any academic content, wording, or meaning.
3. Do NOT add or remove sentences.
4. Return ONLY changed lines in the NN| format. Nothing else.`;

const FALLBACK_SYSTEM_PROMPT = `You are a LaTeX syntax repair tool. Your ONLY job is to fix LaTeX compilation errors.

RULES:
1. Fix ONLY the syntax errors described in the error messages.
2. Do NOT change any academic content, wording, sentence structure, or meaning.
3. Do NOT add, remove, or rephrase any sentences.
4. Do NOT change citation keys or bibliography entries.
5. Return the COMPLETE fixed chapter — not just the changed parts.
6. Preserve the ---BIBTEX--- separator and all BibTeX entries exactly as they are.

COMMON FIXES:
- Bare subscripts/superscripts outside math mode: wrap in $...$ (e.g., x_1 → $x_1$, p<0.05 → $p<0.05$)
- Double subscript errors: use braces (e.g., $x_a_b$ → $x_{a_b}$)
- Unmatched braces: add missing { or }
- Bare & outside tabular: escape as \\&
- Bare # outside macro definition: escape as \\#
- Bare % not intended as comment: escape as \\%
- Unicode characters: replace with LaTeX equivalents (— → ---, " " → \`\` '', é → \\'e)
- Missing $ inserted: find mathematical expressions and wrap in $...$
- Undefined control sequence: fix typos in command names or remove unknown commands

IMPORTANT: Only fix what the error messages point to. Do not "improve" anything else.`;

// ── Phases that inject into main.tex — line numbers don't map to section content
const NON_CHAPTER_PHASES = new Set([0, 1, 9, 10, 11]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; phase: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const rateCheck = await checkRateLimit(authResult.user.id);
    if (!rateCheck.allowed) {
      return rateLimited(rateCheck.retryAfterSeconds);
    }

    const { id, phase } = await params;
    const phaseNumber = parseInt(phase, 10);

    if (!isValidPhase(phaseNumber)) {
      return badRequest("Invalid phase number");
    }

    const body = await request.json();
    const errors = (body as { errors?: string }).errors;
    if (!errors || typeof errors !== "string" || errors.trim().length === 0) {
      return badRequest("Compile errors are required");
    }

    // Licence phase gate (uses "refine" operation — same tier)
    const gateResult = await checkLicenceForPhase(id, authResult.user.id, phaseNumber, "refine");
    if (gateResult instanceof NextResponse) return gateResult;

    const supabase = createAdminSupabaseClient();

    // Fetch current section content
    const { data: section, error: sectionError } = await supabase
      .from("sections")
      .select("*")
      .eq("project_id", id)
      .eq("phase_number", phaseNumber)
      .single();

    if (sectionError || !section) {
      return notFound("Section not found — generate content first");
    }

    const typedSection = section as Section;
    const currentLatex =
      typedSection.ai_generated_latex || typedSection.latex_content;

    if (!currentLatex) {
      return badRequest("Section has no content to fix — generate first");
    }

    // Token budget check
    const budgetCheck = await checkTokenBudget(id, phaseNumber);
    if (!budgetCheck.allowed) {
      return badRequest(budgetCheck.reason ?? "Token budget exhausted");
    }

    // ── Try targeted fix path ───────────────────────────────────────────────
    const targetedResult = await tryTargetedFix(
      supabase,
      id,
      phaseNumber,
      currentLatex
    );

    let fixedLatex: string;

    if (targetedResult) {
      fixedLatex = targetedResult.fixedLatex;
      void recordTokenUsage(
        id, phaseNumber,
        targetedResult.inputTokens, targetedResult.outputTokens,
        "claude-haiku-4-5-20251001"
      ).catch(console.error);
    } else {
      // ── Fallback: full-document approach ──────────────────────────────────
      const fallbackResult = await fullDocumentFix(currentLatex, errors);
      fixedLatex = fallbackResult.fixedLatex;
      void recordTokenUsage(
        id, phaseNumber,
        fallbackResult.inputTokens, fallbackResult.outputTokens,
        "claude-haiku-4-5-20251001"
      ).catch(console.error);
    }

    // Extract citation keys
    const citationKeys = extractCiteKeys(fixedLatex);

    // Word count — exclude BibTeX trailer
    const bibSepIdx = fixedLatex.indexOf("---BIBTEX---");
    const bodyForCount = bibSepIdx >= 0 ? fixedLatex.slice(0, bibSepIdx) : fixedLatex;
    const plainText = bodyForCount
      .replace(/\\[a-zA-Z]+\{[^}]*\}/g, " ")
      .replace(/\\[a-zA-Z]+/g, " ")
      .replace(/[{}\\]/g, " ");
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;

    // Save to both columns — does NOT change section status
    const { error: updateError } = await supabase
      .from("sections")
      .update({
        latex_content: fixedLatex,
        rich_content_json: null,
        ai_generated_latex: fixedLatex,
        word_count: wordCount,
        citation_keys: citationKeys,
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", id)
      .eq("phase_number", phaseNumber);

    if (updateError) {
      // Fallback: try without ai_generated_latex
      await supabase
        .from("sections")
        .update({
          latex_content: fixedLatex,
          word_count: wordCount,
          citation_keys: citationKeys,
          updated_at: new Date().toISOString(),
        })
        .eq("project_id", id)
        .eq("phase_number", phaseNumber);
    }

    return NextResponse.json({
      data: {
        fixed: true,
        wordCount,
        citationKeys,
        targeted: !!targetedResult,
      },
    });
  } catch (err) {
    console.error(
      "Unexpected error in POST /api/projects/[id]/sections/[phase]/fix-latex:",
      err
    );
    return internalError();
  }
}

// ── Targeted fix: snippet-based ─────────────────────────────────────────────

interface FixResult {
  fixedLatex: string;
  inputTokens: number;
  outputTokens: number;
}

async function tryTargetedFix(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  projectId: string,
  phaseNumber: number,
  currentLatex: string
): Promise<FixResult | null> {
  // Non-chapter phases always use fallback
  if (NON_CHAPTER_PHASES.has(phaseNumber)) return null;

  // Get the chapter file for this phase
  const chapterFile = PHASE_CHAPTER_MAP[phaseNumber];
  if (!chapterFile) return null;

  // Fetch latest failed compilation's log_text
  const { data: compilation } = await supabase
    .from("compilations")
    .select("log_text")
    .eq("project_id", projectId)
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const logText = (compilation?.log_text as string) ?? null;
  if (!logText) return null;

  // Parse structured errors
  const parsed = parseLatexLog(logText);
  if (parsed.structuredErrors.length === 0) return null;

  // Filter errors relevant to this phase's chapter file
  const relevantErrors = parsed.structuredErrors.filter((e) => {
    if (!e.line) return false;
    // Include errors from this chapter's file
    if (e.file && e.file === chapterFile) return true;
    // Include errors with no file attribution (may be from this chapter)
    if (!e.file) return true;
    return false;
  });

  // Must have at least one error with a line number
  const errorsWithLines = relevantErrors.filter((e) => e.line !== undefined);
  if (errorsWithLines.length === 0) return null;

  // Extract the chapter body (before ---BIBTEX--- separator)
  const { body } = splitBibtex(currentLatex);
  if (!body.trim()) return null;

  // Extract context windows around each error
  const contexts = extractErrorContexts(body, errorsWithLines);
  if (contexts.length === 0) return null;

  // Build the focused prompt
  const userMessage = buildTargetedUserMessage(contexts, errorsWithLines);

  // Call AI with focused prompt
  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: [
      {
        type: "text" as const,
        text: TARGETED_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const inputTokens = message.usage?.input_tokens ?? 0;
  const outputTokens = message.usage?.output_tokens ?? 0;

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  const rawResponse = textBlock.text;
  if (!rawResponse.trim()) return null;

  // Parse the response as line fixes
  const fixes = parseFixResponse(rawResponse);
  if (fixes === null) return null; // Unparseable → fallback

  if (fixes.length === 0) {
    // AI says no changes needed — return content as-is
    return { fixedLatex: currentLatex, inputTokens, outputTokens };
  }

  // Apply line fixes to the body only
  const fixedBody = applyLineFixes(body, fixes);

  // Reconstruct full content with BibTeX trailer
  const bibSepIdx = currentLatex.indexOf("---BIBTEX---");
  const fixedLatex =
    bibSepIdx >= 0
      ? fixedBody + "\n" + currentLatex.slice(bibSepIdx)
      : fixedBody;

  return { fixedLatex, inputTokens, outputTokens };
}

// ── Fallback: full-document approach ────────────────────────────────────────

async function fullDocumentFix(
  currentLatex: string,
  errors: string
): Promise<FixResult> {
  const client = getAnthropicClient();
  const userMessage = `Here is the LaTeX source that failed to compile:\n\n${currentLatex}\n\n---COMPILE ERRORS---\n${errors.trim()}`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 16000,
    system: [
      {
        type: "text" as const,
        text: FALLBACK_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const inputTokens = message.usage?.input_tokens ?? 0;
  const outputTokens = message.usage?.output_tokens ?? 0;

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AI returned no text response");
  }

  const rawResponse = textBlock.text;
  if (!rawResponse.trim()) {
    throw new Error("AI returned empty response");
  }

  return {
    fixedLatex: sanitiseLatexOutput(rawResponse),
    inputTokens,
    outputTokens,
  };
}
