import { NextRequest } from "next/server";
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
import { SYNOPSIS_PARSE_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { parseSynopsisResponse } from "@/lib/ai/parse-synopsis-response";
import type { Project } from "@/lib/types/database";

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

    // Phase 0: Synopsis parsing
    if (phaseNumber === 0) {
      return handlePhase0Generate(request, typedProject, supabase);
    }

    return badRequest(`AI generation for Phase ${phaseNumber} is not yet supported`);
  } catch (err) {
    console.error("Unexpected error in POST generate:", err);
    return internalError();
  }
}

async function handlePhase0Generate(
  _request: NextRequest,
  project: Project,
  supabase: ReturnType<typeof createAdminSupabaseClient>
) {
  if (!project.synopsis_text) {
    return badRequest("Project has no synopsis text — upload a synopsis first");
  }

  // Check section isn't already generating
  const { data: existingSection } = await supabase
    .from("sections")
    .select("status")
    .eq("project_id", project.id)
    .eq("phase_number", 0)
    .single();

  if (existingSection?.status === "generating") {
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

  // Stream response via SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const client = getAnthropicClient();
        let fullResponse = "";

        const messageStream = client.messages.stream({
          model: "claude-sonnet-4-5-20250514",
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

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        // Reset section status on error
        await supabase
          .from("sections")
          .update({ status: "draft", updated_at: new Date().toISOString() })
          .eq("project_id", project.id)
          .eq("phase_number", 0);

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
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
