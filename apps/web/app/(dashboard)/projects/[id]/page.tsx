import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { projectStatusClasses, relativeTime } from "@/lib/format";
import type { Project, Section } from "@/lib/types/database";
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
          <h1 className="text-2xl font-bold tracking-tight">
            {project.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${projectStatusClasses(project.status)}`}
            >
              {project.status}
            </span>
            {project.university_type && (
              <span>
                University type:{" "}
                <span className="font-medium">{project.university_type}</span>
              </span>
            )}
            {project.study_type && (
              <span>
                Study type:{" "}
                <span className="font-medium">{project.study_type}</span>
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
            className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            Continue Setup
          </Link>
        )}
      </div>

      {/* Metadata */}
      {metadataEntries.length > 0 && (
        <details className="rounded-lg border bg-card">
          <summary className="cursor-pointer p-4 text-sm font-semibold">
            Project Metadata ({metadataEntries.length} fields)
          </summary>
          <div className="border-t px-4 pb-4 pt-3">
            <dl className="grid gap-3 sm:grid-cols-2">
              {metadataEntries.map(([key, value]) => (
                <div key={key}>
                  <dt className="text-sm font-medium text-muted-foreground capitalize">
                    {key.replace(/_/g, " ")}
                  </dt>
                  <dd className="mt-0.5 text-sm">{String(value)}</dd>
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
      />
    </div>
  );
}
