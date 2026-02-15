"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { PHASES } from "@/lib/phases/constants";

interface PipelineTimelineProps {
  currentPhase: number;
  phasesCompleted: number[];
  projectStatus: string;
  devLicenceBypass?: boolean;
  onPhaseClick?: (phase: number) => void;
}

/** Compact labels so all 12 phases fit without horizontal scroll */
const SHORT_LABELS: Record<number, string> = {
  0: "Orient.",
  1: "Front",
  2: "Intro",
  3: "Aims",
  4: "ROL",
  5: "M & M",
  6: "Results",
  7: "Discuss.",
  8: "Concl.",
  9: "Refs",
  10: "Append.",
  11: "Final QC",
};

export function PipelineTimeline({
  currentPhase,
  phasesCompleted,
  projectStatus,
  devLicenceBypass,
  onPhaseClick,
}: PipelineTimelineProps) {
  const completedSet = new Set(phasesCompleted);
  const isLicensed =
    devLicenceBypass ||
    projectStatus === "licensed" ||
    projectStatus === "completed";

  return (
    <div className="sticky top-0 z-10 px-2 pt-4">
      <div className="rounded-2xl bg-white/80 px-5 py-3.5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] backdrop-blur-[10px]">
        <nav
          aria-label="Thesis phases"
          className="flex w-full items-center"
        >
          {PHASES.map((phase, index) => {
            const isCompleted = completedSet.has(phase.number);
            const isCurrent = phase.number === currentPhase;
            const isLocked =
              phase.requiresLicence && !isLicensed && !isCompleted;
            const isAccessible = isCompleted || isCurrent;
            const lineActive = isCompleted || isCurrent;

            return (
              <Fragment key={phase.number}>
                {/* Connecting line — flex-1 fills available space */}
                {index > 0 && (
                  <div
                    className={cn(
                      "h-px min-w-2 flex-1 transition-colors duration-300",
                      lineActive ? "bg-[#8B9D77]" : "bg-[#E5E5E5]"
                    )}
                  />
                )}

                {/* Phase dot + label */}
                <button
                  onClick={() => isAccessible && onPhaseClick?.(phase.number)}
                  disabled={!isAccessible}
                  className={cn(
                    "group flex shrink-0 flex-col items-center gap-1.5 px-1",
                    !isAccessible && "cursor-not-allowed opacity-40"
                  )}
                  title={
                    isLocked
                      ? "Licence required"
                      : isCompleted
                        ? `${phase.label} — Completed`
                        : phase.label
                  }
                >
                  {/* Dot — 3-tier size hierarchy */}
                  <div
                    className={cn(
                      "rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                      isCurrent &&
                        "h-3.5 w-3.5 bg-[#2F2F2F] ring-[3px] ring-[#2F2F2F]/10",
                      isCompleted &&
                        !isCurrent &&
                        "h-2.5 w-2.5 bg-[#8B9D77]",
                      !isCurrent &&
                        !isCompleted &&
                        "h-2 w-2 bg-[#D1D1D1]",
                      isAccessible && "group-hover:scale-125"
                    )}
                  />

                  {/* Label */}
                  <span
                    className={cn(
                      "whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.04em]",
                      isCurrent && "font-semibold text-[#2F2F2F]",
                      isCompleted &&
                        !isCurrent &&
                        "font-medium text-[#6B6B6B]",
                      !isCurrent && !isCompleted && "text-[#B0B0B0]"
                    )}
                  >
                    {SHORT_LABELS[phase.number] ?? phase.label}
                  </span>
                </button>
              </Fragment>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
