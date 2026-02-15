import type { Section } from "@/lib/types/database";

export interface NBEMSResult {
  page_count: number;
  page_limit: 80;
  page_within_limit: boolean;
  abstract_word_count: number;
  abstract_limit: 300;
  abstract_within_limit: boolean;
  pico_elements: {
    patient: boolean;
    intervention: boolean;
    comparison: boolean;
    outcome: boolean;
  };
  pico_score: number;
}

const WORDS_PER_PAGE = 250;

/**
 * Check NBEMS thesis requirements:
 * - 80-page limit (phases 2-8)
 * - 300-word abstract limit (phase 1)
 * - PICO elements in Introduction (phase 2)
 */
export function checkNBEMS(sections: Section[]): NBEMSResult {
  // Page count: sum word counts for phases 2-8, divide by ~250 words/page
  const contentPhases = sections.filter(
    (s) => s.phase_number >= 2 && s.phase_number <= 8
  );
  const totalWords = contentPhases.reduce(
    (sum, s) => sum + (s.word_count || 0),
    0
  );
  const pageCount = Math.ceil(totalWords / WORDS_PER_PAGE);

  // Abstract word count: check phase 1
  const frontMatter = sections.find((s) => s.phase_number === 1);
  let abstractWordCount = 0;
  if (frontMatter?.latex_content) {
    // Try to extract abstract section specifically
    const abstractMatch = frontMatter.latex_content.match(
      /\\section\*?\{Abstract\}([\s\S]*?)(?=\\section|$)/i
    );
    const abstractText = abstractMatch
      ? abstractMatch[1]!
      : frontMatter.latex_content;
    // Strip LaTeX commands for word counting
    const plainText = abstractText
      .replace(/\\[a-zA-Z]+(\{[^}]*\}|\[[^\]]*\])*/g, " ")
      .replace(/[{}\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    abstractWordCount = plainText.split(/\s+/).filter(Boolean).length;
  }

  // PICO elements in Introduction (phase 2)
  const introduction = sections.find((s) => s.phase_number === 2);
  const introText = (introduction?.latex_content ?? "").toLowerCase();

  const picoElements = {
    patient: /\b(patients?|population|participants?|subjects?|samples?)\b/.test(introText),
    intervention: /\b(intervention|treatment|therapy|procedure|methods?|technique)\b/.test(introText),
    comparison: /\b(compar|control|placebo|versus|vs\.?|standard)\b/.test(introText),
    outcome: /\b(outcomes?|results?|endpoints?|measures?|efficacy|effectiveness)\b/.test(introText),
  };

  const picoScore = Object.values(picoElements).filter(Boolean).length;

  return {
    page_count: pageCount,
    page_limit: 80,
    page_within_limit: pageCount <= 80,
    abstract_word_count: abstractWordCount,
    abstract_limit: 300,
    abstract_within_limit: abstractWordCount <= 300,
    pico_elements: picoElements,
    pico_score: picoScore,
  };
}
