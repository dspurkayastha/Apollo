"use client";

import Link from "next/link";
import { useCallback, useRef } from "react";
import { DeleteProjectButton } from "@/components/project/delete-project-button";

interface ProjectCardProps {
  project: {
    id: string;
    title: string;
    status: string;
    current_phase: number;
    updated_at: string;
  };
  statusClasses: string;
  relativeTime: string;
}

export function ProjectCard({ project, statusClasses, relativeTime }: ProjectCardProps) {
  const cardRef = useRef<HTMLAnchorElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  }, []);

  return (
    <Link
      ref={cardRef}
      href={`/projects/${project.id}`}
      onMouseMove={handleMouseMove}
      className="group relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-5 zen-shadow-card transition-[border-color,box-shadow] duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[#8B9D77]/30 hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)]"
    >
      {/* Cursor-tracking sage glow overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(139,157,119,0.15) 0%, rgba(139,157,119,0.12) 20%, rgba(139,157,119,0.06) 40%, transparent 80%)",
        }}
      />

      {/* Content — relative to sit above the glow */}
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-serif font-semibold leading-tight text-[#2F2F2F]">
            {project.title}
          </h2>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses}`}
            >
              {project.status}
            </span>
            <DeleteProjectButton
              projectId={project.id}
              projectTitle={project.title}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 text-sm text-[#6B6B6B]">
          <span>Phase {project.current_phase}</span>
          <span>&middot;</span>
          <span>{relativeTime}</span>
        </div>
      </div>
    </Link>
  );
}
