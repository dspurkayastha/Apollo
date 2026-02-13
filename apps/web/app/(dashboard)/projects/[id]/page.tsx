import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { projectStatusClasses, relativeTime } from "@/lib/format";
import type { Project } from "@/lib/types/database";

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
  const metadata = project.metadata_json ?? {};
  const metadataEntries = Object.entries(metadata).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );

  return (
    <div className="space-y-8">
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
            <span>Phase {project.current_phase}</span>
            <span>&middot;</span>
            <span>Updated {relativeTime(project.updated_at)}</span>
          </div>
        </div>

        {project.current_phase === 0 && (
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
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Project Metadata</h2>
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
      )}

      {/* Editor placeholder */}
      <div className="rounded-lg border bg-card p-12 text-center">
        <p className="text-muted-foreground">
          Section editor coming in Sprint 3-4
        </p>
      </div>
    </div>
  );
}
