/**
 * Final Quality Control — Phase 11.
 *
 * Orchestrates all quality checks and returns a structured QCReport.
 * Per PLAN.md §647-658 and §799-802.
 */

import type { Section, Citation } from "@/lib/types/database";
import { auditCitations } from "@/lib/citations/audit";

// ── Types ──────────────────────────────────────────────────────────────────

export interface QCDetail {
  item: string;
  message: string;
}

export interface QCCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  blocking: boolean;
  message: string;
  details: QCDetail[];
  fixAction?: string;
}

export interface QCReport {
  checks: QCCheck[];
  overallPass: boolean;
  blockingCount: number;
  warningCount: number;
}

// ── American → British spelling dictionary ─────────────────────────────────

const AMERICAN_TO_BRITISH: [RegExp, string][] = [
  [/\banalyze\b/gi, "analyse"],
  [/\banalyzed\b/gi, "analysed"],
  [/\banalyzing\b/gi, "analysing"],
  [/\bbehavior\b/gi, "behaviour"],
  [/\bcolor\b/gi, "colour"],
  [/\bcenter\b/gi, "centre"],
  [/\brandomized\b/gi, "randomised"],
  [/\borganize\b/gi, "organise"],
  [/\borganized\b/gi, "organised"],
  [/\brecognize\b/gi, "recognise"],
  [/\brecognized\b/gi, "recognised"],
  [/\bspecialized\b/gi, "specialised"],
  [/\bfavor\b/gi, "favour"],
  [/\bhonor\b/gi, "honour"],
  [/\blabor\b/gi, "labour"],
  [/\btumor\b/gi, "tumour"],
  [/\bfetus\b/gi, "foetus"],
  [/\bpediatric\b/gi, "paediatric"],
  [/\banesthesia\b/gi, "anaesthesia"],
  [/\bhemoglobin\b/gi, "haemoglobin"],
  [/\besophagus\b/gi, "oesophagus"],
];

// ── Word count targets per phase ───────────────────────────────────────────

const WORD_COUNT_TARGETS: Record<number, { min: number; max: number }> = {
  2: { min: 500, max: 750 },
  3: { min: 150, max: 200 },
  4: { min: 2500, max: 3500 },
  5: { min: 1500, max: 2500 },
  6: { min: 1500, max: 2500 },
  7: { min: 2000, max: 2500 },
  8: { min: 500, max: 750 },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function countWords(latex: string): number {
  const plain = latex
    .replace(/\\[a-zA-Z]+\{[^}]*\}/g, " ")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[{}\\]/g, " ");
  return plain.split(/\s+/).filter(Boolean).length;
}

function stripLatexCommands(latex: string): string {
  return latex
    .replace(/\\[a-zA-Z]+\{[^}]*\}/g, " ")
    .replace(/\\[a-zA-Z]+/g, " ");
}

// ── Check implementations ──────────────────────────────────────────────────

function checkCitationProvenance(
  sections: Section[],
  citations: Citation[]
): QCCheck {
  const audit = auditCitations(sections, citations);
  const tierDCount = audit.tierDBlocking.length;

  if (tierDCount === 0) {
    return {
      name: "citation-provenance",
      status: "pass",
      blocking: true,
      message: `All citations verified (integrity score: ${audit.integrityScore}%)`,
      details: [],
    };
  }

  return {
    name: "citation-provenance",
    status: "fail",
    blocking: true,
    message: `${tierDCount} Tier D citation(s) remain unverified`,
    details: audit.tierDBlocking.map((d) => ({
      item: d.citeKey,
      message: `Used in phase(s): ${d.usedInPhases.join(", ")}`,
    })),
    fixAction: "re-resolve-citations",
  };
}

function checkSectionCompleteness(sections: Section[]): QCCheck {
  const details: QCDetail[] = [];
  const contentPhases = [2, 3, 4, 5, 6, 7, 8]; // Phases with word count targets

  for (const phase of contentPhases) {
    const section = sections.find((s) => s.phase_number === phase);
    if (!section || !section.latex_content) {
      details.push({
        item: `Phase ${phase}`,
        message: "Section missing or empty",
      });
      continue;
    }

    const target = WORD_COUNT_TARGETS[phase];
    if (!target) continue;

    const words = countWords(section.latex_content);
    if (words < target.min) {
      details.push({
        item: `Phase ${phase}`,
        message: `Word count (${words}) below minimum (${target.min})`,
      });
    }
  }

  if (details.length === 0) {
    return {
      name: "section-completeness",
      status: "pass",
      blocking: false,
      message: "All sections meet word count targets",
      details: [],
    };
  }

  return {
    name: "section-completeness",
    status: "warn",
    blocking: false,
    message: `${details.length} section(s) below word count target`,
    details,
    fixAction: "expand-section",
  };
}

function checkBritishEnglish(sections: Section[]): QCCheck {
  const details: QCDetail[] = [];

  for (const section of sections) {
    if (!section.latex_content || section.phase_number < 2 || section.phase_number > 8) continue;
    const prose = stripLatexCommands(section.latex_content);

    for (const [pattern, british] of AMERICAN_TO_BRITISH) {
      const match = pattern.exec(prose);
      if (match) {
        details.push({
          item: `Phase ${section.phase_number}`,
          message: `"${match[0]}" → "${british}"`,
        });
        pattern.lastIndex = 0;
      }
    }
  }

  if (details.length === 0) {
    return {
      name: "british-english",
      status: "pass",
      blocking: false,
      message: "No American English spellings detected",
      details: [],
    };
  }

  return {
    name: "british-english",
    status: "warn",
    blocking: false,
    message: `${details.length} American English spelling(s) found`,
    details,
    fixAction: "auto-fix-spelling",
  };
}

function checkNBEMSCompliance(sections: Section[]): QCCheck {
  const details: QCDetail[] = [];

  // 80-page limit: phases 2-8 only (~250 words/page)
  let totalWords = 0;
  for (const section of sections) {
    if (section.phase_number >= 2 && section.phase_number <= 8 && section.latex_content) {
      totalWords += countWords(section.latex_content);
    }
  }
  const estimatedPages = Math.ceil(totalWords / 250);
  if (estimatedPages > 80) {
    details.push({
      item: "Page count",
      message: `Estimated ${estimatedPages} pages (phases 2-8) — exceeds 80-page NBEMS limit`,
    });
  }

  // 300-word abstract limit
  const phase1 = sections.find((s) => s.phase_number === 1);
  if (phase1?.latex_content) {
    const abstractMatch = phase1.latex_content.match(
      /\\section\*?\{Abstract\}([\s\S]*?)(?=\\section|$)/i
    );
    if (abstractMatch) {
      const abstractWords = countWords(abstractMatch[1]);
      if (abstractWords > 300) {
        details.push({
          item: "Abstract",
          message: `Abstract is ${abstractWords} words (max 300)`,
        });
      }
    }
  }

  // M&M must have ≥12 sections
  const phase5 = sections.find((s) => s.phase_number === 5);
  if (phase5?.latex_content) {
    const sectionCount = (
      phase5.latex_content.match(/\\(section|subsection|subsubsection)\*?\{/g) ?? []
    ).length;
    if (sectionCount < 12) {
      details.push({
        item: "Materials & Methods",
        message: `Only ${sectionCount} section headings (NBEMS requires 12)`,
      });
    }
  }

  const blocking = details.some(
    (d) => d.item === "Page count" || d.item === "Materials & Methods"
  );

  if (details.length === 0) {
    return {
      name: "nbems-compliance",
      status: "pass",
      blocking: true,
      message: "NBEMS compliance checks passed",
      details: [],
    };
  }

  return {
    name: "nbems-compliance",
    status: blocking ? "fail" : "warn",
    blocking,
    message: `${details.length} NBEMS compliance issue(s)`,
    details,
  };
}

// ── Phase 6 Figure/Table QC (DECISIONS.md 5.3) ──────────────────────────

const MIN_FIGURES = 5;
const MIN_TABLES = 7;

function checkResultsFiguresAndTables(
  sections: Section[],
  figureCount: number,
  analysisTableCount: number,
): QCCheck {
  const details: QCDetail[] = [];

  if (figureCount < MIN_FIGURES) {
    details.push({
      item: "Figure count",
      message: `${figureCount} figure(s) — minimum ${MIN_FIGURES} required`,
    });
  }

  // Count LaTeX table environments in Results chapter content
  const resultsSection = sections.find((s) => s.phase_number === 6);
  const latexTableCount = (
    resultsSection?.latex_content?.match(
      /\\begin\{(table|longtable|tabular)\}/g
    ) ?? []
  ).length;
  const totalTables = analysisTableCount + latexTableCount;

  if (totalTables < MIN_TABLES) {
    details.push({
      item: "Table count",
      message: `${totalTables} table(s) — minimum ${MIN_TABLES} required`,
    });
  }

  if (details.length === 0) {
    return {
      name: "results-figures-tables",
      status: "pass",
      blocking: true,
      message: `Results has ${figureCount} figure(s) and ${totalTables} table(s) — meets minimums`,
      details: [],
    };
  }

  return {
    name: "results-figures-tables",
    status: "fail",
    blocking: true,
    message: `Results below figure/table minimums`,
    details,
  };
}

function checkUndefinedReferences(
  compileLog: string | null
): QCCheck {
  if (!compileLog) {
    return {
      name: "undefined-references",
      status: "pass",
      blocking: true,
      message: "No compile log available — compile first",
      details: [],
    };
  }

  const undefinedRefs = compileLog.match(/LaTeX Warning: Reference `([^']+)' on page/g) ?? [];
  const undefinedCites = compileLog.match(/LaTeX Warning: Citation `([^']+)' on page/g) ?? [];

  const details: QCDetail[] = [
    ...undefinedRefs.map((m) => ({
      item: "Undefined ref",
      message: m,
    })),
    ...undefinedCites.map((m) => ({
      item: "Undefined cite",
      message: m,
    })),
  ];

  if (details.length === 0) {
    return {
      name: "undefined-references",
      status: "pass",
      blocking: true,
      message: "No undefined references or citations",
      details: [],
    };
  }

  return {
    name: "undefined-references",
    status: "fail",
    blocking: true,
    message: `${details.length} undefined reference(s) or citation(s)`,
    details,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

export function finalQC(
  sections: Section[],
  citations: Citation[],
  compileLog: string | null = null,
  figureCount: number = 0,
  analysisTableCount: number = 0,
): QCReport {
  const checks: QCCheck[] = [
    checkCitationProvenance(sections, citations),
    checkSectionCompleteness(sections),
    checkBritishEnglish(sections),
    checkNBEMSCompliance(sections),
    checkUndefinedReferences(compileLog),
    checkResultsFiguresAndTables(sections, figureCount, analysisTableCount),
  ];

  const blockingCount = checks.filter(
    (c) => c.blocking && c.status === "fail"
  ).length;
  const warningCount = checks.filter((c) => c.status === "warn").length;

  return {
    checks,
    overallPass: blockingCount === 0,
    blockingCount,
    warningCount,
  };
}
