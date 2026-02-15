"use client";

import {
  CheckCircle2,
  Circle,
  Loader2,
  Eye,
} from "lucide-react";
import { PHASES } from "@/lib/phases/constants";
import type {
  Project,
  Section,
  ComplianceCheck,
  Citation,
} from "@/lib/types/database";

interface ProgressDashboardProps {
  project: Project;
  sections: Section[];
  citations: Citation[];
  complianceChecks: ComplianceCheck[];
}

export function ProgressDashboard({
  project,
  sections,
  citations,
  complianceChecks,
}: ProgressDashboardProps) {
  // Word count targets per phase
  const wordTargets: Record<number, { min: number; max: number }> = {
    1: { min: 200, max: 400 },
    2: { min: 500, max: 750 },
    3: { min: 150, max: 200 },
    4: { min: 2500, max: 3500 },
    5: { min: 1500, max: 2500 },
    6: { min: 0, max: 0 }, // Dataset — no word target
    7: { min: 2000, max: 2500 },
    8: { min: 500, max: 750 },
  };

  const totalWordCount = sections.reduce(
    (sum, s) => sum + (s.word_count || 0),
    0
  );

  // Citation integrity
  const totalCitations = citations.length;
  const tierA = citations.filter((c) => c.provenance_tier === "A").length;
  const citationScore =
    totalCitations > 0 ? Math.round((tierA / totalCitations) * 100) : 0;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Progress Overview</h3>

      {/* Phase progress grid */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {PHASES.map((phase) => {
          const section = sections.find(
            (s) => s.phase_number === phase.number
          );
          const isCompleted = project.phases_completed.includes(phase.number);
          const isCurrent = project.current_phase === phase.number;
          const target = wordTargets[phase.number];

          return (
            <div
              key={phase.number}
              className={`rounded-lg border p-3 ${
                isCurrent
                  ? "border-primary bg-primary/5"
                  : isCompleted
                    ? "border-green-500/30 bg-green-500/5"
                    : ""
              }`}
            >
              <div className="flex items-center gap-2">
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : isCurrent ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : section?.status === "review" ? (
                  <Eye className="h-4 w-4 text-yellow-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">
                  {phase.number}. {phase.label}
                </span>
              </div>

              {section && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{section.word_count} words</span>
                    {target && target.max > 0 && (
                      <span>
                        target: {target.min}–{target.max}
                      </span>
                    )}
                  </div>
                  {target && target.max > 0 && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full transition-all ${
                          section.word_count >= target.min &&
                          section.word_count <= target.max
                            ? "bg-green-500"
                            : section.word_count > target.max
                              ? "bg-yellow-500"
                              : "bg-blue-500"
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            (section.word_count / target.max) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                  <span
                    className={`text-[10px] font-medium ${
                      section.status === "approved"
                        ? "text-green-500"
                        : section.status === "review"
                          ? "text-yellow-500"
                          : section.status === "generating"
                            ? "text-blue-500"
                            : "text-muted-foreground"
                    }`}
                  >
                    {section.status}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Total words</p>
          <p className="text-xl font-bold">{totalWordCount.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">
            ~{Math.ceil(totalWordCount / 250)} pages
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Phases completed</p>
          <p className="text-xl font-bold">
            {project.phases_completed.length} / {PHASES.length}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Citations</p>
          <p className="text-xl font-bold">{totalCitations}</p>
          <p className="text-xs text-muted-foreground">
            {citationScore}% Tier A verified
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Compliance</p>
          {complianceChecks.length > 0 ? (
            <>
              <p className="text-xl font-bold">
                {complianceChecks[0]!.overall_score ?? 0}%
              </p>
              <p className="text-xs text-muted-foreground">
                {complianceChecks[0]!.guideline_type}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Not checked</p>
          )}
        </div>
      </div>
    </div>
  );
}
