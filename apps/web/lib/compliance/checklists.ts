import type { GuidelineType } from "@/lib/types/database";

export interface ChecklistItem {
  id: string;
  description: string;
  section_phases: number[];
  required: boolean;
}

export type Checklist = ChecklistItem[];

/**
 * CONSORT 2010 checklist for randomised controlled trials.
 * 25 items mapped to thesis phases.
 */
const CONSORT: Checklist = [
  { id: "C1a", description: "Identification as a randomised trial in the title", section_phases: [1], required: true },
  { id: "C1b", description: "Structured summary of trial design, methods, results, and conclusions", section_phases: [1], required: true },
  { id: "C2a", description: "Scientific background and explanation of rationale", section_phases: [2], required: true },
  { id: "C2b", description: "Specific objectives or hypotheses", section_phases: [3], required: true },
  { id: "C3a", description: "Description of trial design including allocation ratio", section_phases: [5], required: true },
  { id: "C3b", description: "Important changes to methods after trial commencement with reasons", section_phases: [5], required: false },
  { id: "C4a", description: "Eligibility criteria for participants", section_phases: [5], required: true },
  { id: "C4b", description: "Settings and locations where data were collected", section_phases: [5], required: true },
  { id: "C5", description: "Interventions for each group with sufficient detail", section_phases: [5], required: true },
  { id: "C6a", description: "Completely defined pre-specified primary and secondary outcome measures", section_phases: [5], required: true },
  { id: "C6b", description: "Any changes to trial outcomes after the trial commenced with reasons", section_phases: [5], required: false },
  { id: "C7a", description: "How sample size was determined", section_phases: [5], required: true },
  { id: "C7b", description: "When applicable, explanation of any interim analyses and stopping guidelines", section_phases: [5], required: false },
  { id: "C8a", description: "Method used to generate the random allocation sequence", section_phases: [5], required: true },
  { id: "C8b", description: "Type of randomisation; details of any restriction", section_phases: [5], required: true },
  { id: "C9", description: "Mechanism used to implement the random allocation sequence", section_phases: [5], required: true },
  { id: "C10", description: "Who generated the allocation sequence, who enrolled participants, who assigned participants", section_phases: [5], required: true },
  { id: "C11a", description: "If done, who was blinded after assignment to interventions and how", section_phases: [5], required: false },
  { id: "C11b", description: "If relevant, description of the similarity of interventions", section_phases: [5], required: false },
  { id: "C12a", description: "Statistical methods used to compare groups for primary and secondary outcomes", section_phases: [5], required: true },
  { id: "C12b", description: "Methods for additional analyses such as subgroup analyses", section_phases: [5], required: false },
  { id: "C13a", description: "Flow of participants through each stage (recommend a diagram)", section_phases: [6], required: true },
  { id: "C14a", description: "Dates defining the periods of recruitment and follow-up", section_phases: [6], required: true },
  { id: "C15", description: "Baseline demographic and clinical characteristics of each group", section_phases: [6], required: true },
  { id: "C17a", description: "For each primary and secondary outcome, results for each group and estimated effect size", section_phases: [6], required: true },
];

/**
 * STROBE checklist for observational studies (cohort, case-control, cross-sectional).
 * 22 items.
 */
const STROBE: Checklist = [
  { id: "S1a", description: "Indicate the study's design with a commonly used term in the title or abstract", section_phases: [1], required: true },
  { id: "S1b", description: "Provide an informative and balanced summary", section_phases: [1], required: true },
  { id: "S2", description: "Explain the scientific background and rationale for the investigation", section_phases: [2], required: true },
  { id: "S3", description: "State specific objectives including any pre-specified hypotheses", section_phases: [3], required: true },
  { id: "S4", description: "Present key elements of study design early in the paper", section_phases: [5], required: true },
  { id: "S5", description: "Describe the setting, locations, and relevant dates", section_phases: [5], required: true },
  { id: "S6a", description: "Give the eligibility criteria, and the sources and methods of selection", section_phases: [5], required: true },
  { id: "S7", description: "Clearly define all outcomes, exposures, predictors, potential confounders, and effect modifiers", section_phases: [5], required: true },
  { id: "S8", description: "For each variable, give sources of data and details of methods of assessment", section_phases: [5], required: true },
  { id: "S9", description: "Describe any efforts to address potential sources of bias", section_phases: [5], required: true },
  { id: "S10", description: "Explain how the study size was arrived at", section_phases: [5], required: true },
  { id: "S11", description: "Explain how quantitative variables were handled in the analyses", section_phases: [5], required: true },
  { id: "S12a", description: "Describe all statistical methods including those used to control for confounding", section_phases: [5], required: true },
  { id: "S12b", description: "Describe any methods used to examine subgroups and interactions", section_phases: [5], required: false },
  { id: "S12c", description: "Explain how missing data were addressed", section_phases: [5], required: true },
  { id: "S12d", description: "If applicable, describe analytical methods for loss to follow-up", section_phases: [5], required: false },
  { id: "S12e", description: "Describe any sensitivity analyses", section_phases: [5], required: false },
  { id: "S13", description: "Report numbers of individuals at each stage of study", section_phases: [6], required: true },
  { id: "S14", description: "Give characteristics of study participants and information on exposures and confounders", section_phases: [6], required: true },
  { id: "S15", description: "Report numbers of outcome events or summary measures", section_phases: [6], required: true },
  { id: "S16a", description: "Give unadjusted estimates and if applicable confounder-adjusted estimates", section_phases: [6], required: true },
  { id: "S18", description: "Summarise key results with reference to study objectives", section_phases: [7], required: true },
];

/**
 * PRISMA 2020 checklist for systematic reviews and meta-analyses.
 * 27 items.
 */
const PRISMA: Checklist = [
  { id: "P1", description: "Identify the report as a systematic review", section_phases: [1], required: true },
  { id: "P2", description: "Provide a structured summary including objectives, data sources, eligibility criteria, and results", section_phases: [1], required: true },
  { id: "P3", description: "Describe the rationale for the review in the context of existing knowledge", section_phases: [2], required: true },
  { id: "P4", description: "Provide an explicit statement of the review question using PICO", section_phases: [3], required: true },
  { id: "P5", description: "Indicate if a review protocol exists", section_phases: [5], required: true },
  { id: "P6", description: "Specify the eligibility criteria (inclusion/exclusion)", section_phases: [5], required: true },
  { id: "P7", description: "Describe all information sources with dates of last search", section_phases: [5], required: true },
  { id: "P8", description: "Present full electronic search strategy for at least one database", section_phases: [5], required: true },
  { id: "P9", description: "State the process for selecting studies", section_phases: [5], required: true },
  { id: "P10", description: "Describe method of data extraction from reports", section_phases: [5], required: true },
  { id: "P11", description: "List and define all variables for which data were sought", section_phases: [5], required: true },
  { id: "P12", description: "Describe methods used for assessing risk of bias of individual studies", section_phases: [5], required: true },
  { id: "P13", description: "State the principal summary measures", section_phases: [5], required: true },
  { id: "P14", description: "Describe the methods of handling data and combining results of studies", section_phases: [5], required: true },
  { id: "P15", description: "Specify any assessment of risk of bias that may affect the cumulative evidence", section_phases: [5], required: false },
  { id: "P16", description: "Describe methods of additional analyses if done", section_phases: [5], required: false },
  { id: "P17", description: "Give numbers of studies screened, assessed for eligibility, and included (PRISMA flow diagram)", section_phases: [4, 6], required: true },
  { id: "P18", description: "For each study, present characteristics and cite the source", section_phases: [4, 6], required: true },
  { id: "P19", description: "Present data on risk of bias for each study", section_phases: [6], required: true },
  { id: "P20", description: "For all outcomes, present for each study simple summary data and effect estimates with CIs", section_phases: [6], required: true },
  { id: "P21", description: "Present results of each meta-analysis done with CIs and measures of consistency", section_phases: [6], required: true },
  { id: "P22", description: "Present results of any assessment of risk of bias across studies", section_phases: [6], required: false },
  { id: "P23", description: "Give results of additional analyses if done", section_phases: [6], required: false },
  { id: "P24", description: "Summarise the main findings including the strength of evidence", section_phases: [7], required: true },
  { id: "P25", description: "Discuss limitations at study and outcome level", section_phases: [7], required: true },
  { id: "P26", description: "Provide a general interpretation of the results and implications for future research", section_phases: [7, 8], required: true },
  { id: "P27", description: "Describe sources of funding for the systematic review", section_phases: [5], required: false },
];

/**
 * STARD 2015 checklist for diagnostic accuracy studies.
 * 30 items.
 */
const STARD: Checklist = [
  { id: "D1", description: "Identification as a study of diagnostic accuracy using at least one measure of accuracy", section_phases: [1], required: true },
  { id: "D2", description: "Structured summary including study design, methods, results, and conclusions", section_phases: [1], required: true },
  { id: "D3", description: "Scientific and clinical background; intended use and clinical role of the index test", section_phases: [2], required: true },
  { id: "D4", description: "Study objectives and hypotheses", section_phases: [3], required: true },
  { id: "D5", description: "Whether data collection was planned before the index test and reference standard were performed", section_phases: [5], required: true },
  { id: "D6", description: "Eligibility criteria", section_phases: [5], required: true },
  { id: "D7", description: "On what basis potentially eligible participants were identified", section_phases: [5], required: true },
  { id: "D8", description: "Where and when potentially eligible participants were identified", section_phases: [5], required: true },
  { id: "D9", description: "Whether participants formed a consecutive, random, or convenience series", section_phases: [5], required: true },
  { id: "D10a", description: "Index test, in sufficient detail to allow replication", section_phases: [5], required: true },
  { id: "D10b", description: "Reference standard, in sufficient detail to allow replication", section_phases: [5], required: true },
  { id: "D11", description: "Rationale for choosing the reference standard", section_phases: [5], required: true },
  { id: "D12a", description: "Definition of and rationale for test positivity cut-offs or result categories of the index test", section_phases: [5], required: true },
  { id: "D12b", description: "Definition of and rationale for test positivity cut-offs of the reference standard", section_phases: [5], required: true },
  { id: "D13a", description: "Whether clinical information and reference standard results were available to index test performers", section_phases: [5], required: true },
  { id: "D13b", description: "Whether clinical information and index test results were available to reference standard assessors", section_phases: [5], required: true },
  { id: "D14", description: "Methods for estimating or comparing measures of diagnostic accuracy", section_phases: [5], required: true },
  { id: "D15", description: "How indeterminate index test or reference standard results were handled", section_phases: [5], required: true },
  { id: "D16", description: "How missing data on the index test and reference standard were handled", section_phases: [5], required: true },
  { id: "D17", description: "Any analyses of variability in diagnostic accuracy", section_phases: [5], required: false },
  { id: "D18", description: "Intended sample size and how it was determined", section_phases: [5], required: true },
  { id: "D19", description: "Flow of participants using a diagram", section_phases: [6], required: true },
  { id: "D20", description: "Baseline demographics of the study participants", section_phases: [6], required: true },
  { id: "D21a", description: "Distribution of severity of disease in those with the target condition", section_phases: [6], required: true },
  { id: "D21b", description: "Distribution of alternative diagnoses in those without the target condition", section_phases: [6], required: false },
  { id: "D22", description: "Time interval and any clinical interventions between index test and reference standard", section_phases: [6], required: true },
  { id: "D23", description: "Cross tabulation of the index test results by the reference standard results", section_phases: [6], required: true },
  { id: "D24", description: "Estimates of diagnostic accuracy and their precision", section_phases: [6], required: true },
  { id: "D25", description: "Any adverse events from performing the index test or reference standard", section_phases: [6], required: false },
  { id: "D26", description: "Study limitations including sources of potential bias and applicability", section_phases: [7], required: true },
];

/**
 * CARE checklist for case reports.
 * 13 items.
 */
const CARE: Checklist = [
  { id: "CR1", description: "Title — the words 'case report' and the area of focus", section_phases: [1], required: true },
  { id: "CR2", description: "Keywords — 2 to 5 keywords identifying this case", section_phases: [1], required: true },
  { id: "CR3a", description: "Abstract — Introduction: what is unique about this case?", section_phases: [1], required: true },
  { id: "CR3b", description: "Abstract — Main symptoms, clinical findings, diagnoses, interventions, outcomes", section_phases: [1], required: true },
  { id: "CR3c", description: "Abstract — Conclusion and main 'take-away' lessons", section_phases: [1], required: true },
  { id: "CR4", description: "Introduction — Brief background summary of this case referencing the relevant medical literature", section_phases: [2], required: true },
  { id: "CR5a", description: "Patient information — demographics, main symptoms, medical history", section_phases: [6], required: true },
  { id: "CR5b", description: "Clinical findings — physical examination findings", section_phases: [6], required: true },
  { id: "CR5c", description: "Timeline — important dates and times in this case", section_phases: [6], required: true },
  { id: "CR5d", description: "Diagnostic assessment — methods and challenges, reasoning including differentials", section_phases: [6], required: true },
  { id: "CR6", description: "Therapeutic intervention — types of intervention, administration, and duration", section_phases: [6], required: true },
  { id: "CR7", description: "Follow-up and outcomes — summary and outcomes at follow-up", section_phases: [6], required: true },
  { id: "CR8", description: "Discussion — strengths and limitations of this case; relevant medical literature; rationale for conclusions; main 'take-away' lessons", section_phases: [7], required: true },
];

/** All checklists indexed by guideline type */
const CHECKLISTS: Record<GuidelineType, Checklist> = {
  CONSORT,
  STROBE,
  PRISMA,
  STARD,
  CARE,
};

/**
 * Get the checklist for a given guideline type.
 */
export function getChecklist(guidelineType: GuidelineType): Checklist {
  return CHECKLISTS[guidelineType];
}

/**
 * Get all available guideline types.
 */
export function getAvailableGuidelines(): GuidelineType[] {
  return Object.keys(CHECKLISTS) as GuidelineType[];
}
