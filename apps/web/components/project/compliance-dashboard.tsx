"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import type { ComplianceCheck } from "@/lib/types/database";

const GUIDELINE_OPTIONS = [
  { value: "CONSORT", label: "CONSORT", description: "Randomised controlled trials" },
  { value: "STROBE", label: "STROBE", description: "Observational studies" },
  { value: "PRISMA", label: "PRISMA", description: "Systematic reviews" },
  { value: "STARD", label: "STARD", description: "Diagnostic accuracy" },
  { value: "CARE", label: "CARE", description: "Case reports" },
] as const;

interface NBEMSResult {
  page_count: number;
  page_limit: number;
  page_within_limit: boolean;
  abstract_word_count: number;
  abstract_limit: number;
  abstract_within_limit: boolean;
  pico_elements: {
    patient: boolean;
    intervention: boolean;
    comparison: boolean;
    outcome: boolean;
  };
  pico_score: number;
}

interface ComplianceDashboardProps {
  projectId: string;
  checks: ComplianceCheck[];
  nbems: NBEMSResult | null;
  studyType: string | null;
}

export function ComplianceDashboard({
  projectId,
  checks,
  nbems,
  studyType,
}: ComplianceDashboardProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [selectedGuideline, setSelectedGuideline] = useState<string>(
    autoDetectGuideline(studyType)
  );

  const handleRunCheck = useCallback(async () => {
    setRunning(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/compliance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guideline_type: selectedGuideline }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? "Check failed");
      }

      toast.success("Compliance check completed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check failed");
    } finally {
      setRunning(false);
    }
  }, [projectId, selectedGuideline, router]);

  const latestCheck = checks.find(
    (c) => c.guideline_type === selectedGuideline
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Compliance Dashboard</h3>

      {/* Guideline selector */}
      <div className="flex flex-wrap items-center gap-2">
        {GUIDELINE_OPTIONS.map((g) => (
          <button
            key={g.value}
            onClick={() => setSelectedGuideline(g.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              selectedGuideline === g.value
                ? "border-primary bg-primary/10 text-primary"
                : "hover:bg-muted/50"
            }`}
          >
            {g.label}
          </button>
        ))}
        <Button
          size="sm"
          onClick={handleRunCheck}
          disabled={running}
          className="ml-2 gap-1.5"
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
          Run Check
        </Button>
      </div>

      {/* Score bar */}
      {latestCheck && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {latestCheck.guideline_type} Score
            </span>
            <span
              className={`font-semibold ${
                (latestCheck.overall_score ?? 0) >= 80
                  ? "text-green-500"
                  : (latestCheck.overall_score ?? 0) >= 50
                    ? "text-yellow-500"
                    : "text-red-500"
              }`}
            >
              {latestCheck.overall_score ?? 0}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all ${
                (latestCheck.overall_score ?? 0) >= 80
                  ? "bg-green-500"
                  : (latestCheck.overall_score ?? 0) >= 50
                    ? "bg-yellow-500"
                    : "bg-red-500"
              }`}
              style={{ width: `${latestCheck.overall_score ?? 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Checklist items */}
      {latestCheck && (
        <div className="space-y-1">
          {(
            latestCheck.checklist_json as {
              item_id: string;
              description: string;
              status: string;
              section_ref: string | null;
              suggestion: string | null;
            }[]
          ).map((item) => (
            <div
              key={item.item_id}
              className="flex items-start gap-2 rounded-md p-2 text-sm hover:bg-muted/30"
            >
              {item.status === "green" && (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
              )}
              {item.status === "yellow" && (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
              )}
              {item.status === "red" && (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{item.item_id}:</span>{" "}
                  {item.description}
                </p>
                {item.section_ref && (
                  <p className="text-xs text-muted-foreground">
                    {item.section_ref}
                  </p>
                )}
                {item.suggestion && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    {item.suggestion}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NBEMS section */}
      {nbems && (
        <div className="space-y-2 rounded-lg border p-4">
          <h4 className="text-sm font-semibold">NBEMS Requirements</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Page count</p>
              <p
                className={`text-sm font-medium ${
                  nbems.page_within_limit ? "text-green-500" : "text-red-500"
                }`}
              >
                {nbems.page_count} / {nbems.page_limit} pages
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Abstract word count
              </p>
              <p
                className={`text-sm font-medium ${
                  nbems.abstract_within_limit
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {nbems.abstract_word_count} / {nbems.abstract_limit} words
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">PICO elements</p>
              <p className="text-sm font-medium">
                {nbems.pico_score}/4 present
              </p>
              <div className="mt-1 flex gap-1">
                {(["patient", "intervention", "comparison", "outcome"] as const).map(
                  (el) => (
                    <span
                      key={el}
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        nbems.pico_elements[el]
                          ? "bg-green-500/10 text-green-500"
                          : "bg-red-500/10 text-red-500"
                      }`}
                    >
                      {el[0]!.toUpperCase()}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function autoDetectGuideline(studyType: string | null): string {
  if (!studyType) return "STROBE";
  const st = studyType.toLowerCase();
  if (st.includes("randomised") || st.includes("randomized") || st.includes("rct"))
    return "CONSORT";
  if (st.includes("meta") || st.includes("systematic")) return "PRISMA";
  if (st.includes("diagnostic") || st.includes("accuracy")) return "STARD";
  if (st.includes("case report") || st.includes("case series")) return "CARE";
  return "STROBE";
}
