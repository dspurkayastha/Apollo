import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { relativeTime, projectStatusClasses } from "@/lib/format";
import type { Project } from "@/lib/types/database";
import { DeleteProjectButton } from "@/components/project/delete-project-button";
import { TemplateGallery } from "@/components/project/template-gallery";
import { ProjectCard } from "./project-card";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  const projects = (data ?? []) as Project[];

  if (error) {
    console.error("Failed to fetch projects:", error);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl tracking-tight text-[#2F2F2F]">Projects</h1>
        <Link
          href="/projects/new"
          className="rounded-full bg-[#2F2F2F] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#2F2F2F]/90"
        >
          New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="space-y-8">
          <div className="rounded-2xl border border-black/[0.06] bg-white p-12 text-center landing-card">
            <p className="font-serif text-lg font-medium text-[#2F2F2F]">No projects yet</p>
            <p className="mt-1 text-[#6B6B6B]">
              Create your first thesis project.
            </p>
            <Link
              href="/projects/new"
              className="mt-6 inline-block rounded-full bg-[#2F2F2F] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#2F2F2F]/90"
            >
              New Project
            </Link>
          </div>
          <TemplateGallery />
        </div>
      ) : (
        <div className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={{
                id: project.id,
                title: project.title,
                status: project.status,
                current_phase: project.current_phase,
                updated_at: project.updated_at,
              }}
              statusClasses={projectStatusClasses(project.status)}
              relativeTime={relativeTime(project.updated_at)}
            />
          ))}
        </div>

        <TemplateGallery />
        </div>
      )}
    </div>
  );
}
