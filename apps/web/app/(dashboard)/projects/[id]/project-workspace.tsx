"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Project, Section } from "@/lib/types/database";
import { PHASES } from "@/lib/phases/constants";
import { PhaseStepper } from "@/components/project/phase-stepper";
import { SectionViewer } from "@/components/project/section-viewer";
import { CompileButton } from "@/components/project/compile-button";
import { LicenceBanner } from "@/components/project/licence-banner";
import { AIGenerateButton } from "@/components/project/ai-generate-button";
import { Button } from "@/components/ui/button";

interface ProjectWorkspaceProps {
  project: Project;
  sections: Section[];
}

export function ProjectWorkspace({
  project,
  sections,
}: ProjectWorkspaceProps) {
  const router = useRouter();
  const [viewingPhase, setViewingPhase] = useState(project.current_phase);

  const currentSection = sections.find((s) => s.phase_number === viewingPhase) ?? null;
  const phaseDef = PHASES.find((p) => p.number === viewingPhase);
  const isCurrentPhase = viewingPhase === project.current_phase;

  const handleGenerateComplete = useCallback(
    () => {
      router.refresh();
    },
    [router]
  );

  const handleApprove = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/projects/${project.id}/sections/${viewingPhase}/approve`,
        { method: "POST" }
      );

      if (response.ok) {
        router.refresh();
      }
    } catch {
      // Error handled by response status
    }
  }, [project.id, viewingPhase, router]);

  return (
    <div className="space-y-6">
      {/* Licence Banner */}
      <LicenceBanner
        projectId={project.id}
        currentPhase={project.current_phase}
        projectStatus={project.status}
      />

      {/* Phase Stepper */}
      <div className="rounded-lg border bg-card p-4">
        <PhaseStepper
          currentPhase={project.current_phase}
          phasesCompleted={project.phases_completed}
          projectStatus={project.status}
          onPhaseClick={setViewingPhase}
        />
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {isCurrentPhase && viewingPhase === 0 && project.synopsis_text && (
          <AIGenerateButton
            projectId={project.id}
            phaseNumber={0}
            disabled={currentSection?.status === "generating"}
            onComplete={handleGenerateComplete}
          />
        )}

        {isCurrentPhase && currentSection?.status === "review" && (
          <Button onClick={handleApprove} size="sm" variant="default">
            Approve &amp; Advance
          </Button>
        )}

        <CompileButton
          projectId={project.id}
          disabled={!sections.some((s) => s.status === "approved" || s.status === "review")}
        />
      </div>

      {/* Section Content */}
      <SectionViewer
        section={currentSection}
        phaseName={phaseDef?.label ?? `Phase ${viewingPhase}`}
      />
    </div>
  );
}
