export interface Organisation {
  id: string;
  name: string;
  university_type: "wbuhs" | "ssuhs" | "generic";
  cls_config_json: Record<string, unknown>;
  logo_urls: Record<string, string>;
  created_at: string;
}

export interface User {
  id: string;
  clerk_user_id: string;
  email: string;
  name: string;
  role: "student" | "supervisor" | "admin";
  organisation_id: string | null;
  created_at: string;
}

export type LicencePlanType =
  | "student_monthly"
  | "professional_monthly"
  | "addon"
  | "one_time"
  | "institutional";

export type LicenceStatus = "available" | "active" | "expired" | "transferred";

export interface ThesisLicence {
  id: string;
  user_id: string;
  project_id: string | null;
  plan_type: LicencePlanType;
  status: LicenceStatus;
  candidate_name_hash: string | null;
  registration_no_hash: string | null;
  university: string | null;
  guide_name_hash: string | null;
  identity_locked_at: string | null;
  activated_at: string | null;
  expires_at: string | null;
  transfer_count: number;
  last_transferred_at: string | null;
  created_at: string;
}

export type ProjectStatus = "sandbox" | "licensed" | "completed" | "archived";
export type UniversityType = "wbuhs" | "ssuhs" | "generic";

export interface ProjectMetadata {
  candidate_name?: string;
  guide_name?: string;
  hod_name?: string;
  department?: string;
  degree?: string;
  speciality?: string;
  registration_no?: string;
  session?: string;
  year?: string;
  supervisor_user_id?: string;
}

export interface Project {
  id: string;
  user_id: string;
  organisation_id: string | null;
  status: ProjectStatus;
  license_id: string | null;
  title: string;
  synopsis_text: string | null;
  study_type: string | null;
  university_type: UniversityType | null;
  metadata_json: ProjectMetadata;
  current_phase: number;
  phases_completed: number[];
  created_at: string;
  updated_at: string;
}

export type SectionStatus = "draft" | "generating" | "review" | "approved";

export interface Section {
  id: string;
  project_id: string;
  phase_number: number;
  phase_name: string;
  latex_content: string;
  rich_content_json: Record<string, unknown> | null;
  ai_generated_latex: string | null;
  word_count: number;
  citation_keys: string[];
  status: SectionStatus;
  ai_conversation_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ProvenanceTier = "A" | "B" | "C" | "D";
export type EvidenceType = "doi" | "pmid" | "isbn" | "url" | "manual";

export interface Citation {
  id: string;
  project_id: string;
  cite_key: string;
  bibtex_entry: string;
  provenance_tier: ProvenanceTier;
  evidence_type: EvidenceType | null;
  evidence_value: string | null;
  source_doi: string | null;
  source_pmid: string | null;
  attested_by_user_id: string | null;
  attested_at: string | null;
  used_in_sections: string[];
  serial_number: number | null;
  verified_at: string | null;
  created_at: string;
}

export interface Dataset {
  id: string;
  project_id: string;
  file_url: string;
  row_count: number | null;
  columns_json: Record<string, unknown>[];
  rows_json: Record<string, unknown>[] | null;
  created_at: string;
}

export type AnalysisStatus = "pending" | "running" | "completed" | "failed";

export interface Analysis {
  id: string;
  project_id: string;
  dataset_id: string | null;
  analysis_type: string;
  parameters_json: Record<string, unknown>;
  results_json: Record<string, unknown>;
  figures_urls: string[];
  r_script: string | null;
  status: AnalysisStatus;
  created_at: string;
}

export type FigureSourceTool = "ggplot2" | "mermaid" | "tikz" | "upload";

export interface Figure {
  id: string;
  project_id: string;
  section_id: string | null;
  figure_type: string;
  source_tool: FigureSourceTool;
  source_code: string | null;
  file_url: string | null;
  caption: string;
  label: string;
  width_pct: number;
  dpi: number;
  format: "png" | "pdf" | "svg";
  created_at: string;
}

export type GuidelineType =
  | "CONSORT"
  | "STROBE"
  | "PRISMA"
  | "STARD"
  | "CARE";

export interface ComplianceCheck {
  id: string;
  project_id: string;
  guideline_type: GuidelineType;
  checklist_json: {
    item_id: string;
    description: string;
    status: string;
    section_ref: string | null;
    suggestion: string | null;
  }[];
  overall_score: number | null;
  last_checked_at: string;
}

export type CompilationStatus = "pending" | "running" | "completed" | "failed";

export interface Compilation {
  id: string;
  project_id: string;
  trigger: string;
  status: CompilationStatus;
  pdf_url: string | null;
  log_text: string | null;
  warnings: string[];
  errors: string[];
  compile_time_ms: number | null;
  created_at: string;
}

export interface AiConversation {
  id: string;
  project_id: string;
  phase_number: number;
  messages_json: Record<string, unknown>[];
  model_used: string;
  total_tokens: number;
  created_at: string;
}

export interface Abbreviation {
  id: string;
  project_id: string;
  short_form: string;
  long_form: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  project_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value_json: Record<string, unknown> | null;
  new_value_json: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}
