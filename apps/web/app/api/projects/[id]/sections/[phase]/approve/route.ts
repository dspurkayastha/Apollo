import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  conflict,
  licenceRequired,
  internalError,
  badRequest,
} from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isValidPhase, canAdvancePhase } from "@/lib/phases/transitions";
import { getPhase } from "@/lib/phases/constants";
import { generateFrontMatterLatex } from "@/lib/latex/front-matter";
import { auditCitations } from "@/lib/citations/audit";
import { aiReviewSection } from "@/lib/ai/review-section";
import type { Project, Section } from "@/lib/types/database";
import type { PlannedAnalysis } from "@/lib/validation/analysis-plan-schemas";
import { inngest } from "@/lib/inngest/client";
import { getPlanConfig } from "@/lib/pricing/config";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; phase: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id, phase } = await params;
    const phaseNumber = parseInt(phase, 10);

    if (!isValidPhase(phaseNumber)) {
      return badRequest("Invalid phase number");
    }

    const supabase = createAdminSupabaseClient();

    // Fetch project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (projectError || !project) {
      return notFound("Project not found");
    }

    const typedProject = project as Project;

    // Verify this is the current phase
    if (typedProject.current_phase !== phaseNumber) {
      return conflict(
        `Cannot approve Phase ${phaseNumber} — project is currently at Phase ${typedProject.current_phase}`
      );
    }

    // Fetch section
    const { data: section, error: sectionError } = await supabase
      .from("sections")
      .select("*")
      .eq("project_id", id)
      .eq("phase_number", phaseNumber)
      .single();

    if (sectionError || !section) {
      return notFound("Section not found — generate content first");
    }

    const typedSection = section as Section;

    // Section must have approvable content
    if (typedSection.status === "generating") {
      return conflict("Section is still generating — wait for completion before approving");
    }

    if (typedSection.status === "approved") {
      return conflict("Section is already approved");
    }

    if (typedSection.status === "draft") {
      if (!typedSection.latex_content?.trim()) {
        return badRequest("Cannot approve a draft section with no content — generate content first");
      }
      // Auto-promote draft with content to review, then approve below
      await supabase
        .from("sections")
        .update({ status: "review", updated_at: new Date().toISOString() })
        .eq("id", typedSection.id);
    }

    // At this point status is "review" (either originally or just promoted)

    // AI-powered review (non-blocking — warnings only, never blocks approval)
    let aiReviewIssues: { severity: string; category: string; message: string }[] = [];
    if (typedProject.synopsis_text && typedSection.latex_content) {
      try {
        aiReviewIssues = await aiReviewSection(
          typedSection.latex_content,
          phaseNumber,
          id,
          typedProject.synopsis_text,
          (typedProject.metadata_json ?? {}) as Record<string, unknown>,
        );
      } catch {
        // Non-blocking — AI review failure doesn't prevent approval
      }
    }

    // Phase 6: Figure/table QC gates (DECISIONS.md 5.3)
    if (phaseNumber === 6) {
      const MIN_FIGURES = 5;
      const MIN_TABLES = 7;

      const [{ count: figureCount }, { data: completedWithTables }] =
        await Promise.all([
          supabase
            .from("figures")
            .select("id", { count: "exact", head: true })
            .eq("project_id", id),
          supabase
            .from("analyses")
            .select("results_json")
            .eq("project_id", id)
            .eq("status", "completed"),
        ]);

      // Count actual tables: analyses with table_latex in results_json
      const analysisTableCount = (completedWithTables ?? []).filter(
        (a) => (a.results_json as Record<string, unknown>)?.table_latex
      ).length;

      if ((figureCount ?? 0) < MIN_FIGURES) {
        return badRequest(
          `Results requires at least ${MIN_FIGURES} figures (currently ${figureCount ?? 0}). ` +
            "Run additional analyses or upload figures."
        );
      }

      // Count tables: use the HIGHER of analysis-produced tables vs LaTeX table
      // environments in content. These overlap (AI embeds analysis tables verbatim),
      // so summing would double-count.
      const tableLatexCount = (
        typedSection.latex_content?.match(
          /\\begin\{(table|longtable|tabular)\}/g
        ) ?? []
      ).length;
      const totalTables = Math.max(analysisTableCount ?? 0, tableLatexCount);

      if (totalTables < MIN_TABLES) {
        return badRequest(
          `Results requires at least ${MIN_TABLES} tables (currently ${totalTables}). ` +
            "Run additional analyses to generate more tables."
        );
      }

      // Analysis plan match: every non-skipped planned analysis must have a completed result
      const plan = (typedProject.analysis_plan_json ?? []) as unknown as PlannedAnalysis[];
      if (plan.length > 0) {
        const { data: completedAnalyses } = await supabase
          .from("analyses")
          .select("analysis_type")
          .eq("project_id", id)
          .eq("status", "completed");

        const completedSet = new Set(
          (completedAnalyses ?? []).map((a) => a.analysis_type)
        );
        const missingPlanned = plan.filter(
          (p) => p.status !== "skipped" && !completedSet.has(p.analysis_type)
        );

        if (missingPlanned.length > 0) {
          return badRequest(
            `Analysis plan incomplete: ${missingPlanned.map((p) => p.analysis_type).join(", ")} not yet completed.`
          );
        }
      }
    }

    // Phase 11: Final QC gate — MUST run BEFORE section approval.
    // If QC fails, we return early without changing section status, so the
    // student can fix issues and re-attempt.
    if (phaseNumber === 11) {
      const { finalQC } = await import("@/lib/qc/final-qc");
      const [
        { data: allSections },
        { data: allCitations },
        { data: latestCompilation },
        { count: figs },
        { data: qcAnalyses },
      ] = await Promise.all([
        supabase
          .from("sections")
          .select("*")
          .eq("project_id", id)
          .order("phase_number", { ascending: true }),
        supabase.from("citations").select("*").eq("project_id", id),
        supabase
          .from("compilations")
          .select("log_text")
          .eq("project_id", id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("figures")
          .select("id", { count: "exact", head: true })
          .eq("project_id", id),
        supabase
          .from("analyses")
          .select("results_json")
          .eq("project_id", id)
          .eq("status", "completed"),
      ]);

      const qcTableCount = (qcAnalyses ?? []).filter(
        (a) => (a.results_json as Record<string, unknown>)?.table_latex
      ).length;

      const qcReport = finalQC(
        (allSections ?? []) as Section[],
        (allCitations ?? []) as import("@/lib/types/database").Citation[],
        (latestCompilation?.log_text as string) ?? null,
        figs ?? 0,
        qcTableCount,
      );

      if (!qcReport.overallPass) {
        return badRequest(
          `Final QC failed: ${qcReport.blockingCount} blocking issue(s). ` +
          "Run Final QC from the dashboard for details."
        );
      }
    }

    // Check if project can advance
    const transitionCheck = canAdvancePhase(typedProject);

    if (!transitionCheck.allowed) {
      if (transitionCheck.code === "LICENCE_REQUIRED") {
        return licenceRequired("Attach a licence to advance beyond Phase 1");
      }
      return conflict(transitionCheck.reason ?? "Cannot advance phase");
    }

    // Approve section and advance phase
    const newPhase = phaseNumber + 1;
    const newPhasesCompleted = Array.from(
      new Set([...(typedProject.phases_completed as number[]), phaseNumber])
    );

    const [sectionResult, projectResult] = await Promise.all([
      supabase
        .from("sections")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("id", typedSection.id)
        .select("*")
        .single(),
      supabase
        .from("projects")
        .update({
          current_phase: newPhase,
          phases_completed: newPhasesCompleted,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single(),
    ]);

    if (sectionResult.error || projectResult.error) {
      console.error("Failed to approve section:", sectionResult.error, projectResult.error);
      return internalError("Failed to approve section");
    }

    // Track monthly phase advancement for subscription plans
    if (typedProject.license_id) {
      try {
        const { data: licence } = await supabase
          .from("thesis_licenses")
          .select("plan_type, monthly_phases_advanced")
          .eq("id", typedProject.license_id)
          .single();

        if (licence) {
          try {
            const config = getPlanConfig(licence.plan_type as string);
            if (config.maxPhasesPerMonth !== null) {
              await supabase
                .from("thesis_licenses")
                .update({
                  monthly_phases_advanced:
                    (licence.monthly_phases_advanced as number) + 1,
                })
                .eq("id", typedProject.license_id);
            }
          } catch {
            // Unknown plan type — skip tracking
          }
        }
      } catch (trackErr) {
        console.warn("Monthly phase tracking failed (non-blocking):", trackErr);
      }
    }

    // If Phase 0 was just approved, auto-create Phase 1 section with front matter
    if (phaseNumber === 0) {
      const phase1Def = getPhase(1);
      const updatedProject = projectResult.data as Project;
      const frontMatterLatex = generateFrontMatterLatex(updatedProject);

      await supabase.from("sections").upsert(
        {
          project_id: id,
          phase_number: 1,
          phase_name: phase1Def?.name ?? "front_matter",
          latex_content: frontMatterLatex,
          word_count: frontMatterLatex.split(/\s+/).length,
          citation_keys: [],
          status: "review",
        },
        { onConflict: "project_id,phase_number" }
      );
    }

    // Phase 8 approved → auto-create Phase 9 with citation audit results
    if (phaseNumber === 8) {
      const phase9Def = getPhase(9);
      try {
        // Fetch all sections and citations for audit
        const [{ data: allSections }, { data: allCitations }] = await Promise.all([
          supabase
            .from("sections")
            .select("*")
            .eq("project_id", id)
            .eq("status", "approved"),
          supabase
            .from("citations")
            .select("*")
            .eq("project_id", id),
        ]);

        const auditResult = auditCitations(
          (allSections ?? []) as Section[],
          (allCitations ?? []) as unknown as import("@/lib/types/database").Citation[]
        );

        const citations = allCitations ?? [];
        const auditLatex = [
          "\\section{Citation Audit Summary}",
          "",
          `Integrity Score: ${auditResult.integrityScore}\\%`,
          "",
          `Total citations: ${citations.length}`,
          `Tier A (verified): ${citations.filter((c) => c.provenance_tier === "A").length}`,
          `Tier B (confirmed): ${citations.filter((c) => c.provenance_tier === "B").length}`,
          `Tier C (attested): ${citations.filter((c) => c.provenance_tier === "C").length}`,
          `Tier D (unverified): ${citations.filter((c) => c.provenance_tier === "D").length}`,
          "",
          auditResult.missingCitations.length > 0
            ? `\\subsection{Missing Citations}\n${auditResult.missingCitations.map((m) => `\\texttt{${m.citeKey}}`).join(", ")}`
            : "No missing citations.",
          "",
          auditResult.orphanedCitations.length > 0
            ? `\\subsection{Orphaned Citations}\n${auditResult.orphanedCitations.map((o) => `\\texttt{${o.citeKey}}`).join(", ")}`
            : "No orphaned citations.",
          "",
          auditResult.tierDBlocking.length > 0
            ? `\\subsection{Tier D Citations (Blocking Final QC)}\n${auditResult.tierDBlocking.map((d) => `\\texttt{${d.citeKey}}`).join(", ")}`
            : "No Tier D citations blocking Final QC.",
        ].join("\n");

        await supabase.from("sections").upsert(
          {
            project_id: id,
            phase_number: 9,
            phase_name: phase9Def?.name ?? "references",
            latex_content: auditLatex,
            word_count: auditLatex.split(/\s+/).length,
            citation_keys: [],
            status: "draft",
          },
          { onConflict: "project_id,phase_number" }
        );
      } catch (auditError) {
        console.warn("Citation audit auto-trigger failed (non-blocking):", auditError);
      }
    }

    // Phase 10 approved → auto-create Phase 11 with QC placeholder
    if (phaseNumber === 10) {
      const phase11Def = getPhase(11);
      await supabase.from("sections").upsert(
        {
          project_id: id,
          phase_number: 11,
          phase_name: phase11Def?.name ?? "final_qc",
          latex_content: "Run Final QC to generate the quality report.",
          word_count: 0,
          citation_keys: [],
          status: "review",
        },
        { onConflict: "project_id,phase_number" }
      );
    }

    // Phase 11 approved + QC passed (checked above) → mark project completed
    if (phaseNumber === 11) {
      await supabase
        .from("projects")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    }

    // Emit Inngest event for workflow orchestration (skip if not configured)
    if (process.env.INNGEST_EVENT_KEY) {
      try {
        await inngest.send({
          name: "thesis/phase.approved",
          data: {
            projectId: id,
            phaseNumber,
            userId: authResult.user.id,
          },
        });
      } catch (inngestError) {
        // Non-blocking — workflow will retry on next approval
        console.warn("Failed to emit Inngest event:", inngestError);
      }
    }

    return NextResponse.json({
      data: {
        section: sectionResult.data,
        project: projectResult.data,
        advanced_to_phase: newPhase,
        ai_review: aiReviewIssues.length > 0 ? aiReviewIssues : undefined,
      },
    });
  } catch (err) {
    console.error("Unexpected error in POST /api/projects/[id]/sections/[phase]/approve:", err);
    return internalError();
  }
}
