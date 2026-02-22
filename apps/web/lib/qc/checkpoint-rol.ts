/**
 * QA Checkpoint — Post-ROL (Phase 4).
 *
 * Runs after Phases 2–4 are complete, before advancing past Phase 4.
 * 5 checks: word count, truncation, longtable, citation density, AI coherence.
 */

import type { Section, Citation } from "@/lib/types/database";
import type { QCCheck, QCReport } from "./final-qc";
import { WORD_COUNT_CONFIG } from "@/lib/phases/word-count-config";
import {
  countLatexWords,
  extractUniqueCiteKeys,
  detectTruncation,
  aiContentQA,
  buildReport,
} from "./checkpoint-utils";

// ── Check 1: Word count bounds (Phases 2, 3, 4) ────────────────────────────

function checkWordCounts(sections: Section[]): QCCheck {
  const details: { item: string; message: string }[] = [];

  for (const phase of [2, 3, 4]) {
    const section = sections.find((s) => s.phase_number === phase);
    if (!section?.latex_content) continue;

    const config = WORD_COUNT_CONFIG[phase];
    if (!config) continue;

    const words = countLatexWords(section.latex_content);
    if (words < config.hardFloor) {
      details.push({
        item: `Phase ${phase}`,
        message: `Word count (${words}) below minimum (${config.hardFloor})`,
      });
    }
    if (words > config.hardCeiling) {
      details.push({
        item: `Phase ${phase}`,
        message: `Word count (${words}) above maximum (${config.hardCeiling})`,
      });
    }
  }

  if (details.length === 0) {
    return {
      name: "rol-word-counts",
      status: "pass",
      blocking: true,
      message: "Phases 2--4 meet word count targets",
      details: [],
    };
  }

  const hasBelow = details.some((d) => d.message.includes("below"));
  return {
    name: "rol-word-counts",
    status: hasBelow ? "fail" : "warn",
    blocking: hasBelow,
    message: `${details.length} word count issue(s) in Phases 2--4`,
    details,
    fixAction: "refine:expand",
  };
}

// ── Check 2: Truncation detection (Phases 2, 3, 4) ─────────────────────────

function checkTruncation(sections: Section[]): QCCheck {
  const allDetails: { item: string; message: string }[] = [];

  for (const phase of [2, 3, 4]) {
    const section = sections.find((s) => s.phase_number === phase);
    if (!section?.latex_content) continue;
    const phaseDetails = detectTruncation(section.latex_content, phase);
    allDetails.push(...phaseDetails);
  }

  if (allDetails.length === 0) {
    return {
      name: "rol-truncation",
      status: "pass",
      blocking: true,
      message: "No truncation detected in Phases 2--4",
      details: [],
    };
  }

  return {
    name: "rol-truncation",
    status: "fail",
    blocking: true,
    message: `${allDetails.length} truncation issue(s) detected`,
    details: allDetails,
    fixAction: "refine:complete",
  };
}

// ── Check 3: ROL must contain longtable ─────────────────────────────────────

function checkLongtable(sections: Section[]): QCCheck {
  const rol = sections.find((s) => s.phase_number === 4);
  const content = rol?.latex_content ?? "";

  if (/\\begin\{longtable\}/.test(content)) {
    return {
      name: "rol-summary-table",
      status: "pass",
      blocking: true,
      message: "Review of Literature contains a summary longtable",
      details: [],
    };
  }

  return {
    name: "rol-summary-table",
    status: "fail",
    blocking: true,
    message: "Review of Literature is missing a chronological summary longtable",
    details: [
      {
        item: "Phase 4",
        message: "Expected \\begin{longtable} in the Review of Literature",
      },
    ],
    fixAction: "refine:add-summary-table",
  };
}

// ── Check 4: ROL citation density ───────────────────────────────────────────

const MIN_ROL_CITATIONS = 15;

function checkCitationDensity(sections: Section[]): QCCheck {
  const rol = sections.find((s) => s.phase_number === 4);
  const content = rol?.latex_content ?? "";
  const keys = extractUniqueCiteKeys(content);

  if (keys.length >= MIN_ROL_CITATIONS) {
    return {
      name: "rol-citation-density",
      status: "pass",
      blocking: true,
      message: `Review of Literature has ${keys.length} unique citations`,
      details: [],
    };
  }

  return {
    name: "rol-citation-density",
    status: "fail",
    blocking: true,
    message: `Review of Literature has only ${keys.length} unique citations (minimum ${MIN_ROL_CITATIONS})`,
    details: [
      {
        item: "Phase 4",
        message: `Found ${keys.length} unique \\cite{} keys, need at least ${MIN_ROL_CITATIONS}`,
      },
    ],
    fixAction: "refine:add-citations",
  };
}

// ── Check 5: AI coherence + completeness ────────────────────────────────────

async function checkAICoherence(
  sections: Section[],
  projectId: string,
): Promise<QCCheck> {
  const synopsis =
    sections.find((s) => s.phase_number === 0)?.latex_content?.slice(0, 2000) ?? "";
  const intro =
    sections.find((s) => s.phase_number === 2)?.latex_content?.slice(0, 2000) ?? "";
  const aims =
    sections.find((s) => s.phase_number === 3)?.latex_content?.slice(0, 1000) ?? "";
  const rol =
    sections.find((s) => s.phase_number === 4)?.latex_content?.slice(0, 3000) ?? "";

  const systemPrompt = `You are a thesis QA reviewer for Indian medical postgraduate theses. Assess coherence, completeness, and alignment of the Introduction, Aims, and Review of Literature chapters.

Return ONLY valid JSON:
{
  "blocking_issues": ["issue1", ...],
  "warnings": ["warning1", ...]
}

Blocking issues (prevent advancement):
- ROL doesn't cover the thesis topic at all
- Introduction contradicts the aims
- Critical methodology gap (e.g., aims mention RCT but intro describes observational study)

Warnings (non-blocking):
- Minor gaps in literature coverage
- Slightly weak transitions between sections
- Missing recent references in a sub-area`;

  const context = `SYNOPSIS:\n${synopsis}\n\nINTRODUCTION (Phase 2):\n${intro}\n\nAIMS & OBJECTIVES (Phase 3):\n${aims}\n\nREVIEW OF LITERATURE (Phase 4):\n${rol}`;

  const result = await aiContentQA(systemPrompt, context, projectId, 4);

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
      name: "rol-ai-review",
      status: "fail",
      blocking: true,
      message: `AI review found ${result.blocking.length} blocking issue(s)`,
      details,
      fixAction: "refine:ai-suggestion",
    };
  }

  if (result.warnings.length > 0) {
    return {
      name: "rol-ai-review",
      status: "warn",
      blocking: false,
      message: `AI review found ${result.warnings.length} warning(s)`,
      details,
      fixAction: "refine:ai-suggestion",
    };
  }

  return {
    name: "rol-ai-review",
    status: "pass",
    blocking: false,
    message: "AI review: content is coherent and well-aligned",
    details: [],
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function checkpointROL(
  sections: Section[],
  _citations: Citation[],
  projectId: string,
): Promise<QCReport> {
  const checks: QCCheck[] = [
    checkWordCounts(sections),
    checkTruncation(sections),
    checkLongtable(sections),
    checkCitationDensity(sections),
    await checkAICoherence(sections, projectId),
  ];

  return buildReport(checks);
}
