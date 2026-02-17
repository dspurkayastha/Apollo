#!/usr/bin/env npx tsx
/**
 * ONE-TIME BACKFILL SCRIPT — Phase 4 migration
 *
 * Sections edited in Tiptap (rich text mode) may have stale `latex_content`
 * that still matches the original AI output (`ai_generated_latex`), while
 * `rich_content_json` contains newer edits. This script converts those
 * rich_content_json values back to LaTeX so `latex_content` is canonical.
 *
 * Run BEFORE deleting tiptap-to-latex.ts:
 *   npx tsx scripts/backfill-latex-content.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */

import { createClient } from "@supabase/supabase-js";
// This import will be removed after backfill — it's the last consumer
import { tiptapToLatex, type TiptapNode } from "../apps/web/lib/latex/tiptap-to-latex";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Querying sections where rich_content_json may be newer than latex_content...");

  // Find sections where user edited in rich text mode:
  // ai_generated_latex = latex_content (user never saved in source mode)
  // AND rich_content_json IS NOT NULL
  const { data: sections, error } = await supabase
    .from("sections")
    .select("id, project_id, phase_number, latex_content, ai_generated_latex, rich_content_json")
    .not("rich_content_json", "is", null)
    .not("ai_generated_latex", "is", null);

  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }

  const candidates = (sections ?? []).filter(
    (s) => s.ai_generated_latex === s.latex_content && s.rich_content_json
  );

  console.log(`Found ${candidates.length} sections to backfill (of ${sections?.length ?? 0} with rich_content_json)`);

  let updated = 0;
  let skipped = 0;

  for (const section of candidates) {
    try {
      const result = tiptapToLatex(section.rich_content_json as unknown as TiptapNode);
      if (!result.latex.trim()) {
        console.warn(`  [SKIP] Section ${section.id} (phase ${section.phase_number}): tiptapToLatex produced empty output`);
        skipped++;
        continue;
      }

      const { error: updateError } = await supabase
        .from("sections")
        .update({
          latex_content: result.latex,
          rich_content_json: null, // Clear — latex_content is now canonical
          updated_at: new Date().toISOString(),
        })
        .eq("id", section.id);

      if (updateError) {
        console.error(`  [ERROR] Section ${section.id}: ${updateError.message}`);
      } else {
        console.log(`  [OK] Section ${section.id} (project ${section.project_id}, phase ${section.phase_number})`);
        updated++;
      }
    } catch (err) {
      console.error(`  [ERROR] Section ${section.id}:`, err);
    }
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped, ${candidates.length - updated - skipped} errors`);
}

main().catch(console.error);
