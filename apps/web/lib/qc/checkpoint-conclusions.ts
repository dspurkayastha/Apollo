/**
 * QA Checkpoint — Post-Conclusions (Phase 8).
 *
 * Runs after Phases 5, 7, 8 are complete, before advancing past Phase 8.
 * 6 checks: word count, truncation, discussion citations, limitations,
 * conclusion citation-free, AI alignment.
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

// ── Check 1: Word count bounds (Phases 5, 7, 8) ────────────────────────────

function checkWordCounts(sections: Section[]): QCCheck {
  const details: { item: string; message: string }[] = [];

  for (const phase of [5, 7, 8]) {
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
      name: "conclusions-word-counts",
      status: "pass",
      blocking: true,
      message: "Phases 5, 7, 8 meet word count targets",
      details: [],
    };
  }

  const hasBelow = details.some((d) => d.message.includes("below"));
  return {
    name: "conclusions-word-counts",
    status: hasBelow ? "fail" : "warn",
    blocking: hasBelow,
    message: `${details.length} word count issue(s) in Phases 5, 7, 8`,
    details,
    fixAction: "refine:expand",
  };
}

// ── Check 2: Truncation detection (Phases 5, 7, 8) ─────────────────────────

function checkTruncation(sections: Section[]): QCCheck {
  const allDetails: { item: string; message: string }[] = [];

  for (const phase of [5, 7, 8]) {
    const section = sections.find((s) => s.phase_number === phase);
    if (!section?.latex_content) continue;
    allDetails.push(...detectTruncation(section.latex_content, phase));
  }

  if (allDetails.length === 0) {
    return {
      name: "conclusions-truncation",
      status: "pass",
      blocking: true,
      message: "No truncation detected in Phases 5, 7, 8",
      details: [],
    };
  }

  return {
    name: "conclusions-truncation",
    status: "fail",
    blocking: true,
    message: `${allDetails.length} truncation issue(s) detected`,
    details: allDetails,
    fixAction: "refine:complete",
  };
}

// ── Check 3: Discussion citation density ────────────────────────────────────

const MIN_DISCUSSION_CITATIONS = 15;

function checkDiscussionCitations(sections: Section[]): QCCheck {
  const discussion = sections.find((s) => s.phase_number === 7);
  const content = discussion?.latex_content ?? "";
  const keys = extractUniqueCiteKeys(content);

  if (keys.length >= MIN_DISCUSSION_CITATIONS) {
    return {
      name: "conclusions-discussion-citations",
      status: "pass",
      blocking: false,
      message: `Discussion has ${keys.length} unique citations`,
      details: [],
    };
  }

  return {
    name: "conclusions-discussion-citations",
    status: "warn",
    blocking: false,
    message: `Discussion has only ${keys.length} unique citations (recommended ${MIN_DISCUSSION_CITATIONS})`,
    details: [
      {
        item: "Phase 7",
        message: `Found ${keys.length} unique \\cite{} keys, recommend at least ${MIN_DISCUSSION_CITATIONS}`,
      },
    ],
    fixAction: "refine:add-citations",
  };
}

// ── Check 4: Discussion mentions strengths and limitations ──────────────────

function checkLimitations(sections: Section[]): QCCheck {
  const discussion = sections.find((s) => s.phase_number === 7);
  const content = discussion?.latex_content ?? "";

  const hasStrength = /strength/i.test(content);
  const hasLimitation = /limitation/i.test(content);

  if (hasStrength && hasLimitation) {
    return {
      name: "conclusions-limitations",
      status: "pass",
      blocking: true,
      message: "Discussion mentions both strengths and limitations",
      details: [],
    };
  }

  const missing: string[] = [];
  if (!hasStrength) missing.push("strength(s)");
  if (!hasLimitation) missing.push("limitation(s)");

  return {
    name: "conclusions-limitations",
    status: "fail",
    blocking: true,
    message: `Discussion missing: ${missing.join(" and ")}`,
    details: [
      {
        item: "Phase 7",
        message: `Discussion must include a Strengths and Limitations subsection`,
      },
    ],
    fixAction: "refine:add-limitations",
  };
}

// ── Check 5: Conclusion should not cite ─────────────────────────────────────

function checkConclusionCiteFree(sections: Section[]): QCCheck {
  const conclusion = sections.find((s) => s.phase_number === 8);
  const content = conclusion?.latex_content ?? "";
  const keys = extractUniqueCiteKeys(content);

  if (keys.length === 0) {
    return {
      name: "conclusions-no-cite",
      status: "pass",
      blocking: false,
      message: "Conclusion has no citations (as expected)",
      details: [],
    };
  }

  return {
    name: "conclusions-no-cite",
    status: "warn",
    blocking: false,
    message: `Conclusion has ${keys.length} citation(s) --- conclusions typically should not cite references`,
    details: keys.map((k) => ({
      item: k,
      message: `\\cite{${k}} found in Conclusion`,
    })),
    fixAction: "refine:remove-citations",
  };
}

// ── Check 6: AI alignment review ────────────────────────────────────────────

async function checkAIAlignment(
  sections: Section[],
  projectId: string,
): Promise<QCCheck> {
  const aims =
    sections.find((s) => s.phase_number === 3)?.latex_content ?? "";
  const mm =
    sections
      .find((s) => s.phase_number === 5)
      ?.latex_content?.slice(0, 2000) ?? "";
  const discussion =
    sections
      .find((s) => s.phase_number === 7)
      ?.latex_content?.slice(0, 3000) ?? "";
  const conclusion =
    sections.find((s) => s.phase_number === 8)?.latex_content ?? "";

  const systemPrompt = `You are a thesis QA reviewer for Indian medical postgraduate theses. Assess whether the Discussion aligns with results, Conclusion answers the aims, and M&M is consistent.

Return ONLY valid JSON:
{
  "blocking_issues": ["issue1", ...],
  "warnings": ["warning1", ...]
}

Blocking issues:
- Conclusion doesn't address one or more primary objectives
- Discussion contradicts the results or M&M
- Critical logical inconsistency between chapters

Warnings:
- Discussion could be more thorough in comparing with literature
- Conclusion adds new information not discussed in Discussion
- Minor inconsistencies in methodology description`;

  const context = `AIMS & OBJECTIVES (Phase 3):\n${aims}\n\nMATERIALS & METHODS (Phase 5, first 2000 chars):\n${mm}\n\nDISCUSSION (Phase 7, first 3000 chars):\n${discussion}\n\nCONCLUSION (Phase 8):\n${conclusion}`;

  const result = await aiContentQA(systemPrompt, context, projectId, 8);

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
      name: "conclusions-ai-review",
      status: "fail",
      blocking: true,
      message: `AI review found ${result.blocking.length} blocking issue(s)`,
      details,
      fixAction: "refine:ai-suggestion",
    };
  }

  if (result.warnings.length > 0) {
    return {
      name: "conclusions-ai-review",
      status: "warn",
      blocking: false,
      message: `AI review found ${result.warnings.length} warning(s)`,
      details,
      fixAction: "refine:ai-suggestion",
    };
  }

  return {
    name: "conclusions-ai-review",
    status: "pass",
    blocking: false,
    message: "AI review: Discussion and Conclusion are well-aligned",
    details: [],
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function checkpointConclusions(
  sections: Section[],
  _citations: Citation[],
  projectId: string,
): Promise<QCReport> {
  const checks: QCCheck[] = [
    checkWordCounts(sections),
    checkTruncation(sections),
    checkDiscussionCitations(sections),
    checkLimitations(sections),
    checkConclusionCiteFree(sections),
    await checkAIAlignment(sections, projectId),
  ];

  return buildReport(checks);
}
