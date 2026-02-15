import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, validationError, internalError } from "@/lib/api/errors";
import { getAnthropicClient } from "@/lib/ai/client";
import { redactPII } from "@/lib/ai/redact";
import { z } from "zod";

const requestSchema = z.object({
  synopsis_text: z.string().min(20, "Synopsis must be at least 20 characters"),
});

const SYNOPSIS_WIZARD_PROMPT = `You are a medical thesis assistant specialising in Indian postgraduate medical theses. You parse research synopses and extract structured metadata.

Given a synopsis text, extract the following fields as JSON:
- title: The thesis title (string or null)
- aims: An array of study aims (string[])
- objectives: An array of study objectives — primary and secondary (string[])
- study_type: The type of study, e.g. "Cross-Sectional Study", "Prospective Cohort Study", "Randomised Controlled Trial", "Case-Control Study", "Case Series", "Meta-Analysis" (string or null)
- study_design: More specific study design details if mentioned (string or null)
- sample_size: The planned sample size as a number (number or null)
- inclusion_criteria: An array of inclusion criteria (string[])
- exclusion_criteria: An array of exclusion criteria (string[])
- methodology_summary: A brief summary of the methodology in 2-3 sentences (string or null)

Rules:
1. Extract ONLY what is explicitly stated in the synopsis. Do NOT invent or assume information.
2. If a field cannot be determined, set it to null (or empty array for array fields).
3. Return ONLY valid JSON — no markdown formatting, no code fences, no explanatory text.
4. Use British English spellings (e.g., "randomised", "analysed", "behaviour").
5. Separate aims from objectives — aims are broader goals, objectives are specific measurable targets.
6. For sample_size, extract only the number (e.g., 100, not "100 patients").`;

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return validationError("Invalid request", {
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const { redacted } = redactPII(parsed.data.synopsis_text);

    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2000,
      system: SYNOPSIS_WIZARD_PROMPT,
      messages: [
        {
          role: "user",
          content: `Parse the following medical thesis synopsis and extract structured metadata as JSON:\n\n${redacted}`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return internalError("AI returned no text response");
    }

    // Parse the AI response
    let cleaned = textBlock.text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*\n?/, "")
        .replace(/\n?```\s*$/, "");
    }

    const result = JSON.parse(cleaned) as Record<string, unknown>;

    // Normalise into ParsedSynopsis shape
    const data = {
      title: typeof result.title === "string" ? result.title : null,
      aims: Array.isArray(result.aims)
        ? result.aims.filter((a): a is string => typeof a === "string")
        : [],
      objectives: Array.isArray(result.objectives)
        ? result.objectives.filter((o): o is string => typeof o === "string")
        : [],
      study_type:
        typeof result.study_type === "string" ? result.study_type : null,
      study_design:
        typeof result.study_design === "string" ? result.study_design : null,
      sample_size:
        typeof result.sample_size === "number" ? result.sample_size : null,
      inclusion_criteria: Array.isArray(result.inclusion_criteria)
        ? result.inclusion_criteria.filter(
            (c): c is string => typeof c === "string"
          )
        : [],
      exclusion_criteria: Array.isArray(result.exclusion_criteria)
        ? result.exclusion_criteria.filter(
            (c): c is string => typeof c === "string"
          )
        : [],
      methodology_summary:
        typeof result.methodology_summary === "string"
          ? result.methodology_summary
          : null,
    };

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Synopsis AI parse error:", err);
    return internalError("Failed to parse synopsis");
  }
}
