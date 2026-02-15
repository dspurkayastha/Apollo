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
          <h1 className="font-serif text-2xl tracking-tight text-[#2F2F2F]">
            Welcome to <span className="font-brand text-[1.725rem]">Apollo</span>
          </h1>
          <p className="text-[#6B6B6B]">
            AI assisted academic writing platform.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="rounded-full bg-[#2F2F2F] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#2F2F2F]/90"
        >
          New Project
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-black/[0.06] bg-white p-6 landing-card">
          <p className="font-serif text-sm font-medium text-[#6B6B6B]">Projects</p>
          <p className="mt-2 text-3xl font-bold text-[#2F2F2F]">{projectCount}</p>
        </div>
        <div className="rounded-2xl border border-black/[0.06] bg-white p-6 landing-card">
          <p className="font-serif text-sm font-medium text-[#6B6B6B]">Licences</p>
          <p className="mt-2 text-3xl font-bold text-[#2F2F2F]">{licenceCount}</p>
        </div>
      </div>

      {/* Recent projects */}
      <div>
        <h2 className="mb-4 font-serif text-lg text-[#2F2F2F]">Recent Projects</h2>
        {recentProjects.length === 0 ? (
          <div className="rounded-2xl border border-black/[0.06] bg-white p-8 text-center landing-card">
            <p className="text-[#6B6B6B]">
              No projects yet. Create your first thesis project.
            </p>
            <Link
              href="/projects/new"
              className="mt-4 inline-block rounded-full bg-[#2F2F2F] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#2F2F2F]/90"
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
                className="flex items-center justify-between rounded-2xl border border-black/[0.06] bg-white p-4 landing-card hover:border-black/[0.10]"
              >
                <div>
                  <p className="font-medium text-[#2F2F2F]">{project.title}</p>
                  <p className="text-sm text-[#6B6B6B]">
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
