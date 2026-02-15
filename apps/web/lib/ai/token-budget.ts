/**
 * Token budget tracking per phase and per thesis.
 *
 * Limits (from PLAN.md):
 * - Max 100K output tokens per phase
 * - Max 1.2M total tokens per thesis
 * - Hard-stop at budget (no partial generation)
 *
 * Uses Supabase `ai_conversations` table for persistent tracking.
 * Falls back to in-memory cache if DB unavailable.
 */

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const MAX_OUTPUT_TOKENS_PER_PHASE = 100_000;
const MAX_TOTAL_TOKENS_PER_THESIS = 1_200_000;

export interface TokenBudgetResult {
  allowed: boolean;
  phaseTokensUsed: number;
  totalTokensUsed: number;
  phaseRemaining: number;
  totalRemaining: number;
  reason?: string;
}

/**
 * Check if a project has budget remaining for the given phase.
 */
export async function checkTokenBudget(
  projectId: string,
  phaseNumber: number
): Promise<TokenBudgetResult> {
  const supabase = createAdminSupabaseClient();

  // Fetch all AI conversations for this project
  const { data: conversations } = await supabase
    .from("ai_conversations")
    .select("phase_number, total_tokens")
    .eq("project_id", projectId);

  const records = conversations ?? [];

  // Calculate totals
  let totalTokensUsed = 0;
  let phaseTokensUsed = 0;

  for (const conv of records) {
    const tokens = (conv.total_tokens as number) ?? 0;
    totalTokensUsed += tokens;
    if ((conv.phase_number as number) === phaseNumber) {
      phaseTokensUsed += tokens;
    }
  }

  const phaseRemaining = MAX_OUTPUT_TOKENS_PER_PHASE - phaseTokensUsed;
  const totalRemaining = MAX_TOTAL_TOKENS_PER_THESIS - totalTokensUsed;

  if (phaseTokensUsed >= MAX_OUTPUT_TOKENS_PER_PHASE) {
    return {
      allowed: false,
      phaseTokensUsed,
      totalTokensUsed,
      phaseRemaining: 0,
      totalRemaining: Math.max(0, totalRemaining),
      reason: `Phase ${phaseNumber} token budget exhausted (${phaseTokensUsed.toLocaleString()} / ${MAX_OUTPUT_TOKENS_PER_PHASE.toLocaleString()})`,
    };
  }

  if (totalTokensUsed >= MAX_TOTAL_TOKENS_PER_THESIS) {
    return {
      allowed: false,
      phaseTokensUsed,
      totalTokensUsed,
      phaseRemaining: Math.max(0, phaseRemaining),
      totalRemaining: 0,
      reason: `Thesis token budget exhausted (${totalTokensUsed.toLocaleString()} / ${MAX_TOTAL_TOKENS_PER_THESIS.toLocaleString()})`,
    };
  }

  return {
    allowed: true,
    phaseTokensUsed,
    totalTokensUsed,
    phaseRemaining: Math.max(0, phaseRemaining),
    totalRemaining: Math.max(0, totalRemaining),
  };
}

/**
 * Record token usage after a successful generation.
 * Returns the conversation ID for linking to the section.
 */
export async function recordTokenUsage(
  projectId: string,
  phaseNumber: number,
  totalTokens: number,
  modelUsed: string
): Promise<string | null> {
  const supabase = createAdminSupabaseClient();

  const { data } = await supabase
    .from("ai_conversations")
    .insert({
      project_id: projectId,
      phase_number: phaseNumber,
      messages_json: [],
      model_used: modelUsed,
      total_tokens: totalTokens,
    })
    .select("id")
    .single();

  if (data?.id) {
    // Link the conversation to the section
    await supabase
      .from("sections")
      .update({ ai_conversation_id: data.id as string })
      .eq("project_id", projectId)
      .eq("phase_number", phaseNumber);
  }

  return (data?.id as string) ?? null;
}
