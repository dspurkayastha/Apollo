import { inngest } from "../client";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getPhase } from "@/lib/phases/constants";

/**
 * Thesis phase workflow: when a phase is approved, auto-create the next section
 * and wait for the next approval event.
 */
export const thesisPhaseWorkflow = inngest.createFunction(
  { id: "thesis-phase-workflow", name: "Thesis Phase Workflow" },
  { event: "thesis/phase.approved" },
  async ({ event, step }) => {
    const { projectId, phaseNumber } = event.data;
    const nextPhase = phaseNumber + 1;
    const nextPhaseDef = getPhase(nextPhase);

    if (!nextPhaseDef) {
      return { status: "completed", message: "All phases done" };
    }

    // Create the next section as draft (only if it doesn't already exist)
    await step.run("create-next-section", async () => {
      const supabase = createAdminSupabaseClient();
      const { data: existing } = await supabase
        .from("sections")
        .select("id")
        .eq("project_id", projectId)
        .eq("phase_number", nextPhase)
        .maybeSingle();

      if (!existing) {
        await supabase.from("sections").insert({
          project_id: projectId,
          phase_number: nextPhase,
          phase_name: nextPhaseDef.name,
          latex_content: "",
          word_count: 0,
          citation_keys: [],
          status: "draft",
        });
      }
    });

    // Wait for the next phase approval (timeout: 90 days)
    const nextApproval = await step.waitForEvent("wait-for-next-approval", {
      event: "thesis/phase.approved",
      match: "data.projectId",
      timeout: "90d",
    });

    if (!nextApproval) {
      return { status: "timeout", phase: nextPhase };
    }

    return { status: "advanced", fromPhase: phaseNumber, toPhase: nextPhase };
  }
);
