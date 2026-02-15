import Anthropic from "@anthropic-ai/sdk";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getChecklist, type ChecklistItem } from "./checklists";
import type { GuidelineType, Section } from "@/lib/types/database";

export type ItemStatus = "green" | "yellow" | "red";

export interface CheckedItem {
  item_id: string;
  description: string;
  status: ItemStatus;
  section_ref: string | null;
  suggestion: string | null;
}

export interface ComplianceCheckResult {
  guideline_type: GuidelineType;
  items: CheckedItem[];
  overall_score: number;
}

/**
 * Run a compliance check for a project against a specific guideline.
 *
 * Algorithm:
 * 1. Load checklist for guideline type
 * 2. For each item, check mapped sections for keyword/pattern presence
 * 3. Use Claude Haiku for semantic checking of ambiguous items
 * 4. Score: green (present), yellow (partial), red (missing)
 */
export async function runComplianceCheck(
  projectId: string,
  guidelineType: GuidelineType,
  sections: Section[]
): Promise<ComplianceCheckResult> {
  const checklist = getChecklist(guidelineType);
  const checkedItems: CheckedItem[] = [];

  // Batch items for AI checking
  const itemsNeedingAI: { item: ChecklistItem; sectionContent: string; index: number }[] = [];

  for (let i = 0; i < checklist.length; i++) {
    const item = checklist[i]!;

    // Find relevant sections for this item
    const relevantSections = sections.filter((s) =>
      item.section_phases.includes(s.phase_number)
    );

    if (relevantSections.length === 0) {
      // No section exists for this checklist item
      checkedItems.push({
        item_id: item.id,
        description: item.description,
        status: "red",
        section_ref: null,
        suggestion: `Section for phase(s) ${item.section_phases.join(", ")} not yet written`,
      });
      continue;
    }

    // Combine content from relevant sections
    const combinedContent = relevantSections
      .map((s) => s.latex_content)
      .join("\n\n");

    // Quick keyword check
    const keywordScore = quickKeywordCheck(item, combinedContent);
    const phaseRef = `Phase ${relevantSections.map((s) => s.phase_number).join(", ")}`;

    if (keywordScore >= 0.7) {
      checkedItems.push({
        item_id: item.id,
        description: item.description,
        status: "green",
        section_ref: phaseRef,
        suggestion: null,
      });
    } else if (keywordScore >= 0.3) {
      checkedItems.push({
        item_id: item.id,
        description: item.description,
        status: "yellow",
        section_ref: phaseRef,
        suggestion: `Partially addressed — consider expanding coverage of: ${item.description}`,
      });
    } else {
      // Queue for AI semantic check
      itemsNeedingAI.push({
        item,
        sectionContent: combinedContent.slice(0, 2000),
        index: i,
      });

      // Placeholder — will be replaced by AI result
      checkedItems.push({
        item_id: item.id,
        description: item.description,
        status: "red",
        section_ref: phaseRef,
        suggestion: `Not found — add content addressing: ${item.description}`,
      });
    }
  }

  // Run AI semantic check for ambiguous items (batch)
  if (itemsNeedingAI.length > 0) {
    try {
      const aiResults = await batchAICheck(itemsNeedingAI);
      for (const result of aiResults) {
        checkedItems[result.index] = result.checkedItem;
      }
    } catch {
      // AI check is non-blocking — keep keyword-based results
    }
  }

  // Calculate overall score
  const totalItems = checkedItems.length;
  const greenCount = checkedItems.filter((i) => i.status === "green").length;
  const yellowCount = checkedItems.filter((i) => i.status === "yellow").length;
  const overallScore = Math.round(
    ((greenCount + yellowCount * 0.5) / totalItems) * 100
  );

  return {
    guideline_type: guidelineType,
    items: checkedItems,
    overall_score: overallScore,
  };
}

/**
 * Quick keyword-based check: extracts keywords from the checklist item
 * description and checks how many appear in the section content.
 */
function quickKeywordCheck(item: ChecklistItem, content: string): number {
  const lowerContent = content.toLowerCase();
  const description = item.description.toLowerCase();

  // Extract meaningful keywords (>3 chars, not stopwords)
  const stopwords = new Set([
    "the", "and", "for", "with", "any", "all", "each", "that", "this",
    "from", "were", "was", "are", "been", "have", "has", "had", "its",
    "their", "they", "them", "such", "used", "using", "whether", "done",
    "including", "including", "applicable", "relevant",
  ]);

  const keywords = description
    .split(/\W+/)
    .filter((w) => w.length > 3 && !stopwords.has(w));

  if (keywords.length === 0) return 0;

  const matches = keywords.filter((kw) => lowerContent.includes(kw));
  return matches.length / keywords.length;
}

/**
 * Batch AI semantic check using Claude Haiku for items that keyword
 * checking couldn't confidently classify.
 */
async function batchAICheck(
  items: { item: ChecklistItem; sectionContent: string; index: number }[]
): Promise<{ index: number; checkedItem: CheckedItem }[]> {
  const anthropic = new Anthropic();

  // Build a single prompt for all items
  const itemDescriptions = items
    .map(
      (entry, i) =>
        `${i + 1}. "${entry.item.description}" — Check in this section excerpt:\n${entry.sectionContent.slice(0, 500)}`
    )
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system:
      "You are a thesis compliance checker. For each numbered checklist item, determine if the section excerpt addresses it. Respond with ONLY a JSON array of objects: [{\"index\": 1, \"status\": \"green\"|\"yellow\"|\"red\", \"suggestion\": \"...\"}]. green=clearly addressed, yellow=partially addressed, red=not addressed.",
    messages: [
      {
        role: "user",
        content: `Check these reporting guideline items against the section content:\n\n${itemDescriptions}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];

  try {
    let jsonText = textBlock.text.trim();
    // Strip markdown fences if present
    jsonText = jsonText.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "");

    const results = JSON.parse(jsonText) as {
      index: number;
      status: string;
      suggestion: string;
    }[];

    return results.map((r) => {
      const originalItem = items[r.index - 1]!;
      const status = (["green", "yellow", "red"].includes(r.status)
        ? r.status
        : "red") as ItemStatus;

      const phaseRef = `Phase ${originalItem.item.section_phases.join(", ")}`;

      return {
        index: originalItem.index,
        checkedItem: {
          item_id: originalItem.item.id,
          description: originalItem.item.description,
          status,
          section_ref: phaseRef,
          suggestion: status !== "green" ? r.suggestion : null,
        },
      };
    });
  } catch {
    return [];
  }
}
