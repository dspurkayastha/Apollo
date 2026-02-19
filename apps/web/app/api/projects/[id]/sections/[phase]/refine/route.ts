import { NextRequest } from "next/server";
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
import { REFINE_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { extractCiteKeys } from "@/lib/citations/extract-keys";
import { resolveSectionCitations } from "@/lib/citations/auto-resolve";
import { checkTokenBudget, recordTokenUsage } from "@/lib/ai/token-budget";
import { checkLicenceForPhase } from "@/lib/api/licence-phase-gate";
import type { Section } from "@/lib/types/database";
import { NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; phase: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    // Rate limit check
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
    const instructions = (body as { instructions?: string }).instructions;
    if (!instructions || typeof instructions !== "string" || instructions.trim().length === 0) {
      return badRequest("Instructions are required");
    }

    // Licence phase gate
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
      return badRequest("Section has no content to refine --- generate first");
    }

    // Token budget check
    const budgetCheck = await checkTokenBudget(id, phaseNumber);
    if (!budgetCheck.allowed) {
      return badRequest(budgetCheck.reason ?? "Token budget exhausted");
    }

    // Don't change status to "generating" --- the client consumes the stream
    // and refreshes when done. Keeping current status avoids a broken UI state
    // if the page is refreshed mid-stream.
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const client = getAnthropicClient();
          let fullResponse = "";

          const userMessage = `Here is the current chapter content:\n\n${currentLatex}\n\n---STUDENT INSTRUCTIONS---\n${instructions.trim()}`;

          const messageStream = client.messages.stream({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 10000,
            system: [
              {
                type: "text" as const,
                text: REFINE_SYSTEM_PROMPT,
                cache_control: { type: "ephemeral" as const },
              },
            ],
            messages: [{ role: "user", content: userMessage }],
          });

          messageStream.on("text", (text) => {
            fullResponse += text;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "delta", text })}\n\n`
              )
            );
          });

          const finalMsg = await messageStream.finalMessage();

          // Record token usage
          const inputTokens = finalMsg.usage?.input_tokens ?? 0;
          const outputTokens = finalMsg.usage?.output_tokens ?? 0;
          void recordTokenUsage(id, phaseNumber, inputTokens, outputTokens, "claude-sonnet-4-5-20250929").catch(console.error);

          // Extract citation keys directly from LaTeX (no round-trip)
          const citationKeys = extractCiteKeys(fullResponse);

          // Word count
          const plainText = fullResponse
            .replace(/\\[a-zA-Z]+\{[^}]*\}/g, " ")
            .replace(/\\[a-zA-Z]+/g, " ")
            .replace(/[{}\\]/g, " ");
          const wordCount = plainText.split(/\s+/).filter(Boolean).length;

          // If section was previously approved, roll back phases_completed
          if (typedSection.status === "approved") {
            const { data: proj } = await supabase
              .from("projects")
              .select("phases_completed, current_phase")
              .eq("id", id)
              .single();

            if (proj) {
              const updatedPhases = ((proj.phases_completed ?? []) as number[]).filter(
                (p) => p !== phaseNumber
              );
              await supabase
                .from("projects")
                .update({
                  phases_completed: updatedPhases,
                  current_phase: phaseNumber,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", id);
            }
          }

          // Update section (LaTeX is canonical --- no rich_content_json)
          const { error: updateError } = await supabase
            .from("sections")
            .update({
              latex_content: fullResponse,
              rich_content_json: null,
              ai_generated_latex: fullResponse,
              word_count: wordCount,
              citation_keys: citationKeys,
              status: "review",
              updated_at: new Date().toISOString(),
            })
            .eq("project_id", id)
            .eq("phase_number", phaseNumber);

          if (updateError) {
            await supabase
              .from("sections")
              .update({
                latex_content: fullResponse,
                rich_content_json: null,
                word_count: wordCount,
                citation_keys: citationKeys,
                status: "review",
                updated_at: new Date().toISOString(),
              })
              .eq("project_id", id)
              .eq("phase_number", phaseNumber);
          }


          // Resolve new citations (non-blocking with 10s timeout)
          let citationSummary = null;
          try {
            citationSummary = await Promise.race([
              resolveSectionCitations(id, fullResponse),
              new Promise<null>((resolve) =>
                setTimeout(() => resolve(null), 10_000)
              ),
            ]);
          } catch {
            // Non-critical
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "complete",
                wordCount,
                citationKeys,
                citationSummary,
              })}\n\n`
            )
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {

          const errorMessage =
            err instanceof Error ? err.message : "Refinement failed";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", message: errorMessage })}\n\n`
            )
          );
          controller.close();
        }
      },
      cancel: async () => {
        // No status reset needed — we never set "generating"
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error(
      "Unexpected error in POST /api/projects/[id]/sections/[phase]/refine:",
      err
    );
    return internalError();
  }
}
