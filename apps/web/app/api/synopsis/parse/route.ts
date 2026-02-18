import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, validationError, internalError, rateLimited } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { getAnthropicClient } from "@/lib/ai/client";
import { SYNOPSIS_PARSE_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { parseSynopsisResponse } from "@/lib/ai/parse-synopsis-response";
import { recordTokenUsage } from "@/lib/ai/token-budget";
import { z } from "zod";

const requestSchema = z.object({
  synopsis_text: z.string().min(20, "Synopsis must be at least 20 characters"),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    // Rate limit check
    const rateCheck = await checkRateLimit(authResult.user.id);
    if (!rateCheck.allowed) {
      return rateLimited(rateCheck.retryAfterSeconds);
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return validationError("Invalid request", {
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2000,
      system: SYNOPSIS_PARSE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Parse the following medical thesis synopsis and extract structured metadata as JSON:\n\n${parsed.data.synopsis_text}`,
        },
      ],
    });

    // Record token usage (Phase 0 — synopsis parsing)
    const inputTokens = message.usage?.input_tokens ?? 0;
    const outputTokens = message.usage?.output_tokens ?? 0;
    // No projectId available here (pre-project creation) — record under a generic key
    void recordTokenUsage("synopsis-parse", 0, inputTokens, outputTokens, "claude-sonnet-4-5-20250929").catch(console.error);

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return internalError("AI returned no text response");
    }

    // Use shared parser (handles code fences, string→number coercion, etc.)
    const data = parseSynopsisResponse(textBlock.text);

    if (!data) {
      return internalError("Failed to parse AI response as structured data");
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Synopsis AI parse error:", err);
    return internalError("Failed to parse synopsis");
  }
}
