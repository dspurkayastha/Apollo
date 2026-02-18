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

    // sample_size: accept number or coerce string→number
    let sampleSize: number | null = null;
    if (typeof parsed.sample_size === "number") {
      sampleSize = parsed.sample_size;
    } else if (typeof parsed.sample_size === "string") {
      const n = parseInt(parsed.sample_size, 10);
      if (!isNaN(n)) sampleSize = n;
    }

    return {
      title: typeof parsed.title === "string" ? parsed.title : null,
      study_type: typeof parsed.study_type === "string" ? parsed.study_type : null,
      study_design: typeof parsed.study_design === "string" ? parsed.study_design : null,
      department: typeof parsed.department === "string" ? parsed.department : null,
      aims: Array.isArray(parsed.aims)
        ? parsed.aims.filter((a): a is string => typeof a === "string")
        : [],
      objectives: Array.isArray(parsed.objectives)
        ? parsed.objectives.filter((o): o is string => typeof o === "string")
        : null,
      methodology_summary:
        typeof parsed.methodology_summary === "string"
          ? parsed.methodology_summary
          : null,
      sample_size: sampleSize,
      duration: typeof parsed.duration === "string" ? parsed.duration : null,
      setting: typeof parsed.setting === "string" ? parsed.setting : null,
      inclusion_criteria: Array.isArray(parsed.inclusion_criteria)
        ? parsed.inclusion_criteria.filter((c): c is string => typeof c === "string")
        : [],
      exclusion_criteria: Array.isArray(parsed.exclusion_criteria)
        ? parsed.exclusion_criteria.filter((c): c is string => typeof c === "string")
        : [],
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords.filter((k): k is string => typeof k === "string")
        : null,
    };
  } catch {
    return null;
  }
}
