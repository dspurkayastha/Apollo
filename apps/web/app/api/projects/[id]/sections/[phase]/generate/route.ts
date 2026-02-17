import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  badRequest,
  internalError,
  rateLimited,
  conflict,
} from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isValidPhase } from "@/lib/phases/transitions";
import { getPhase } from "@/lib/phases/constants";
import { getAnthropicClient } from "@/lib/ai/client";
import { redactPII } from "@/lib/ai/redact";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import {
  SYNOPSIS_PARSE_SYSTEM_PROMPT,
  getPhaseSystemPrompt,
  getPhaseUserMessage,
} from "@/lib/ai/prompts";
import { parseSynopsisResponse } from "@/lib/ai/parse-synopsis-response";
import { latexToTiptap } from "@/lib/latex/latex-to-tiptap";
import { resolveSectionCitations, type CitationResolutionSummary } from "@/lib/citations/auto-resolve";
import { preSeedReferences, formatReferencesForPrompt } from "@/lib/citations/pre-seed";
import { checkTokenBudget, recordTokenUsage } from "@/lib/ai/token-budget";
import type { Project } from "@/lib/types/database";

// Sections stuck in "generating" for longer than this are considered stale
const STALE_GENERATING_MS = 2 * 60 * 1000; // 2 minutes

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; phase: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id, phase } = await params;
    const phaseNumber = parseInt(phase, 10);

    if (!isValidPhase(phaseNumber)) {
      return badRequest("Invalid phase number");
    }

    // Rate limit check
    const rateCheck = checkRateLimit(authResult.user.id);
    if (!rateCheck.allowed) {
      return rateLimited(rateCheck.retryAfterSeconds);
    }

    const supabase = createAdminSupabaseClient();

    // Fetch project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (projectError || !project) {
      return notFound("Project not found");
    }

    const typedProject = project as Project;

    // Phase 0: Synopsis parsing (special handling)
    if (phaseNumber === 0) {
      return handlePhase0Generate(request, typedProject, supabase);
    }

    // Phases 1-8: General thesis section generation
    const systemPrompt = getPhaseSystemPrompt(phaseNumber);
    if (!systemPrompt) {
      return badRequest(`AI generation for Phase ${phaseNumber} is not yet supported`);
    }

    return handleSectionGenerate(phaseNumber, typedProject, supabase);
  } catch (err) {
    console.error("Unexpected error in POST generate:", err);
    return internalError();
  }
}

/**
 * Check if a "generating" section is stale (stuck for > 5 minutes).
 * If stale, reset to "draft" so re-generation can proceed.
 */
async function checkAndResetStaleGeneration(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  projectId: string,
  phaseNumber: number
): Promise<boolean> {
  const { data: existingSection } = await supabase
    .from("sections")
    .select("status, updated_at")
    .eq("project_id", projectId)
    .eq("phase_number", phaseNumber)
    .single();

  if (existingSection?.status !== "generating") {
    return false; // Not generating, no conflict
  }

  // Check if the generation is stale
  const updatedAt = new Date(existingSection.updated_at).getTime();
  const isStale = Date.now() - updatedAt > STALE_GENERATING_MS;

  if (isStale) {
    console.warn(
      `Resetting stale "generating" section: project=${projectId} phase=${phaseNumber} (stuck since ${existingSection.updated_at})`
    );
    await supabase
      .from("sections")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("phase_number", phaseNumber);
    return false; // Reset done, no conflict
  }

  return true; // Still actively generating
}

/**
 * Create a cancel handler that resets section status when the client disconnects.
 */
function makeStreamCancelHandler(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  projectId: string,
  phaseNumber: number
) {
  return async () => {
    console.warn(
      `SSE stream cancelled (client disconnect): project=${projectId} phase=${phaseNumber} — resetting to draft`
    );
    await supabase
      .from("sections")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("phase_number", phaseNumber);
  };
}

/**
 * Generic handler for phases 1-8: generates thesis section content via SSE streaming.
 */
async function handleSectionGenerate(
  phaseNumber: number,
  project: Project,
  supabase: ReturnType<typeof createAdminSupabaseClient>
) {
  if (!project.synopsis_text) {
    return badRequest("Project has no synopsis text — upload a synopsis first");
  }

  // Check section isn't already generating (with stale detection)
  const isActivelyGenerating = await checkAndResetStaleGeneration(
    supabase,
    project.id,
    phaseNumber
  );

  if (isActivelyGenerating) {
    return conflict("Generation already in progress for this section");
  }

  // Token budget check — hard-stop if budget exhausted
  const budgetCheck = await checkTokenBudget(project.id, phaseNumber);
  if (!budgetCheck.allowed) {
    return badRequest(budgetCheck.reason ?? "Token budget exhausted");
  }

  // Gather context from previously completed sections
  const { data: approvedSections } = await supabase
    .from("sections")
    .select("phase_number, phase_name, latex_content")
    .eq("project_id", project.id)
    .eq("status", "approved")
    .order("phase_number", { ascending: true });

  const previousSections = (approvedSections ?? [])
    .filter((s) => s.phase_number < phaseNumber && s.latex_content)
    .map((s) => ({
      phaseName: s.phase_name as string,
      content: s.latex_content as string,
    }));

  // Redact PII from synopsis
  const { redacted: redactedSynopsis } = redactPII(project.synopsis_text);

  // Get prompts
  const systemPrompt = getPhaseSystemPrompt(phaseNumber)!;
  let userMessage = getPhaseUserMessage(
    phaseNumber,
    redactedSynopsis,
    (project.metadata_json ?? {}) as Record<string, unknown>,
    previousSections
  );

  // Phase 6 (Results): gather analysis context — summaries, tables, figures
  if (phaseNumber === 6) {
    const { data: completedAnalyses } = await supabase
      .from("analyses")
      .select("analysis_type, results_json, r_script")
      .eq("project_id", project.id)
      .eq("status", "completed")
      .order("created_at", { ascending: true });

    const { data: projectFigures } = await supabase
      .from("figures")
      .select("figure_type, label, caption, file_url")
      .eq("project_id", project.id)
      .order("created_at", { ascending: true });

    let analysisContext = "\n\n--- COMPLETED ANALYSES ---\n";

    for (const analysis of completedAnalyses ?? []) {
      const results = analysis.results_json as Record<string, unknown>;
      analysisContext += `\nAnalysis: ${analysis.analysis_type}\n`;
      if (results.summary) {
        analysisContext += `Summary: ${JSON.stringify(results.summary, null, 2)}\n`;
      }
      if (results.table_latex) {
        analysisContext += `LaTeX Table (include VERBATIM):\n${results.table_latex}\n`;
      }
    }

    if ((projectFigures ?? []).length > 0) {
      analysisContext += "\n--- FIGURES ---\n";
      for (const fig of projectFigures ?? []) {
        analysisContext += `Figure: \\label{${fig.label}} — ${fig.caption} (\\includegraphics{${fig.file_url}})\n`;
      }
    }

    userMessage += analysisContext;
  }

  // Pre-seed real PubMed references for citation-heavy phases
  const CITATION_HEAVY_PHASES = new Set([2, 4, 5, 7]);
  if (CITATION_HEAVY_PHASES.has(phaseNumber)) {
    try {
      const metadata = (project.metadata_json ?? {}) as Record<string, unknown>;
      const keywords = (metadata.keywords as string[]) ?? [];
      const studyType = (metadata.study_type as string) ?? null;
      const department = (metadata.department as string) ?? null;
      const maxRefs = phaseNumber === 4 ? 30 : 20; // ROL needs more references

      const preSeeded = await preSeedReferences(
        project.title ?? "",
        keywords,
        studyType,
        department,
        maxRefs
      );

      if (preSeeded.length > 0) {
        userMessage += formatReferencesForPrompt(preSeeded);
      }
    } catch (err) {
      console.warn("Pre-seed references failed (non-blocking):", err);
    }
  }

  // Create/update section as "generating"
  const phaseDef = getPhase(phaseNumber);
  await supabase.from("sections").upsert(
    {
      project_id: project.id,
      phase_number: phaseNumber,
      phase_name: phaseDef?.name ?? `phase_${phaseNumber}`,
      latex_content: "",
      word_count: 0,
      citation_keys: [],
      status: "generating",
    },
    { onConflict: "project_id,phase_number" }
  );

  // Model routing: Opus for Introduction/Discussion, Sonnet for others
  // (Haiku used separately for QC/review — see review route)
  const model = [2, 7].includes(phaseNumber)
    ? "claude-sonnet-4-5-20250929" // TODO: Switch to Opus when API access available
    : "claude-sonnet-4-5-20250929";
  // ROL needs most tokens; citation-heavy phases need extra for BibTeX trailer
  const maxTokens = phaseNumber === 4 ? 12000 : [2, 5, 7].includes(phaseNumber) ? 8000 : 6000;

  // Track whether the stream completed normally
  let streamCompleted = false;

  // Stream response via SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const client = getAnthropicClient();
        let fullResponse = "";

        const finalMessage = await Sentry.startSpan(
          {
            name: "claude.generate",
            op: "ai.generate",
            attributes: {
              "ai.model": model,
              "ai.phase": phaseNumber,
              "ai.max_tokens": maxTokens,
              "project.id": project.id,
            },
          },
          async () => {
            const messageStream = client.messages.stream({
              model,
              max_tokens: maxTokens,
              // Prompt caching: system prompt (GOLD Standard rules + phase instructions)
              // is stable across turns → cache for 60-70% token savings
              system: [
                {
                  type: "text" as const,
                  text: systemPrompt,
                  cache_control: { type: "ephemeral" as const },
                },
              ],
              messages: [
                { role: "user", content: userMessage },
              ],
            });

            messageStream.on("text", (text) => {
              fullResponse += text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "delta", text })}\n\n`)
              );
            });

            return messageStream.finalMessage();
          }
        );

        // Record token usage for budget tracking
        const totalTokens =
          (finalMessage.usage?.input_tokens ?? 0) +
          (finalMessage.usage?.output_tokens ?? 0);
        void recordTokenUsage(
          project.id,
          phaseNumber,
          totalTokens,
          model
        ).catch((err) =>
          console.error("Failed to record token usage:", err)
        );

        // Convert LaTeX → Tiptap JSON for rich text editor
        const tiptapResult = latexToTiptap(fullResponse);
        const citationKeys = tiptapResult.citationKeys;

        if (tiptapResult.warnings.length > 0) {
          console.warn(
            `LaTeX→Tiptap parse warnings (phase ${phaseNumber}):`,
            tiptapResult.warnings,
          );
        }

        // Count words (rough: strip LaTeX commands)
        const plainText = fullResponse
          .replace(/\\[a-zA-Z]+\{[^}]*\}/g, " ")
          .replace(/\\[a-zA-Z]+/g, " ")
          .replace(/[{}\\]/g, " ");
        const wordCount = plainText.split(/\s+/).filter(Boolean).length;

        // Update section with generated content + rich text JSON
        const { error: updateError } = await supabase
          .from("sections")
          .update({
            latex_content: fullResponse,
            rich_content_json: tiptapResult.json,
            ai_generated_latex: fullResponse,
            word_count: wordCount,
            citation_keys: citationKeys,
            status: "review",
            updated_at: new Date().toISOString(),
          })
          .eq("project_id", project.id)
          .eq("phase_number", phaseNumber);

        // Fallback: if update failed (e.g. ai_generated_latex column missing),
        // retry without ai_generated_latex but keep rich_content_json
        if (updateError) {
          console.warn(
            `Section update failed (phase ${phaseNumber}), retrying without ai_generated_latex:`,
            updateError.message,
          );
          const { error: fallback1Error } = await supabase
            .from("sections")
            .update({
              latex_content: fullResponse,
              rich_content_json: tiptapResult.json,
              word_count: wordCount,
              citation_keys: citationKeys,
              status: "review",
              updated_at: new Date().toISOString(),
            })
            .eq("project_id", project.id)
            .eq("phase_number", phaseNumber);

          // If that also fails (rich_content_json missing too), try core-only
          if (fallback1Error) {
            console.warn(
              `Section fallback also failed (phase ${phaseNumber}), retrying core-only:`,
              fallback1Error.message,
            );
            const { error: fallback2Error } = await supabase
              .from("sections")
              .update({
                latex_content: fullResponse,
                word_count: wordCount,
                citation_keys: citationKeys,
                status: "review",
                updated_at: new Date().toISOString(),
              })
              .eq("project_id", project.id)
              .eq("phase_number", phaseNumber);

            if (fallback2Error) {
              console.error(
                `Section core-only update also failed (phase ${phaseNumber}):`,
                fallback2Error.message,
              );
            }
          }
        }

        streamCompleted = true;

        // Resolve citations from BibTeX trailer (15-second timeout)
        let citationSummary: CitationResolutionSummary | null = null;
        try {
          citationSummary = await Promise.race([
            resolveSectionCitations(project.id, fullResponse),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 15_000)),
          ]);
        } catch (err) {
          console.error("Citation resolution failed:", err);
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "complete",
              wordCount,
              citationKeys,
              parseWarnings: tiptapResult.warnings,
              citationSummary,
            })}\n\n`
          )
        );

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        // Reset section status on error
        await supabase
          .from("sections")
          .update({ status: "draft", updated_at: new Date().toISOString() })
          .eq("project_id", project.id)
          .eq("phase_number", phaseNumber);

        streamCompleted = true; // Error handled, don't reset again in cancel

        const errorMessage =
          err instanceof Error ? err.message : "AI generation failed";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message: errorMessage })}\n\n`
          )
        );
        controller.close();
      }
    },
    cancel: async () => {
      // Client disconnected before stream completed — reset section status
      if (!streamCompleted) {
        await makeStreamCancelHandler(supabase, project.id, phaseNumber)();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * Phase 0: Synopsis parsing (returns structured JSON, not LaTeX).
 */
async function handlePhase0Generate(
  _request: NextRequest,
  project: Project,
  supabase: ReturnType<typeof createAdminSupabaseClient>
) {
  if (!project.synopsis_text) {
    return badRequest("Project has no synopsis text — upload a synopsis first");
  }

  // Check section isn't already generating (with stale detection)
  const isActivelyGenerating = await checkAndResetStaleGeneration(
    supabase,
    project.id,
    0
  );

  if (isActivelyGenerating) {
    return conflict("Generation already in progress for this section");
  }

  // Redact PII before sending to AI
  const { redacted: redactedSynopsis } = redactPII(project.synopsis_text);

  // Create/update section as "generating"
  const phaseDef = getPhase(0);
  await supabase.from("sections").upsert(
    {
      project_id: project.id,
      phase_number: 0,
      phase_name: phaseDef?.name ?? "orientation",
      latex_content: "",
      word_count: 0,
      citation_keys: [],
      status: "generating",
    },
    { onConflict: "project_id,phase_number" }
  );

  let streamCompleted = false;

  // Stream response via SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const client = getAnthropicClient();
        let fullResponse = "";

        const messageStream = client.messages.stream({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 2000,
          system: SYNOPSIS_PARSE_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `Parse the following medical thesis synopsis and extract structured metadata as JSON:\n\n${redactedSynopsis}`,
            },
          ],
        });

        messageStream.on("text", (text) => {
          fullResponse += text;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "delta", text })}\n\n`)
          );
        });

        await messageStream.finalMessage();

        // Parse the complete response
        const parsed = parseSynopsisResponse(fullResponse);

        if (parsed) {
          // Update project metadata with extracted data
          const metadataUpdate: Record<string, unknown> = {
            ...project.metadata_json,
          };
          if (parsed.department) metadataUpdate.department = parsed.department;

          const projectUpdate: Record<string, unknown> = {
            metadata_json: metadataUpdate,
            updated_at: new Date().toISOString(),
          };
          if (parsed.title && !project.title) {
            projectUpdate.title = parsed.title;
          }
          if (parsed.study_type) {
            projectUpdate.study_type = parsed.study_type;
          }

          await supabase
            .from("projects")
            .update(projectUpdate)
            .eq("id", project.id);

          // Update section with parsed content and set to review
          await supabase
            .from("sections")
            .update({
              latex_content: fullResponse,
              status: "review",
              updated_at: new Date().toISOString(),
            })
            .eq("project_id", project.id)
            .eq("phase_number", 0);

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "complete", parsed })}\n\n`
            )
          );
        } else {
          // Parsing failed — still save raw content
          await supabase
            .from("sections")
            .update({
              latex_content: fullResponse,
              status: "review",
              updated_at: new Date().toISOString(),
            })
            .eq("project_id", project.id)
            .eq("phase_number", 0);

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "complete", parsed: null, raw: fullResponse })}\n\n`
            )
          );
        }

        streamCompleted = true;

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        // Reset section status on error
        await supabase
          .from("sections")
          .update({ status: "draft", updated_at: new Date().toISOString() })
          .eq("project_id", project.id)
          .eq("phase_number", 0);

        streamCompleted = true;

        const errorMessage =
          err instanceof Error ? err.message : "AI generation failed";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message: errorMessage })}\n\n`
          )
        );
        controller.close();
      }
    },
    cancel: async () => {
      if (!streamCompleted) {
        await makeStreamCancelHandler(supabase, project.id, 0)();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
