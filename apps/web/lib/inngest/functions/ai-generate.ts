/**
 * Inngest background function for AI thesis section generation.
 *
 * Replaces SSE streaming: generation runs as a durable background job.
 * If the student stays on the page, they see live text via Supabase Realtime.
 * If they close the tab, generation continues to completion.
 */

import { inngest } from "../client";
import { getAnthropicClient } from "@/lib/ai/client";
import { extractCiteKeys } from "@/lib/citations/extract-keys";
import { resolveSectionCitations } from "@/lib/citations/auto-resolve";
import { recordTokenUsage } from "@/lib/ai/token-budget";
import { checkBibtexIntegrity, requestMissingBibtexEntries } from "@/lib/ai/bibtex-completion";
import { splitBibtex } from "@/lib/latex/assemble";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const aiGenerateFn = inngest.createFunction(
  {
    id: "ai-generate-section",
    retries: 1,
    concurrency: [{ limit: 5 }],
  },
  { event: "thesis/section.generate" },
  async ({ event, step }) => {
    const {
      projectId,
      phaseNumber,
      systemPrompt,
      userMessage,
      model,
      maxTokens,
    } = event.data as {
      projectId: string;
      phaseNumber: number;
      systemPrompt: string;
      userMessage: string;
      model: string;
      maxTokens: number;
    };

    const supabase = createAdminSupabaseClient();

    // Step 1: Stream AI response, writing chunks to streaming_content
    const result = await step.run("stream-ai-response", async () => {
      const client = getAnthropicClient();
      let fullResponse = "";

      const messageStream = client.messages.stream({
        model,
        max_tokens: maxTokens,
        system: [
          {
            type: "text" as const,
            text: systemPrompt,
            cache_control: { type: "ephemeral" as const },
          },
        ],
        messages: [{ role: "user", content: userMessage }],
      });

      // Batch Realtime updates every ~500 chars to avoid excessive DB writes
      let lastFlushed = 0;
      const FLUSH_INTERVAL = 500;

      messageStream.on("text", (text) => {
        fullResponse += text;
        if (fullResponse.length - lastFlushed >= FLUSH_INTERVAL) {
          // Fire-and-forget partial update for Realtime subscribers
          void supabase
            .from("sections")
            .update({ streaming_content: fullResponse })
            .eq("project_id", projectId)
            .eq("phase_number", phaseNumber)
            .then(() => {});
          lastFlushed = fullResponse.length;
        }
      });

      const finalMessage = await messageStream.finalMessage();

      return {
        fullResponse,
        inputTokens: finalMessage.usage?.input_tokens ?? 0,
        outputTokens: finalMessage.usage?.output_tokens ?? 0,
      };
    });

    // Step 2: BibTeX integrity check + completion
    const finalContent = await step.run("bibtex-integrity", async () => {
      let response = result.fullResponse;
      const integrity = checkBibtexIntegrity(response);

      if (!integrity.complete && integrity.missingKeys.length > 0) {
        console.warn(
          `BibTeX trailer incomplete: ${integrity.missingKeys.length} missing entries. Requesting...`
        );
        try {
          const missingBibtex = await requestMissingBibtexEntries(
            integrity.missingKeys,
            splitBibtex(response).body,
            model,
          );
          if (missingBibtex.trim()) {
            const { body, bib } = splitBibtex(response);
            response = bib.trim()
              ? `${body}\n\n---BIBTEX---\n${bib}\n\n${missingBibtex}`
              : `${body}\n\n---BIBTEX---\n${missingBibtex}`;
          }
        } catch (err) {
          console.error("Failed to request missing BibTeX entries:", err);
        }
      }

      return response;
    });

    // Step 3: Save final content
    await step.run("save-content", async () => {
      const citationKeys = extractCiteKeys(finalContent);
      const plainText = finalContent
        .replace(/\\[a-zA-Z]+\{[^}]*\}/g, " ")
        .replace(/\\[a-zA-Z]+/g, " ")
        .replace(/[{}\\]/g, " ");
      const wordCount = plainText.split(/\s+/).filter(Boolean).length;

      await supabase
        .from("sections")
        .update({
          latex_content: finalContent,
          ai_generated_latex: finalContent,
          rich_content_json: null,
          streaming_content: "",
          word_count: wordCount,
          citation_keys: citationKeys,
          status: "review",
          updated_at: new Date().toISOString(),
        })
        .eq("project_id", projectId)
        .eq("phase_number", phaseNumber);
    });

    // Step 4: Record token usage
    await step.run("record-tokens", async () => {
      await recordTokenUsage(
        projectId,
        phaseNumber,
        result.inputTokens,
        result.outputTokens,
        model,
      );
    });

    // Step 5: Resolve citations (non-blocking)
    await step.run("resolve-citations", async () => {
      const timeoutMs = phaseNumber === 4 ? 45_000 : 15_000;
      try {
        await Promise.race([
          resolveSectionCitations(projectId, finalContent),
          new Promise<null>((r) => setTimeout(() => r(null), timeoutMs)),
        ]);
      } catch (err) {
        console.error("Citation resolution failed:", err);
      }
    });

    return { success: true };
  },
);
