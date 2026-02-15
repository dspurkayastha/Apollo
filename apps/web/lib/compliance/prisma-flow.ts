import type { Section } from "@/lib/types/database";

export interface PRISMAFlowCounts {
  identified: number;
  duplicatesRemoved: number;
  screened: number;
  excludedScreening: number;
  fullTextAssessed: number;
  excludedFullText: number;
  includedQualitative: number;
  includedQuantitative: number;
}

/**
 * Extract PRISMA flow numbers from ROL section content using regex heuristics.
 * Falls back to placeholder values if numbers cannot be extracted.
 */
export function extractPRISMACounts(sections: Section[]): PRISMAFlowCounts {
  const rolSection = sections.find((s) => s.phase_number === 4);
  const content = (rolSection?.latex_content ?? "").toLowerCase();

  const defaults: PRISMAFlowCounts = {
    identified: 0,
    duplicatesRemoved: 0,
    screened: 0,
    excludedScreening: 0,
    fullTextAssessed: 0,
    excludedFullText: 0,
    includedQualitative: 0,
    includedQuantitative: 0,
  };

  if (!content) return defaults;

  // Try to extract numbers from common PRISMA-style phrases
  const extractNumber = (patterns: RegExp[]): number => {
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match?.[1]) return parseInt(match[1], 10);
    }
    return 0;
  };

  return {
    identified: extractNumber([
      /(\d+)\s*(?:records?|articles?|studies?)\s*(?:were\s*)?identified/,
      /identified\s*(?:a\s*total\s*of\s*)?(\d+)/,
      /initial\s*search\s*(?:yielded|returned|found)\s*(\d+)/,
    ]),
    duplicatesRemoved: extractNumber([
      /(\d+)\s*duplicates?\s*(?:were\s*)?removed/,
      /remov(?:ed|ing)\s*(\d+)\s*duplicates?/,
      /after\s*(?:removing|removal\s*of)\s*(\d+)\s*duplicates?/,
    ]),
    screened: extractNumber([
      /(\d+)\s*(?:records?|articles?|titles?)\s*(?:were\s*)?screened/,
      /screened\s*(\d+)/,
    ]),
    excludedScreening: extractNumber([
      /(\d+)\s*(?:records?|articles?)\s*excluded\s*(?:during|at|after|based\s*on)\s*(?:screening|title|abstract)/,
      /excluded\s*(\d+)\s*(?:based\s*on|after)\s*(?:title|abstract|screening)/,
    ]),
    fullTextAssessed: extractNumber([
      /(\d+)\s*full[\s-]?text\s*(?:articles?|records?)?\s*(?:were\s*)?assessed/,
      /(\d+)\s*(?:articles?|records?)\s*(?:were\s*)?assessed\s*(?:for)?\s*eligibility/,
      /assessed\s*(\d+)\s*full[\s-]?text/,
    ]),
    excludedFullText: extractNumber([
      /(\d+)\s*full[\s-]?text\s*(?:articles?|records?)?\s*(?:were\s*)?excluded/,
      /(\d+)\s*(?:articles?|records?)\s*(?:were\s*)?excluded\s*(?:after|during|with)/,
      /excluded\s*(\d+)\s*(?:after|during)\s*full[\s-]?text/,
    ]),
    includedQualitative: extractNumber([
      /(\d+)\s*(?:studies?|articles?)\s*(?:were\s*)?included\s*(?:in\s*)?(?:the\s*)?qualitative/,
      /qualitative\s*(?:synthesis|analysis|review).*?(\d+)/,
    ]),
    includedQuantitative: extractNumber([
      /(\d+)\s*(?:studies?|articles?)\s*(?:were\s*)?included\s*(?:in\s*)?(?:the\s*)?(?:quantitative|meta[\s-]?analysis)/,
      /meta[\s-]?analysis.*?(\d+)\s*(?:studies?|articles?)/,
    ]),
  };
}

/**
 * Generate a PRISMA 2020 flow diagram as Mermaid syntax.
 *
 * Produces a standard 4-stage flow: Identification → Screening → Eligibility → Included.
 * Numbers are auto-extracted from ROL section when available, otherwise show placeholders.
 */
export function generatePRISMAFlowMermaid(sections: Section[]): string {
  const counts = extractPRISMACounts(sections);

  const n = (val: number): string => (val > 0 ? String(val) : "n");

  return `flowchart TD
    A["Records identified through\\ndatabase searching\\n(n = ${n(counts.identified)})"] --> C["Records after duplicates removed\\n(n = ${n(counts.identified - counts.duplicatesRemoved || 0)})"]
    B["Additional records identified\\nthrough other sources\\n(n = 0)"] --> C
    C --> D["Records screened\\n(n = ${n(counts.screened || counts.identified - counts.duplicatesRemoved || 0)})"]
    D --> E["Records excluded\\n(n = ${n(counts.excludedScreening)})"]
    D --> F["Full-text articles\\nassessed for eligibility\\n(n = ${n(counts.fullTextAssessed)})"]
    F --> G["Full-text articles excluded\\n(n = ${n(counts.excludedFullText)})"]
    F --> H["Studies included in\\nqualitative synthesis\\n(n = ${n(counts.includedQualitative)})"]
    H --> I["Studies included in\\nquantitative synthesis\\n(meta-analysis)\\n(n = ${n(counts.includedQuantitative)})"]

    style A fill:#e1f5fe,stroke:#0288d1
    style B fill:#e1f5fe,stroke:#0288d1
    style C fill:#fff3e0,stroke:#f57c00
    style D fill:#fff3e0,stroke:#f57c00
    style E fill:#ffebee,stroke:#c62828
    style F fill:#e8f5e9,stroke:#2e7d32
    style G fill:#ffebee,stroke:#c62828
    style H fill:#e8f5e9,stroke:#2e7d32
    style I fill:#e8f5e9,stroke:#2e7d32`;
}
