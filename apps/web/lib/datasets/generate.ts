import Papa from "papaparse";
import { getAnthropicClient } from "@/lib/ai/client";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { DATASET_GENERATION_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { recordTokenUsage } from "@/lib/ai/token-budget";
import type { DatasetGenerateInput } from "@/lib/validation/dataset-schemas";
import type { ParsedColumn } from "./parse";

export interface DatasetGenerationParams extends DatasetGenerateInput {
  projectId: string;
}

export interface GeneratedDataset {
  rows: Record<string, unknown>[];
  columns: ParsedColumn[];
  rowCount: number;
  csvContent: string;
}

/**
 * Generate a synthetic clinical dataset using AI, based on the project's
 * synopsis metadata and Review of Literature findings.
 */
export async function generateDataset(
  params: DatasetGenerationParams
): Promise<GeneratedDataset> {
  const { projectId, sample_size, variables } = params;
  const supabase = createAdminSupabaseClient();

  // 1. Fetch project synopsis metadata
  const { data: project } = await supabase
    .from("projects")
    .select("synopsis_text, study_type, metadata_json")
    .eq("id", projectId)
    .single();

  if (!project) throw new Error("Project not found");

  // 2. Fetch ROL section content (Phase 4) for expected distributions
  const { data: rolSection } = await supabase
    .from("sections")
    .select("latex_content")
    .eq("project_id", projectId)
    .eq("phase_number", 4)
    .single();

  // 3. Build the user prompt
  const metadata = project.metadata_json as Record<string, unknown> | null;
  const synopsisSampleSize =
    metadata?.sample_size ??
    project.synopsis_text?.match(/sample\s+size[:\s]*(\d+)/i)?.[1] ??
    undefined;

  const effectiveSampleSize = sample_size ?? (Number(synopsisSampleSize) || 100);

  let userPrompt = `Generate a realistic clinical dataset with ${effectiveSampleSize} subjects.\n\n`;
  userPrompt += `Study type: ${project.study_type ?? "Observational"}\n\n`;

  if (project.synopsis_text) {
    userPrompt += `Synopsis:\n${project.synopsis_text}\n\n`;
  }

  // Extract objectives from metadata so AI generates relevant columns
  const objectives = (metadata?.objectives as string[]) ?? [];
  if (objectives.length > 0) {
    userPrompt += `Study objectives (generate columns relevant to these):\n${objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}\n\n`;
  }

  if (rolSection?.latex_content) {
    userPrompt += `Key findings from Review of Literature (anchor means, SDs, and prevalence to values cited here):\n${rolSection.latex_content}\n\n`;
  }

  if (variables && variables.length > 0) {
    userPrompt += "Variables to generate:\n";
    for (const v of variables) {
      let desc = `- ${v.name} (${v.type})`;
      if (v.categories) desc += ` — categories: ${v.categories.join(", ")}`;
      if (v.range) desc += ` — range: ${v.range[0]} to ${v.range[1]}`;
      userPrompt += desc + "\n";
    }
  } else {
    userPrompt +=
      "Auto-detect appropriate variables from the synopsis and generate columns for: demographics (age, sex), key clinical measurements, outcome variables, and grouping variables as appropriate.\n";
  }

  userPrompt += `\nOutput exactly ${effectiveSampleSize} rows as CSV with headers. No explanation, no markdown fences — just CSV.`;

  // 4. Call Claude to generate the dataset
  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 8192,
    system: DATASET_GENERATION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  // Record token usage (fire-and-forget)
  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  void recordTokenUsage(projectId, 6, inputTokens, outputTokens, "claude-sonnet-4-5-20250929").catch(console.error);

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AI returned no text content");
  }

  // 5. Parse the CSV response
  let csvText = textBlock.text.trim();
  // Strip markdown fences if present (despite instructions)
  csvText = csvText.replace(/^```(?:csv)?\n?/m, "").replace(/\n?```$/m, "");

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (!parsed.meta.fields || parsed.meta.fields.length === 0) {
    throw new Error("AI-generated CSV has no headers");
  }

  if (parsed.data.length === 0) {
    throw new Error("AI-generated CSV has no data rows");
  }

  // 6. Detect column types
  const columns: ParsedColumn[] = parsed.meta.fields.map((name) => {
    const values = parsed.data
      .map((r) => r[name] ?? "")
      .filter((v) => v.trim() !== "");
    const total = values.length || 1;
    const numericCount = values.filter(
      (v) => !isNaN(Number(v)) && isFinite(Number(v))
    ).length;
    if (numericCount / total > 0.8) return { name, type: "numeric" as const };

    const datePatterns = [/^\d{4}-\d{2}-\d{2}/, /^\d{1,2}\/\d{1,2}\/\d{2,4}$/];
    const dateCount = values.filter((v) =>
      datePatterns.some((p) => p.test(v.trim()))
    ).length;
    if (dateCount / total > 0.8) return { name, type: "date" as const };

    return { name, type: "categorical" as const };
  });

  return {
    rows: parsed.data as Record<string, unknown>[],
    columns,
    rowCount: parsed.data.length,
    csvContent: csvText,
  };
}
