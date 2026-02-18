"use client";

import {
  CheckCircle2,
  Circle,
  Loader2,
  Eye,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { PHASES } from "@/lib/phases/constants";
import { getWordCountConfig } from "@/lib/phases/word-count-config";
import type {
  Project,
  Section,
  ComplianceCheck,
  Citation,
  Compilation,
} from "@/lib/types/database";

interface ProgressDashboardProps {
  project: Project;
  sections: Section[];
  citations: Citation[];
  complianceChecks: ComplianceCheck[];
  compilations: Compilation[];
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function formatCompileTime(ms: number | null): string {
  if (ms == null) return "--";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const COMPILE_STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; colour: string; label: string }> = {
  completed: { icon: CheckCircle2, colour: "text-green-500", label: "Success" },
  failed: { icon: XCircle, colour: "text-red-500", label: "Failed" },
  running: { icon: Loader2, colour: "text-blue-500", label: "Running" },
  pending: { icon: Clock, colour: "text-muted-foreground", label: "Pending" },
};

export function ProgressDashboard({
  project,
  sections,
  citations,
  complianceChecks,
  compilations,
}: ProgressDashboardProps) {
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
          const wordCfg = getWordCountConfig(phase.number);

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
                    {wordCfg && (
                      <span>
                        target: {wordCfg.softMin}–{wordCfg.softMax}
                      </span>
                    )}
                  </div>
                  {wordCfg && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full transition-all ${
                          section.word_count >= wordCfg.softMin &&
                          section.word_count <= wordCfg.softMax
                            ? "bg-green-500"
                            : section.word_count > wordCfg.softMax
                              ? "bg-yellow-500"
                              : "bg-blue-500"
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            (section.word_count / wordCfg.softMax) * 100
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

      {/* Recent Compilations (DECISIONS.md 8.5) */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-muted-foreground">Recent Compilations</h4>
        {compilations.length === 0 ? (
          <p className="text-xs text-muted-foreground">No compilations yet.</p>
        ) : (
          <div className="space-y-1.5">
            {compilations.map((c) => {
              const cfg = COMPILE_STATUS_CONFIG[c.status] ?? COMPILE_STATUS_CONFIG.pending;
              const StatusIcon = cfg.icon;
              const warningCount = c.warnings?.length ?? 0;
              const errorCount = c.errors?.length ?? 0;

              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <StatusIcon
                      className={`h-4 w-4 ${cfg.colour} ${c.status === "running" ? "animate-spin" : ""}`}
                    />
                    <span className="text-sm font-medium">{cfg.label}</span>
                    {warningCount > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-yellow-600">
                        <AlertTriangle className="h-3 w-3" />
                        {warningCount}
                      </span>
                    )}
                    {errorCount > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-red-500">
                        <XCircle className="h-3 w-3" />
                        {errorCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatCompileTime(c.compile_time_ms)}</span>
                    <span>{formatRelativeTime(c.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
