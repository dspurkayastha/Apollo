import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  badRequest,
  internalError,
  rateLimited,
  conflict,
} from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isValidPhase } from "@/lib/phases/transitions";
import { getPhase } from "@/lib/phases/constants";
import { getAnthropicClient } from "@/lib/ai/client";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import {
  SYNOPSIS_PARSE_SYSTEM_PROMPT,
  getPhaseSystemPrompt,
  getPhaseUserMessage,
} from "@/lib/ai/prompts";
import { parseSynopsisResponse } from "@/lib/ai/parse-synopsis-response";
import { preSeedReferences, formatReferencesForPrompt } from "@/lib/citations/pre-seed";
import { checkTokenBudget } from "@/lib/ai/token-budget";
import { checkLicenceForPhase, type LicenceGateResult } from "@/lib/api/licence-phase-gate";
import { inngest } from "@/lib/inngest/client";
import type { Project } from "@/lib/types/database";
import type { PlannedAnalysis } from "@/lib/validation/analysis-plan-schemas";

// Sections stuck in "generating" for longer than this are considered stale
const STALE_GENERATING_MS = 5 * 60 * 1000; // 5 minutes

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
    const rateCheck = await checkRateLimit(authResult.user.id);
    if (!rateCheck.allowed) {
      return rateLimited(rateCheck.retryAfterSeconds);
    }

    // Licence phase gate
    const gateResult = await checkLicenceForPhase(id, authResult.user.id, phaseNumber, "generate");
    if (gateResult instanceof NextResponse) return gateResult;

    const supabase = createAdminSupabaseClient();
    const typedProject = gateResult.project;

    // Phase 0: Synopsis parsing (special handling)
    if (phaseNumber === 0) {
      return handlePhase0Generate(request, typedProject, supabase);
    }

    // Phases 1-8: General thesis section generation
    const systemPrompt = getPhaseSystemPrompt(phaseNumber);
    if (!systemPrompt) {
      return badRequest(`AI generation for Phase ${phaseNumber} is not yet supported`);
    }

    return handleSectionGenerate(phaseNumber, typedProject, supabase, gateResult);
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
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  gateResult: LicenceGateResult,
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

  // Get prompts
  const systemPrompt = getPhaseSystemPrompt(phaseNumber)!;
  let userMessage = getPhaseUserMessage(
    phaseNumber,
    project.synopsis_text,
    (project.metadata_json ?? {}) as Record<string, unknown>,
    previousSections
  );

  // Phase 6 (Results): gate on 6a completion then gather analysis context
  if (phaseNumber === 6) {
    // Gate: Phase 6a must be complete (analysis plan approved)
    if (project.analysis_plan_status !== "approved") {
      return badRequest(
        "Complete Phase 6a first: upload a dataset, generate an analysis plan, and approve it."
      );
    }

    // Gate: All planned analyses must be completed
    const plan = (project.analysis_plan_json ?? []) as unknown as PlannedAnalysis[];
    const { data: planCheckAnalyses } = await supabase
      .from("analyses")
      .select("analysis_type, status")
      .eq("project_id", project.id)
      .eq("status", "completed");

    const completedTypes = new Set(
      (planCheckAnalyses ?? []).map((a) => a.analysis_type)
    );
    const unrunPlanned = plan.filter(
      (p) => p.status !== "skipped" && !completedTypes.has(p.analysis_type)
    );

    if (unrunPlanned.length > 0) {
      return badRequest(
        `${unrunPlanned.length} planned analyses not yet completed: ${unrunPlanned.map((p) => p.analysis_type).join(", ")}`
      );
    }
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
      streaming_content: "",
      word_count: 0,
      citation_keys: [],
      status: "generating",
    },
    { onConflict: "project_id,phase_number" }
  );

  // Model routing: Opus for Introduction/Discussion (Professional plan), Sonnet for others
  const useOpus = [2, 7].includes(phaseNumber) && gateResult.planConfig?.modelTier === "opus";
  const model = useOpus
    ? "claude-opus-4-5-20250514"
    : "claude-sonnet-4-5-20250929";
  // ROL needs most tokens; citation-heavy phases need extra for BibTeX trailer
  const maxTokens = phaseNumber === 4 ? 16000   // ROL: ~5K body + ~5K BibTeX (30+ refs)
    : phaseNumber === 7 ? 12000                  // Discussion: ~5K body + ~3K BibTeX (20 refs)
    : [2, 5].includes(phaseNumber) ? 10000       // Intro/M&M: ~3K body + ~2.5K BibTeX
    : 6000;                                      // Aims, Conclusion, others

  // Enqueue Inngest background job for AI generation
  await inngest.send({
    name: "thesis/section.generate",
    data: {
      projectId: project.id,
      phaseNumber,
      systemPrompt,
      userMessage,
      model,
      maxTokens,
    },
  });

  // Return immediately --- generation continues in background
  return NextResponse.json({
    data: { status: "generating", message: "Generation started" },
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
              content: `Parse the following medical thesis synopsis and extract structured metadata as JSON:\n\n${project.synopsis_text}`,
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
