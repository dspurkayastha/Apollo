import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/format";
import type { Project } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();

  // Fetch counts and recent projects in parallel
  const [projectCountResult, licenceCountResult, recentProjectsResult] =
    await Promise.all([
      supabase
        .from("projects")
        .select("*", { count: "exact", head: true }),
      supabase
        .from("thesis_licenses")
        .select("*", { count: "exact", head: true }),
      supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(5),
    ]);

  const projectCount = projectCountResult.count ?? 0;
  const licenceCount = licenceCountResult.count ?? 0;
  const recentProjects = (recentProjectsResult.data ?? []) as Project[];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome to Apollo
          </h1>
          <p className="text-muted-foreground">
            Your AI-powered thesis generation dashboard.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          New Project
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Projects</p>
          <p className="mt-2 text-3xl font-bold">{projectCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Licences</p>
          <p className="mt-2 text-3xl font-bold">{licenceCount}</p>
        </div>
      </div>

      {/* Recent projects */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Recent Projects</h2>
        {recentProjects.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground">
              No projects yet. Create your first thesis project.
            </p>
            <Link
              href="/projects/new"
              className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              New Project
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colours hover:bg-accent"
              >
                <div>
                  <p className="font-medium">{project.title}</p>
                  <p className="text-sm text-muted-foreground">
                    Phase {project.current_phase} &middot;{" "}
                    {relativeTime(project.updated_at)}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    project.status === "sandbox"
                      ? "bg-yellow-100 text-yellow-800"
                      : project.status === "licensed"
                        ? "bg-blue-100 text-blue-800"
                        : project.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {project.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
