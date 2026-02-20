export interface ParsedSynopsis {
  title: string | null;
  aims: string[];
  objectives: string[];
  study_type: string | null;
  study_design: string | null;
  sample_size: number | null;
  inclusion_criteria: string[];
  exclusion_criteria: string[];
  methodology_summary: string | null;
  department: string | null;
  duration: string | null;
  setting: string | null;
  keywords: string[] | null;
  candidate_name: string | null;
  registration_no: string | null;
  guide_name: string | null;
  co_guide_name: string | null;
  institute_name: string | null;
  university_name: string | null;
}

const STUDY_TYPE_PATTERNS: [RegExp, string][] = [
  [/\brandomised?\s+control(?:led)?\s+trial\b/i, "Randomised Controlled Trial"],
  [/\brct\b/i, "Randomised Controlled Trial"],
  [/\bcohort\b/i, "Cohort Study"],
  [/\bcase[\s-]control\b/i, "Case-Control Study"],
  [/\bcross[\s-]sectional\b/i, "Cross-Sectional Study"],
  [/\bprospective\b/i, "Prospective Study"],
  [/\bretrospective\b/i, "Retrospective Study"],
  [/\bobservational\b/i, "Observational Study"],
  [/\bmeta[\s-]analysis\b/i, "Meta-Analysis"],
  [/\bsystematic\s+review\b/i, "Systematic Review"],
  [/\bcase\s+series\b/i, "Case Series"],
  [/\bcase\s+report\b/i, "Case Report"],
  [/\bdescriptive\b/i, "Descriptive Study"],
  [/\banalytical\b/i, "Analytical Study"],
  [/\bexperimental\b/i, "Experimental Study"],
  [/\bquasi[\s-]experimental\b/i, "Quasi-Experimental Study"],
  [/\blongitudinal\b/i, "Longitudinal Study"],
];

export function parseSynopsis(text: string): ParsedSynopsis {
  const result: ParsedSynopsis = {
    title: null,
    aims: [],
    objectives: [],
    study_type: null,
    study_design: null,
    sample_size: null,
    inclusion_criteria: [],
    exclusion_criteria: [],
    methodology_summary: null,
    department: null,
    duration: null,
    setting: null,
    keywords: null,
    candidate_name: null,
    registration_no: null,
    guide_name: null,
    co_guide_name: null,
    institute_name: null,
    university_name: null,
  };

  // Extract title — usually the first substantial line or after "TITLE:" header
  const titleMatch = text.match(
    /(?:title\s*[:—–-]\s*)([\s\S]*?)(?:\n\s*\n|\n(?=[A-Z]{2,}))/i
  );
  if (titleMatch) {
    result.title = titleMatch[1].trim().replace(/\s+/g, " ");
  } else {
    // First non-empty line as fallback
    const lines = text.split("\n").filter((l) => l.trim().length > 10);
    if (lines.length > 0) {
      result.title = lines[0].trim();
    }
  }

  // Extract aims
  const aimSection = text.match(
    /(?:aims?\s*(?:and\s*objectives?)?|objectives?\s*(?:and\s*aims?)?)\s*[:—–-]?\s*([\s\S]*?)(?:\n\s*\n|\n(?=(?:material|method|study\s*design|inclusion|sample|introduction)[:\s]))/i
  );
  if (aimSection) {
    const items = aimSection[1]
      .split(/\n/)
      .map((l) => l.replace(/^[\s•\-\d.)+]+/, "").trim())
      .filter((l) => l.length > 5);
    result.aims = items.slice(0, 10);
  }

  // Detect study type
  result.study_type = detectStudyType(text);

  // Extract sample size
  const sampleMatch = text.match(
    /(?:sample\s*size|total\s*(?:of\s*)?(?:number|no\.?|n)\s*(?:of\s*)?(?:patients?|subjects?|participants?|cases?))\s*[:=—–-]?\s*(\d+)/i
  );
  if (sampleMatch) {
    result.sample_size = parseInt(sampleMatch[1], 10);
  } else {
    // Try "n = 50" pattern
    const nMatch = text.match(/\bn\s*=\s*(\d+)/i);
    if (nMatch) {
      result.sample_size = parseInt(nMatch[1], 10);
    }
  }

  // Inclusion criteria
  const inclusionSection = text.match(
    /inclusion\s*criteria\s*[:—–-]?\s*([\s\S]*?)(?:exclusion|methodology|material|sample\s*size|\n\s*\n)/i
  );
  if (inclusionSection) {
    result.inclusion_criteria = inclusionSection[1]
      .split(/\n/)
      .map((l) => l.replace(/^[\s•\-\d.)+]+/, "").trim())
      .filter((l) => l.length > 3);
  }

  // Exclusion criteria
  const exclusionSection = text.match(
    /exclusion\s*criteria\s*[:—–-]?\s*([\s\S]*?)(?:methodology|material|statistical|sample\s*size|outcome|\n\s*\n)/i
  );
  if (exclusionSection) {
    result.exclusion_criteria = exclusionSection[1]
      .split(/\n/)
      .map((l) => l.replace(/^[\s•\-\d.)+]+/, "").trim())
      .filter((l) => l.length > 3);
  }

  return result;
}

export function detectStudyType(text: string): string | null {
  for (const [pattern, label] of STUDY_TYPE_PATTERNS) {
    if (pattern.test(text)) {
      return label;
    }
  }
  return null;
}
