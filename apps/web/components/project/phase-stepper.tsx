"use client";

import { cn } from "@/lib/utils";
import { PHASES } from "@/lib/phases/constants";
import { Check, Lock, Circle } from "lucide-react";

interface PhaseStepperProps {
  currentPhase: number;
  phasesCompleted: number[];
  projectStatus: string;
  onPhaseClick?: (phase: number) => void;
}

export function PhaseStepper({
  currentPhase,
  phasesCompleted,
  projectStatus,
  onPhaseClick,
}: PhaseStepperProps) {
  const completedSet = new Set(phasesCompleted);
  const isLicensed = projectStatus === "licensed" || projectStatus === "completed";

  return (
    <div className="w-full overflow-x-auto">
      <nav aria-label="Thesis phases" className="flex min-w-max gap-1 p-1">
        {PHASES.map((phase) => {
          const isCompleted = completedSet.has(phase.number);
          const isCurrent = phase.number === currentPhase;
          const isLocked =
            phase.requiresLicence && !isLicensed && !isCompleted;
          const isAccessible = isCompleted || isCurrent;

          return (
            <button
              key={phase.number}
              onClick={() => isAccessible && onPhaseClick?.(phase.number)}
              disabled={!isAccessible}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs transition-colors",
                isCurrent &&
                  "bg-primary/10 text-primary ring-1 ring-primary/20",
                isCompleted &&
                  !isCurrent &&
                  "bg-green-50 text-green-700",
                !isAccessible && "cursor-not-allowed opacity-50"
              )}
              title={
                isLocked
                  ? "Licence required"
                  : isCompleted
                    ? "Completed"
                    : phase.label
              }
            >
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium",
                  isCurrent &&
                    "bg-primary text-primary-foreground",
                  isCompleted &&
                    !isCurrent &&
                    "bg-green-600 text-white",
                  !isCurrent &&
                    !isCompleted &&
                    "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5" />
                ) : isLocked ? (
                  <Lock className="h-3 w-3" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </span>
              <span className="max-w-[4.5rem] truncate font-medium">
                {phase.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
