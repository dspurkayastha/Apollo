"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { QCReport, QCCheck } from "@/lib/qc/final-qc";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Shield,
  PartyPopper,
} from "lucide-react";

// ── Check name display mapping ─────────────────────────────────────────────

const CHECK_LABELS: Record<string, string> = {
  "citation-provenance": "Citation Provenance",
  "section-completeness": "Section Completeness",
  "british-english": "British English Spelling",
  "nbems-compliance": "NBEMS Compliance",
  "undefined-references": "Undefined References",
  "results-figures-tables": "Figures & Tables",
};

// ── Props ──────────────────────────────────────────────────────────────────

interface FinalQCDashboardProps {
  projectId: string;
  initialReport: QCReport | null;
}

// ── Component ──────────────────────────────────────────────────────────────

export function FinalQCDashboard({
  projectId,
  initialReport,
}: FinalQCDashboardProps) {
  const router = useRouter();
  const [report, setReport] = useState<QCReport | null>(initialReport);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isFixing, setIsFixing] = useState<string | null>(null);
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((name: string) => {
    setExpandedChecks((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  // Run Final QC
  const runQC = useCallback(async () => {
    setIsRunning(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/qc`, {
        method: "POST",
      });
      if (res.ok) {
        const { data } = await res.json();
        setReport(data as QCReport);
        // Auto-expand failed checks
        const failed = new Set<string>();
        for (const check of (data as QCReport).checks) {
          if (check.status === "fail" || check.status === "warn") {
            failed.add(check.name);
          }
        }
        setExpandedChecks(failed);
      }
    } catch {
      // Network error
    } finally {
      setIsRunning(false);
    }
  }, [projectId]);

  // Auto-fix action
  const handleFix = useCallback(
    async (fixAction: string) => {
      setIsFixing(fixAction);
      try {
        const res = await fetch(`/api/projects/${projectId}/qc/fix`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: fixAction }),
        });
        if (res.ok) {
          // Re-run QC after fix
          await runQC();
        }
      } catch {
        // Network error
      } finally {
        setIsFixing(null);
      }
    },
    [projectId, runQC],
  );

  // Complete thesis
  const handleComplete = useCallback(async () => {
    setIsCompleting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/sections/11/approve`,
        { method: "POST" },
      );
      if (res.ok) {
        router.refresh();
      } else {
        // Re-run QC to show updated failures
        await runQC();
      }
    } catch {
      // Network error
    } finally {
      setIsCompleting(false);
    }
  }, [projectId, router, runQC]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-[#8B9D77]" />
          <h3 className="font-serif text-lg font-semibold text-[#2F2F2F]">
            Final Quality Control
          </h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={runQC}
          disabled={isRunning}
          className="gap-1.5"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Running...
            </>
          ) : (
            "Run Final QC"
          )}
        </Button>
      </div>

      {/* No report yet */}
      {!report && !isRunning && (
        <div className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-8 text-center">
          <p className="text-sm text-[#6B6B6B]">
            Run Final QC to check your thesis against all quality gates.
          </p>
        </div>
      )}

      {/* QC report */}
      {report && (
        <>
          {/* Summary bar */}
          <div
            className={`rounded-xl border p-4 ${
              report.overallPass
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <div className="flex items-center gap-3">
              {report.overallPass ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <div>
                <p
                  className={`text-sm font-semibold ${
                    report.overallPass ? "text-green-800" : "text-red-800"
                  }`}
                >
                  {report.overallPass
                    ? "All blocking checks passed"
                    : `${report.blockingCount} blocking issue(s) must be resolved`}
                </p>
                {report.warningCount > 0 && (
                  <p className="text-xs text-[#6B6B6B]">
                    {report.warningCount} warning(s) (non-blocking)
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Check cards */}
          <div className="space-y-3">
            {report.checks.map((check) => (
              <QCCheckCard
                key={check.name}
                check={check}
                expanded={expandedChecks.has(check.name)}
                onToggle={() => toggleExpanded(check.name)}
                onFix={check.fixAction ? () => handleFix(check.fixAction!) : undefined}
                isFixing={isFixing === check.fixAction}
              />
            ))}
          </div>

          {/* Complete thesis button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleComplete}
              disabled={!report.overallPass || isCompleting}
              className="gap-2"
            >
              {isCompleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <PartyPopper className="h-4 w-4" />
                  Complete Thesis
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ── QC Check Card ─────────────────────────────────────────────────────────

interface QCCheckCardProps {
  check: QCCheck;
  expanded: boolean;
  onToggle: () => void;
  onFix?: () => void;
  isFixing: boolean;
}

function QCCheckCard({
  check,
  expanded,
  onToggle,
  onFix,
  isFixing,
}: QCCheckCardProps) {
  const label = CHECK_LABELS[check.name] ?? check.name;

  const statusIcon =
    check.status === "pass" ? (
      <CheckCircle2 className="h-4 w-4 text-green-500" />
    ) : check.status === "warn" ? (
      <AlertTriangle className="h-4 w-4 text-amber-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );

  const statusBg =
    check.status === "pass"
      ? "border-green-100"
      : check.status === "warn"
        ? "border-amber-100"
        : "border-red-100";

  return (
    <div className={`rounded-xl border ${statusBg} bg-white`}>
      {/* Card header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {statusIcon}
        <div className="flex-1">
          <span className="text-sm font-medium text-[#2F2F2F]">{label}</span>
          <p className="text-xs text-[#6B6B6B]">{check.message}</p>
        </div>
        {check.blocking && check.status === "fail" && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
            BLOCKING
          </span>
        )}
        {check.details.length > 0 && (
          expanded ? (
            <ChevronDown className="h-4 w-4 text-[#6B6B6B]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[#6B6B6B]" />
          )
        )}
      </button>

      {/* Expanded details */}
      {expanded && check.details.length > 0 && (
        <div className="border-t border-[#F0F0F0] px-4 py-3">
          <ul className="space-y-1">
            {check.details.map((d, i) => (
              <li key={i} className="flex gap-2 text-xs text-[#6B6B6B]">
                <span className="shrink-0 font-mono text-[#2F2F2F]">
                  {d.item}
                </span>
                <span>{d.message}</span>
              </li>
            ))}
          </ul>

          {/* Auto-fix button */}
          {onFix && (
            <div className="mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onFix();
                }}
                disabled={isFixing}
                className="gap-1.5 text-xs"
              >
                {isFixing ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Fixing...
                  </>
                ) : check.fixAction === "auto-fix-spelling" ? (
                  "Auto-fix Spellings"
                ) : check.fixAction === "re-resolve-citations" ? (
                  "Re-resolve Citations"
                ) : (
                  "Auto-fix"
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
