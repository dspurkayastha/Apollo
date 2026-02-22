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
import type { Section } from "@/lib/types/database";

const FIX_LATEX_SYSTEM_PROMPT = `You are a LaTeX syntax repair tool. Your ONLY job is to fix LaTeX compilation errors.

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

    // Call Claude Haiku to fix LaTeX errors
    const client = getAnthropicClient();
    const userMessage = `Here is the LaTeX source that failed to compile:\n\n${currentLatex}\n\n---COMPILE ERRORS---\n${errors.trim()}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16000,
      system: [
        {
          type: "text" as const,
          text: FIX_LATEX_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" as const },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    // Record token usage
    const inputTokens = message.usage?.input_tokens ?? 0;
    const outputTokens = message.usage?.output_tokens ?? 0;
    void recordTokenUsage(id, phaseNumber, inputTokens, outputTokens, "claude-haiku-4-5-20251001").catch(console.error);

    // Extract text from response
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return internalError("AI returned no text response");
    }
    const rawResponse = textBlock.text;

    if (!rawResponse.trim()) {
      return internalError("AI returned empty response");
    }

    // Post-process AI output
    const fixedLatex = sanitiseLatexOutput(rawResponse);

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
