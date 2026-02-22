/**
 * QA Checkpoint — Post-Results (Phase 6).
 *
 * Consolidates the existing Phase 6 gates from the approve route
 * plus new structural and AI checks. 8 checks total.
 */

import type { Section, Analysis, Project } from "@/lib/types/database";
import type { QCCheck, QCReport } from "./final-qc";
import type { PlannedAnalysis } from "@/lib/validation/analysis-plan-schemas";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  detectTruncation,
  aiContentQA,
  buildReport,
} from "./checkpoint-utils";

const MIN_FIGURES = 5;
const MIN_TABLES = 7;

// ── Check 1: Figure count (moved from approve route) ───────────────────────

function checkFigureCount(figureCount: number): QCCheck {
  if (figureCount >= MIN_FIGURES) {
    return {
      name: "results-figure-count",
      status: "pass",
      blocking: true,
      message: `${figureCount} figure(s) meet minimum of ${MIN_FIGURES}`,
      details: [],
    };
  }

  return {
    name: "results-figure-count",
    status: "fail",
    blocking: true,
    message: `Only ${figureCount} figure(s) --- minimum ${MIN_FIGURES} required`,
    details: [
      {
        item: "Figures",
        message: `Run additional analyses or upload figures to reach ${MIN_FIGURES}`,
      },
    ],
  };
}

// ── Check 2: Table count using Math.max (moved from approve route) ──────────

function checkTableCount(
  sections: Section[],
  analysisTableCount: number,
): QCCheck {
  const resultsSection = sections.find((s) => s.phase_number === 6);
  const latexTableCount = (
    resultsSection?.latex_content?.match(
      /\\begin\{(table|longtable|tabular)\}/g,
    ) ?? []
  ).length;
  const totalTables = Math.max(analysisTableCount, latexTableCount);

  if (totalTables >= MIN_TABLES) {
    return {
      name: "results-table-count",
      status: "pass",
      blocking: true,
      message: `${totalTables} table(s) meet minimum of ${MIN_TABLES}`,
      details: [],
    };
  }

  return {
    name: "results-table-count",
    status: "fail",
    blocking: true,
    message: `Only ${totalTables} table(s) --- minimum ${MIN_TABLES} required`,
    details: [
      {
        item: "Tables",
        message: `Run additional analyses to generate more tables (analysis: ${analysisTableCount}, LaTeX: ${latexTableCount})`,
      },
    ],
  };
}

// ── Check 3: Analysis plan completeness (moved from approve route) ──────────

function checkAnalysisPlanCompleteness(
  project: Project,
  completedAnalysisTypes: Set<string>,
): QCCheck {
  const plan = (project.analysis_plan_json ?? []) as unknown as PlannedAnalysis[];
  if (plan.length === 0) {
    return {
      name: "results-plan-completeness",
      status: "pass",
      blocking: true,
      message: "No analysis plan to verify",
      details: [],
    };
  }

  const missingPlanned = plan.filter(
    (p) => p.status !== "skipped" && !completedAnalysisTypes.has(p.analysis_type),
  );

  if (missingPlanned.length === 0) {
    return {
      name: "results-plan-completeness",
      status: "pass",
      blocking: true,
      message: "All planned analyses are completed",
      details: [],
    };
  }

  return {
    name: "results-plan-completeness",
    status: "fail",
    blocking: true,
    message: `${missingPlanned.length} planned analysis(es) not yet completed`,
    details: missingPlanned.map((p) => ({
      item: p.analysis_type,
      message: "Analysis not completed",
    })),
  };
}

// ── Check 4: Demographics/baseline table ────────────────────────────────────

function checkDemographicsTable(sections: Section[]): QCCheck {
  const results = sections.find((s) => s.phase_number === 6);
  const content = results?.latex_content ?? "";

  // Look for table environment with demographic/baseline in caption or nearby text
  const tableRegions = content.split(/\\begin\{table\}/i);
  const hasDemographics = tableRegions.some(
    (region) =>
      /\\caption\{[^}]*(demographic|baseline)[^}]*\}/i.test(region) ||
      /(demographic|baseline)\s+(characteristic|data|table)/i.test(
        region.slice(0, 500),
      ),
  );

  if (hasDemographics) {
    return {
      name: "results-demographics",
      status: "pass",
      blocking: false,
      message: "Demographics/baseline table found",
      details: [],
    };
  }

  return {
    name: "results-demographics",
    status: "warn",
    blocking: false,
    message: "No demographics/baseline characteristics table detected",
    details: [
      {
        item: "Phase 6",
        message:
          "Consider adding a demographics/baseline characteristics table",
      },
    ],
    fixAction: "refine:add-demographics",
  };
}

// ── Check 5: Figure/table cross-references ──────────────────────────────────

function checkCrossReferences(sections: Section[]): QCCheck {
  const results = sections.find((s) => s.phase_number === 6);
  const content = results?.latex_content ?? "";
  const details: { item: string; message: string }[] = [];

  // Extract labels inside figure/table environments
  const envRegex = /\\begin\{(figure|table)\}[\s\S]*?\\end\{\1\}/g;
  let match: RegExpExecArray | null;
  while ((match = envRegex.exec(content)) !== null) {
    const labelMatch = match[0].match(/\\label\{([^}]+)\}/);
    if (labelMatch) {
      const label = labelMatch[1];
      const refPattern = new RegExp(
        `\\\\ref\\{${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\}`,
      );
      if (!refPattern.test(content)) {
        details.push({
          item: label,
          message: `\\label{${label}} has no matching \\ref{${label}} in the Results chapter`,
        });
      }
    }
  }

  if (details.length === 0) {
    return {
      name: "results-cross-refs",
      status: "pass",
      blocking: false,
      message: "All figure/table labels are cross-referenced",
      details: [],
    };
  }

  return {
    name: "results-cross-refs",
    status: "warn",
    blocking: false,
    message: `${details.length} figure/table label(s) without cross-references`,
    details,
    fixAction: "refine:fix-crossrefs",
  };
}

// ── Check 6: Truncation detection ───────────────────────────────────────────

function checkTruncation(sections: Section[]): QCCheck {
  const results = sections.find((s) => s.phase_number === 6);
  if (!results?.latex_content) {
    return {
      name: "results-truncation",
      status: "pass",
      blocking: true,
      message: "No content to check",
      details: [],
    };
  }

  const truncDetails = detectTruncation(results.latex_content, 6);
  if (truncDetails.length === 0) {
    return {
      name: "results-truncation",
      status: "pass",
      blocking: true,
      message: "No truncation detected in Results chapter",
      details: [],
    };
  }

  return {
    name: "results-truncation",
    status: "fail",
    blocking: true,
    message: `${truncDetails.length} truncation issue(s) in Results`,
    details: truncDetails,
    fixAction: "refine:complete",
  };
}

// ── Check 7: Analysis summary coverage ──────────────────────────────────────

function checkAnalysisCoverage(
  sections: Section[],
  completedAnalyses: Analysis[],
): QCCheck {
  const results = sections.find((s) => s.phase_number === 6);
  const content = (results?.latex_content ?? "").toLowerCase();
  const details: { item: string; message: string }[] = [];

  for (const analysis of completedAnalyses) {
    const resultsJson = analysis.results_json as Record<string, unknown>;
    const summary = (resultsJson?.summary as string) ?? "";
    if (!summary) continue;

    // Extract key terms from summary (words > 5 chars)
    const keyTerms = summary
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 5 && /^[a-z]+$/.test(w));

    // Check if at least some key terms appear in the chapter
    const uniqueTerms = [...new Set(keyTerms)].slice(0, 5);
    const found = uniqueTerms.filter((t) => content.includes(t));

    if (uniqueTerms.length > 0 && found.length === 0) {
      details.push({
        item: analysis.analysis_type,
        message: `Analysis results may not be adequately covered in the chapter text`,
      });
    }
  }

  if (details.length === 0) {
    return {
      name: "results-analysis-coverage",
      status: "pass",
      blocking: false,
      message: "Analysis results are referenced in the chapter text",
      details: [],
    };
  }

  return {
    name: "results-analysis-coverage",
    status: "warn",
    blocking: false,
    message: `${details.length} analysis(es) may not be covered in the chapter text`,
    details,
    fixAction: "refine:cover-analyses",
  };
}

// ── Check 8: AI review — results answer objectives ──────────────────────────

async function checkAIResults(
  sections: Section[],
  completedAnalyses: Analysis[],
  projectId: string,
): Promise<QCCheck> {
  const aims =
    sections.find((s) => s.phase_number === 3)?.latex_content ?? "";
  const resultsBody =
    sections
      .find((s) => s.phase_number === 6)
      ?.latex_content?.slice(0, 4000) ?? "";

  const analysisSummaries = completedAnalyses
    .map((a) => {
      const rj = a.results_json as Record<string, unknown>;
      return `${a.analysis_type}: ${(rj?.summary as string) ?? "no summary"}`;
    })
    .join("\n")
    .slice(0, 1000);

  const systemPrompt = `You are a thesis QA reviewer for Indian medical postgraduate theses. Assess whether the Results chapter adequately answers the research objectives.

Return ONLY valid JSON:
{
  "blocking_issues": ["issue1", ...],
  "warnings": ["warning1", ...]
}

Blocking issues:
- Results don't address one or more primary objectives at all
- Demographics/baseline characteristics completely missing
- Primary outcome data not presented

Warnings:
- Secondary outcomes only partially covered
- Some objectives addressed but with limited detail
- Results could benefit from additional sub-group analysis`;

  const context = `AIMS & OBJECTIVES (Phase 3):\n${aims}\n\nRESULTS (Phase 6, first 4000 chars):\n${resultsBody}\n\nANALYSIS SUMMARIES:\n${analysisSummaries}`;

  const result = await aiContentQA(systemPrompt, context, projectId, 6);

  const details: { item: string; message: string }[] = [
    ...result.blocking.map((msg) => ({
      item: "AI Review (blocking)",
      message: msg,
    })),
    ...result.warnings.map((msg) => ({
      item: "AI Review (warning)",
      message: msg,
    })),
  ];

  if (result.blocking.length > 0) {
    return {
      name: "results-ai-review",
      status: "fail",
      blocking: true,
      message: `AI review found ${result.blocking.length} blocking issue(s)`,
      details,
      fixAction: "refine:ai-suggestion",
    };
  }

  if (result.warnings.length > 0) {
    return {
      name: "results-ai-review",
      status: "warn",
      blocking: false,
      message: `AI review found ${result.warnings.length} warning(s)`,
      details,
      fixAction: "refine:ai-suggestion",
    };
  }

  return {
    name: "results-ai-review",
    status: "pass",
    blocking: false,
    message: "AI review: Results adequately address research objectives",
    details: [],
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function checkpointResults(
  sections: Section[],
  project: Project,
  projectId: string,
): Promise<QCReport> {
  const supabase = createAdminSupabaseClient();

  // Fetch figures count and completed analyses (same as old approve route)
  const [{ count: figureCount }, { data: rawAnalyses }] =
    await Promise.all([
      supabase
        .from("figures")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId),
      supabase
        .from("analyses")
        .select("*")
        .eq("project_id", projectId)
        .eq("status", "completed"),
    ]);

  const completedAnalyses = (rawAnalyses ?? []) as Analysis[];

  const analysisTableCount = completedAnalyses.filter(
    (a) => (a.results_json as Record<string, unknown>)?.table_latex,
  ).length;

  const completedAnalysisTypes = new Set(
    completedAnalyses.map((a) => a.analysis_type),
  );

  const checks: QCCheck[] = [
    checkFigureCount(figureCount ?? 0),
    checkTableCount(sections, analysisTableCount),
    checkAnalysisPlanCompleteness(project, completedAnalysisTypes),
    checkDemographicsTable(sections),
    checkCrossReferences(sections),
    checkTruncation(sections),
    checkAnalysisCoverage(sections, completedAnalyses),
    await checkAIResults(sections, completedAnalyses, projectId),
  ];

  return buildReport(checks);
}
