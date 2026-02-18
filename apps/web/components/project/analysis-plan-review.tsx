"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  Sparkles,
  Trash2,
  GripVertical,
  BarChart3,
  Clock,
  AlertCircle,
} from "lucide-react";
import type { PlannedAnalysis } from "@/lib/validation/analysis-plan-schemas";

const STATUS_STYLES: Record<string, { icon: React.ReactNode; className: string }> = {
  pending: {
    icon: <Clock className="h-3.5 w-3.5" />,
    className: "bg-[#2F2F2F]/5 text-[#6B6B6B]",
  },
  planning: {
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    className: "bg-[#8B9D77]/10 text-[#6B7D57]",
  },
  review: {
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    className: "bg-[#D4A373]/10 text-[#B8885A]",
  },
  approved: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    className: "bg-[#8B9D77]/10 text-[#6B7D57]",
  },
};

interface AnalysisPlanReviewProps {
  projectId: string;
  plan: PlannedAnalysis[];
  status: string;
  onPlanUpdated: () => void;
}

export function AnalysisPlanReview({
  projectId,
  plan,
  status,
  onPlanUpdated,
}: AnalysisPlanReviewProps) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localPlan, setLocalPlan] = useState<PlannedAnalysis[]>(plan);

  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.pending;

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/analyses/plan`,
        { method: "POST" }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? "Failed to generate plan");
      }
      const { data } = await res.json();
      setLocalPlan(data.plan);
      toast.success("Analysis plan generated --- review and approve");
      onPlanUpdated();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Plan generation failed");
    } finally {
      setGenerating(false);
    }
  }, [projectId, onPlanUpdated, router]);

  const handleApprove = useCallback(async () => {
    setApproving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/analyses/plan/approve`,
        { method: "POST" }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? "Failed to approve plan");
      }
      toast.success("Analysis plan approved --- proceed to run analyses");
      onPlanUpdated();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setApproving(false);
    }
  }, [projectId, onPlanUpdated, router]);

  const handleToggleSkip = useCallback(
    async (analysisId: string) => {
      const updated = localPlan.map((p) =>
        p.id === analysisId
          ? { ...p, status: p.status === "skipped" ? ("planned" as const) : ("skipped" as const) }
          : p
      );
      setLocalPlan(updated);

      setSaving(true);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/analyses/plan`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: updated }),
          }
        );
        if (!res.ok) {
          throw new Error("Failed to update plan");
        }
      } catch {
        toast.error("Failed to save plan changes");
        setLocalPlan(plan); // revert
      } finally {
        setSaving(false);
      }
    },
    [localPlan, plan, projectId]
  );

  const activeCount = localPlan.filter((p) => p.status !== "skipped").length;

  // Pending state: show generate button
  if (status === "pending") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">Analysis Plan</h4>
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle.className}`}>
            {statusStyle.icon}
            {status}
          </span>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6">
          <Sparkles className="h-8 w-8 text-[#8B9D77]" />
          <p className="text-sm text-muted-foreground text-center">
            Generate an AI analysis plan based on your synopsis objectives and dataset columns.
          </p>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="gap-1.5"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating ? "Generating..." : "Generate Analysis Plan"}
          </Button>
        </div>
      </div>
    );
  }

  // Planning state: show loading
  if (status === "planning") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">Analysis Plan</h4>
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle.className}`}>
            {statusStyle.icon}
            Generating...
          </span>
        </div>
        <div className="flex flex-col items-center gap-3 p-6">
          <Loader2 className="h-8 w-8 animate-spin text-[#8B9D77]" />
          <p className="text-sm text-muted-foreground">
            AI is analysing your dataset and objectives...
          </p>
        </div>
      </div>
    );
  }

  // Review or Approved: show plan cards
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">Analysis Plan</h4>
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle.className}`}>
            {statusStyle.icon}
            {status}
          </span>
          <span className="text-xs text-muted-foreground">
            ({activeCount} active, {localPlan.length - activeCount} skipped)
          </span>
        </div>
        {status === "review" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerate}
              disabled={generating}
              className="gap-1.5"
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Regenerate
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={approving || activeCount === 0}
              className="gap-1.5"
            >
              {approving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Approve Plan
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {localPlan.map((analysis) => (
          <div
            key={analysis.id}
            className={`rounded-lg border p-3 transition-opacity ${
              analysis.status === "skipped" ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-start gap-2">
              <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5 text-[#8B9D77]" />
                  <span className="text-sm font-medium capitalize">
                    {analysis.analysis_type.replace("-", " ")}
                  </span>
                  {analysis.status === "skipped" && (
                    <span className="rounded-full bg-[#2F2F2F]/5 px-2 py-0.5 text-[10px] text-[#6B6B6B]">
                      skipped
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  <strong>Objective:</strong> {analysis.objective}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {analysis.rationale}
                </p>
                {Object.entries(analysis.variables).some(([, v]) => v) && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {Object.entries(analysis.variables)
                      .filter(([, v]) => v)
                      .map(([key, value]) => (
                        <span
                          key={key}
                          className="rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-medium"
                        >
                          {key}: {value}
                        </span>
                      ))}
                  </div>
                )}
                {analysis.suggested_figures.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {analysis.suggested_figures.map((fig, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-[#8B9D77]/10 px-2 py-0.5 text-[10px] text-[#6B7D57]"
                      >
                        {fig.chart_type}: {fig.description}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {status === "review" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 p-0"
                  onClick={() => handleToggleSkip(analysis.id)}
                  disabled={saving}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
