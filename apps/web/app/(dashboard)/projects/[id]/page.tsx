import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { projectStatusClasses, relativeTime } from "@/lib/format";
import type {
  Project,
  Section,
  Citation,
  Dataset,
  Analysis,
  Figure,
  ComplianceCheck,
} from "@/lib/types/database";
import { PHASES } from "@/lib/phases/constants";
import { ProjectWorkspace } from "./project-workspace";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  const project = data as Project;

  // Fetch sections for this project
  const { data: sectionsData } = await supabase
    .from("sections")
    .select("*")
    .eq("project_id", id)
    .order("phase_number", { ascending: true });

  const sections = (sectionsData ?? []) as Section[];

  // Fetch citations for this project
  const { data: citationsData } = await supabase
    .from("citations")
    .select("*")
    .eq("project_id", id)
    .order("serial_number", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const citations = (citationsData ?? []) as Citation[];

  // Fetch datasets
  const { data: datasetsData } = await supabase
    .from("datasets")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  const datasets = (datasetsData ?? []) as Dataset[];

  // Fetch analyses
  const { data: analysesData } = await supabase
    .from("analyses")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  const analyses = (analysesData ?? []) as Analysis[];

  // Fetch figures
  const { data: figuresData } = await supabase
    .from("figures")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  const figures = (figuresData ?? []) as Figure[];

  // Fetch compliance checks
  const { data: complianceData } = await supabase
    .from("compliance_checks")
    .select("*")
    .eq("project_id", id)
    .order("last_checked_at", { ascending: false });

  const complianceChecks = (complianceData ?? []) as ComplianceCheck[];

  // Check if there's a successful compilation for PDF preview
  const { data: latestCompilation } = await supabase
    .from("compilations")
    .select("pdf_url")
    .eq("project_id", id)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const latestPdfUrl = latestCompilation?.pdf_url
    ? `/api/projects/${id}/preview.pdf`
    : null;

  const metadata = project.metadata_json ?? {};
  const metadataEntries = Object.entries(metadata).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );

  const currentPhaseDef = PHASES.find((p) => p.number === project.current_phase);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-serif text-2xl tracking-tight text-[#2F2F2F]">
            {project.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[#6B6B6B]">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${projectStatusClasses(project.status)}`}
            >
              {project.status}
            </span>
            {project.university_type && (
              <span>
                University type:{" "}
                <span className="font-medium text-[#2F2F2F]">{project.university_type}</span>
              </span>
            )}
            {project.study_type && (
              <span>
                Study type:{" "}
                <span className="font-medium text-[#2F2F2F]">{project.study_type}</span>
              </span>
            )}
            <span>Phase {project.current_phase}: {currentPhaseDef?.label ?? "Unknown"}</span>
            <span>&middot;</span>
            <span>Updated {relativeTime(project.updated_at)}</span>
          </div>
        </div>

        {project.current_phase === 0 && !sections.some((s) => s.phase_number === 0) && (
          <Link
            href={`/projects/${project.id}/setup`}
            className="shrink-0 rounded-full bg-[#2F2F2F] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#2F2F2F]/90"
          >
            Continue Setup
          </Link>
        )}
      </div>

      {/* Metadata */}
      {metadataEntries.length > 0 && (
        <details className="rounded-2xl border border-black/[0.06] bg-white landing-card">
          <summary className="cursor-pointer p-4 text-sm font-semibold text-[#2F2F2F]">
            Project Metadata ({metadataEntries.length} fields)
          </summary>
          <div className="border-t border-black/[0.06] px-4 pb-4 pt-3">
            <dl className="grid gap-3 sm:grid-cols-2">
              {metadataEntries.map(([key, value]) => (
                <div key={key}>
                  <dt className="text-sm font-medium capitalize text-[#6B6B6B]">
                    {key.replace(/_/g, " ")}
                  </dt>
                  <dd className="mt-0.5 text-sm text-[#2F2F2F]">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </details>
      )}

      {/* Phase Navigation + Section Viewer */}
      <ProjectWorkspace
        project={project}
        sections={sections}
        citations={citations}
        datasets={datasets}
        analyses={analyses}
        figures={figures}
        complianceChecks={complianceChecks}
        latestPdfUrl={latestPdfUrl}
        devLicenceBypass={process.env.DEV_LICENCE_BYPASS === "true"}
      />
    </div>
  );
}
