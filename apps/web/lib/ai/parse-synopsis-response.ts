import type { SynopsisParseResult } from "./prompts";

/**
 * Parse the AI response from synopsis parsing into structured data.
 * Handles potential JSON wrapped in markdown code fences.
 */
export function parseSynopsisResponse(raw: string): SynopsisParseResult | null {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    return {
      title: typeof parsed.title === "string" ? parsed.title : null,
      study_type: typeof parsed.study_type === "string" ? parsed.study_type : null,
      department: typeof parsed.department === "string" ? parsed.department : null,
      objectives: Array.isArray(parsed.objectives)
        ? parsed.objectives.filter((o): o is string => typeof o === "string")
        : null,
      methodology_summary:
        typeof parsed.methodology_summary === "string"
          ? parsed.methodology_summary
          : null,
      sample_size: typeof parsed.sample_size === "string" ? parsed.sample_size : null,
      duration: typeof parsed.duration === "string" ? parsed.duration : null,
      setting: typeof parsed.setting === "string" ? parsed.setting : null,
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords.filter((k): k is string => typeof k === "string")
        : null,
    };
  } catch {
    return null;
  }
}
