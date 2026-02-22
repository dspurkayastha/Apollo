/**
 * SSE endpoint for Phase 9 reference verification.
 *
 * Streams progress events as citations are verified one-by-one,
 * then returns the final QCReport on completion.
 *
 * Events:
 *   data: {"type":"progress","step":"...","current":3,"total":32}
 *   data: {"type":"complete","report":{...},"upgradedCount":4,"stillUnresolved":["..."]}
 *   data: {"type":"error","message":"..."}
 */

import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Citation } from "@/lib/types/database";
import { verifyAllCitations } from "@/lib/qc/checkpoint-references";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await getAuthenticatedUser();
  if (!authResult) {
    return new Response(JSON.stringify({ error: "Unauthorised" }), {
      status: 401,
    });
  }

  const { id } = await params;
  const supabase = createAdminSupabaseClient();

  // Verify ownership
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, user_id, current_phase, license_id")
    .eq("id", id)
    .eq("user_id", authResult.user.id)
    .single();

  if (projectError || !project) {
    return new Response(JSON.stringify({ error: "Project not found" }), {
      status: 404,
    });
  }

  if ((project.current_phase as number) !== 9) {
    return new Response(
      JSON.stringify({ error: "Project is not at Phase 9" }),
      { status: 400 },
    );
  }

  // Fetch all citations
  const { data: citations } = await supabase
    .from("citations")
    .select("*")
    .eq("project_id", id);

  const typedCitations = (citations ?? []) as Citation[];

  // Stream SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      }

      try {
        const result = await verifyAllCitations(
          typedCitations,
          (progress) => {
            send({
              type: "progress",
              step: progress.step,
              current: progress.current,
              total: progress.total,
            });
          },
        );

        // Persist upgraded citation tiers to DB
        if (result.upgradedEntries.length > 0) {
          for (const entry of result.upgradedEntries) {
            await supabase
              .from("citations")
              .update({
                provenance_tier: entry.newTier,
                bibtex_entry: entry.newBibtex,
                evidence_type: entry.evidenceType,
                evidence_value: entry.evidenceValue,
                verified_at: new Date().toISOString(),
              })
              .eq("project_id", id)
              .eq("cite_key", entry.citeKey);
          }
        }

        send({
          type: "complete",
          report: result.report,
          upgradedCount: result.upgradedCount,
          stillUnresolved: result.stillUnresolved,
        });
      } catch (err) {
        send({
          type: "error",
          message:
            err instanceof Error
              ? err.message
              : "Reference verification failed",
        });
      } finally {
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
