import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { relativeTime, projectStatusClasses } from "@/lib/format";
import type { Project } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  const projects = (data ?? []) as Project[];

  if (error) {
    console.error("Failed to fetch projects:", error);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <Link
          href="/projects/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-lg font-medium">No projects yet</p>
          <p className="mt-1 text-muted-foreground">
            Create your first thesis project.
          </p>
          <Link
            href="/projects/new"
            className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            New Project
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="group rounded-lg border bg-card p-5 transition-colours hover:bg-accent"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold leading-tight group-hover:text-accent-foreground">
                  {project.title}
                </h2>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${projectStatusClasses(project.status)}`}
                >
                  {project.status}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
                <span>Phase {project.current_phase}</span>
                <span>&middot;</span>
                <span>{relativeTime(project.updated_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
