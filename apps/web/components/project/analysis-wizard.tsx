"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  BarChart3,
  ChevronRight,
  ChevronDown,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Settings2,
  Image as ImageIcon,
  Info,
} from "lucide-react";
import type { Dataset, Analysis, Figure } from "@/lib/types/database";
import type { AnalysisRecommendation } from "@/lib/validation/analysis-schemas";
import { ANALYSIS_ELI15 } from "@/lib/ai/analysis-explanations";

const ANALYSIS_TYPES = [
  { value: "descriptive", label: "Descriptive Statistics", description: "Frequencies, means, medians (Table 1)" },
  { value: "chi-square", label: "Chi-Square / Fisher's Test", description: "Association between categorical variables" },
  { value: "t-test", label: "T-Test / Wilcoxon", description: "Compare means between two groups" },
  { value: "correlation", label: "Correlation", description: "Pearson or Spearman correlation" },
  { value: "survival", label: "Survival Analysis", description: "Kaplan-Meier curves with log-rank test" },
  { value: "roc", label: "ROC Analysis", description: "Receiver operating characteristic curves" },
  { value: "logistic", label: "Logistic Regression", description: "Binary outcome with odds ratios" },
  { value: "kruskal", label: "Kruskal-Wallis", description: "Compare medians across 3+ groups" },
  { value: "meta-analysis", label: "Meta-Analysis", description: "Forest and funnel plots" },
] as const;

const CONFIDENCE_STYLES: Record<string, { bg: string; text: string }> = {
  high: { bg: "bg-[#8B9D77]/10", text: "text-[#6B7D57]" },
  medium: { bg: "bg-[#D4A373]/10", text: "text-[#B8885A]" },
  low: { bg: "bg-[#2F2F2F]/5", text: "text-[#6B6B6B]" },
};

interface AnalysisWizardProps {
  projectId: string;
  datasets: Dataset[];
  analyses: Analysis[];
  figures?: Figure[];
  onViewFigures?: () => void;
}

type WizardStep = "select-dataset" | "choose-method" | "auto-recommendations" | "select-analysis" | "map-columns" | "running";

export function AnalysisWizard({
  projectId,
  datasets,
  analyses,
  figures,
  onViewFigures,
}: AnalysisWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("select-dataset");
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<string | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [recommendations, setRecommendations] = useState<AnalysisRecommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [selectedRecs, setSelectedRecs] = useState<Set<number>>(new Set());
  const [expandedEli15, setExpandedEli15] = useState<Set<string>>(new Set());

  const selectedDs = datasets.find((d) => d.id === selectedDataset);
  const columns = (selectedDs?.columns_json ?? []) as { name: string; type: string }[];

  // Multi-poll for running analyses
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (runningIds.size === 0) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    pollingRef.current = setInterval(async () => {
      const completedIds: string[] = [];
      const failedIds: string[] = [];

      for (const id of runningIds) {
        try {
          const res = await fetch(`/api/projects/${projectId}/analyses/${id}`);
          if (!res.ok) continue;
          const { data } = await res.json();
          if (data.status === "completed") completedIds.push(id);
          if (data.status === "failed") failedIds.push(id);
        } catch {
          // Ignore polling errors
        }
      }

      if (completedIds.length > 0 || failedIds.length > 0) {
        setRunningIds((prev) => {
          const next = new Set(prev);
          for (const id of [...completedIds, ...failedIds]) next.delete(id);
          return next;
        });
        router.refresh();

        if (completedIds.length > 0) {
          toast.success(`${completedIds.length} analysis(es) completed`);
        }
        if (failedIds.length > 0) {
          toast.error(`${failedIds.length} analysis(es) failed`);
        }
      }
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [runningIds, projectId, router]);

  // Show "Generate Results" toast when all running analyses complete
  useEffect(() => {
    const completedCount = analyses.filter((a) => a.status === "completed").length;
    if (completedCount > 0 && runningIds.size === 0 && step === "running") {
      toast.success("All analyses complete — generate Results section", {
        action: {
          label: "Generate Results",
          onClick: () => {
            // Navigate user to Phase 6
            router.refresh();
          },
        },
        duration: 10000,
      });
    }
  }, [runningIds.size, analyses, step, router]);

  const fetchRecommendations = useCallback(async () => {
    if (!selectedDataset) return;
    setLoadingRecs(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/analyses/auto-detect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataset_id: selectedDataset }),
        }
      );
      if (!res.ok) {
        throw new Error("Failed to get recommendations");
      }
      const { data } = await res.json();
      setRecommendations(data ?? []);
      setSelectedRecs(new Set());
      setStep("auto-recommendations");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Auto-detect failed"
      );
    } finally {
      setLoadingRecs(false);
    }
  }, [projectId, selectedDataset]);

  const handleSubmit = useCallback(async () => {
    if (!selectedDataset || !selectedAnalysis) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/analyses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset_id: selectedDataset,
          analysis_type: selectedAnalysis,
          parameters: {
            outcome: columnMapping.outcome || undefined,
            predictor: columnMapping.predictor || undefined,
            group: columnMapping.group || undefined,
            time: columnMapping.time || undefined,
            event: columnMapping.event || undefined,
            confidence_level: 0.95,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? "Analysis request failed");
      }

      const { data } = await res.json();
      setRunningIds((prev) => new Set(prev).add(data.id));
      setStep("running");
      toast.success("Analysis started");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start analysis");
    } finally {
      setSubmitting(false);
    }
  }, [projectId, selectedDataset, selectedAnalysis, columnMapping, router]);

  const handleRunRecommendation = useCallback(
    async (rec: AnalysisRecommendation) => {
      if (!selectedDataset) return;
      try {
        // Sanitise parameters — ensure all values are strings (AI may return arrays)
        const cleanParams: Record<string, string | number> = { confidence_level: 0.95 };
        for (const [key, val] of Object.entries(rec.parameters)) {
          if (typeof val === "string") cleanParams[key] = val;
          else if (Array.isArray(val) && typeof val[0] === "string") cleanParams[key] = val[0];
        }

        const res = await fetch(`/api/projects/${projectId}/analyses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataset_id: selectedDataset,
            analysis_type: rec.analysis_type,
            parameters: cleanParams,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message ?? "Analysis request failed");
        }
        const { data } = await res.json();
        setRunningIds((prev) => new Set(prev).add(data.id));
        return data.id as string;
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to start analysis"
        );
        return null;
      }
    },
    [projectId, selectedDataset]
  );

  const handleRunAllSelected = useCallback(async () => {
    if (selectedRecs.size === 0) return;
    setSubmitting(true);

    const recsToRun = recommendations.filter((_, i) => selectedRecs.has(i));
    let started = 0;

    for (const rec of recsToRun) {
      const id = await handleRunRecommendation(rec);
      if (id) started++;
    }

    if (started > 0) {
      setStep("running");
      toast.success(`${started} analysis(es) started`);
      router.refresh();
    }

    setSubmitting(false);
  }, [selectedRecs, recommendations, handleRunRecommendation, router]);

  const handleCustomiseRecommendation = useCallback(
    (rec: AnalysisRecommendation) => {
      setSelectedAnalysis(rec.analysis_type);
      // Ensure all parameter values are strings for the column mapping selects
      const mapping: Record<string, string> = {};
      for (const [key, val] of Object.entries(rec.parameters)) {
        if (typeof val === "string") mapping[key] = val;
      }
      setColumnMapping(mapping);
      setStep("map-columns");
    },
    []
  );

  const toggleRecSelection = useCallback((idx: number) => {
    setSelectedRecs((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedRecs.size === recommendations.length) {
      setSelectedRecs(new Set());
    } else {
      setSelectedRecs(new Set(recommendations.map((_, i) => i)));
    }
  }, [selectedRecs.size, recommendations]);

  const toggleEli15 = useCallback((type: string) => {
    setExpandedEli15((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed": return <XCircle className="h-4 w-4 text-red-500" />;
      case "running": return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Find figures for a specific analysis type
  const getFiguresForType = (analysisType: string) => {
    return (figures ?? []).filter((f) => f.figure_type === analysisType);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Statistical Analysis</h3>

      {/* Existing analyses */}
      {analyses.length > 0 && (
        <div className="space-y-2">
          {analyses.map((a) => {
            const typeFigures = getFiguresForType(a.analysis_type);
            return (
              <div key={a.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  {statusIcon(a.status)}
                  <span className="text-sm font-medium capitalize">
                    {a.analysis_type.replace("-", " ")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {a.status}
                  </span>
                  {runningIds.has(a.id) && (
                    <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-blue-500" />
                  )}
                </div>
                {a.status === "completed" && a.results_json && (
                  <div className="mt-2 space-y-2">
                    <div className="rounded bg-muted/30 p-2">
                      <pre className="max-h-40 overflow-auto text-xs">
                        {JSON.stringify(
                          (a.results_json as Record<string, unknown>).summary,
                          null,
                          2
                        )}
                      </pre>
                    </div>
                    {/* Inline figure previews */}
                    {typeFigures.length > 0 && (
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {typeFigures.length} figure(s) generated
                        </span>
                        {onViewFigures && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={onViewFigures}
                            className="ml-auto h-6 px-2 text-xs"
                          >
                            View in Figures tab
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Wizard */}
      <div className="rounded-lg border p-4">
        {/* Step 1: Select dataset */}
        {step === "select-dataset" && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Step 1: Select dataset</p>
            {datasets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Upload or generate a dataset first.
              </p>
            ) : (
              <div className="space-y-2">
                {datasets.map((ds) => (
                  <button
                    key={ds.id}
                    onClick={() => {
                      setSelectedDataset(ds.id);
                      setStep("choose-method");
                    }}
                    className={`flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-muted/50 ${
                      selectedDataset === ds.id ? "border-primary bg-muted/30" : ""
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {ds.file_url.split("/").pop()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ds.row_count} rows
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 1.5: Choose method — manual or auto */}
        {step === "choose-method" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Step 2: Choose method</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setStep("select-dataset")}
              >
                Back
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => setStep("select-analysis")}
                className="flex flex-col items-center gap-2 rounded-lg border p-6 text-center transition-colors hover:bg-muted/50"
              >
                <Settings2 className="h-8 w-8 text-[#2F2F2F]" />
                <span className="text-sm font-medium">Choose Manually</span>
                <span className="text-xs text-muted-foreground">
                  Pick from available analysis types
                </span>
              </button>
              <button
                onClick={fetchRecommendations}
                disabled={loadingRecs}
                className="flex flex-col items-center gap-2 rounded-lg border p-6 text-center transition-colors hover:bg-muted/50 disabled:opacity-50"
              >
                {loadingRecs ? (
                  <Loader2 className="h-8 w-8 animate-spin text-[#8B9D77]" />
                ) : (
                  <Sparkles className="h-8 w-8 text-[#8B9D77]" />
                )}
                <span className="text-sm font-medium">Auto-detect</span>
                <span className="text-xs text-muted-foreground">
                  AI recommends analyses for your data
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Step 2a: Auto recommendations with batch selection */}
        {step === "auto-recommendations" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">AI Recommendations</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setStep("choose-method")}
              >
                Back
              </Button>
            </div>
            {recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No suitable analyses detected. Try choosing manually.
              </p>
            ) : (
              <div className="space-y-3">
                {/* Select All + Run All Selected */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedRecs.size === recommendations.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    Select All
                  </label>
                  {selectedRecs.size > 0 && (
                    <Button
                      size="sm"
                      onClick={handleRunAllSelected}
                      disabled={submitting}
                      className="gap-1.5"
                    >
                      {submitting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <BarChart3 className="h-3.5 w-3.5" />
                      )}
                      Run {selectedRecs.size} Selected
                    </Button>
                  )}
                </div>

                {recommendations.map((rec, i) => {
                  const conf = CONFIDENCE_STYLES[rec.confidence] ?? CONFIDENCE_STYLES.low;
                  const eli15 = ANALYSIS_ELI15[rec.analysis_type];
                  const isExpanded = expandedEli15.has(rec.analysis_type);

                  return (
                    <div
                      key={i}
                      className="rounded-lg border p-4 space-y-2"
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedRecs.has(i)}
                          onChange={() => toggleRecSelection(i)}
                          className="mt-1 h-4 w-4 rounded border-gray-300"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold capitalize">
                              {rec.analysis_type.replace("-", " ")}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${conf.bg} ${conf.text}`}
                            >
                              {rec.confidence}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                            {rec.rationale}
                          </p>
                        </div>
                      </div>

                      {/* ELI15 explainer (collapsible) */}
                      {eli15 && (
                        <div className="ml-7">
                          <button
                            onClick={() => toggleEli15(rec.analysis_type)}
                            className="flex items-center gap-1 text-xs text-[#8B9D77] hover:text-[#6B7D57] transition-colors"
                          >
                            <Info className="h-3 w-3" />
                            {isExpanded ? "Hide" : "What is this?"}
                            <ChevronDown
                              className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </button>
                          {isExpanded && (
                            <div className="mt-2 rounded-md bg-[#8B9D77]/5 p-3 text-xs leading-relaxed text-[#2F2F2F]/70">
                              <p>{eli15.eli15}</p>
                              <p className="mt-2 font-medium text-[#6B7D57]">
                                When to use: {eli15.when}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="ml-7 flex gap-2">
                        <Button
                          size="sm"
                          onClick={async () => {
                            const id = await handleRunRecommendation(rec);
                            if (id) {
                              toast.success(`${rec.analysis_type} started`);
                              router.refresh();
                            }
                          }}
                          disabled={submitting}
                          className="gap-1.5"
                        >
                          {submitting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <BarChart3 className="h-3.5 w-3.5" />
                          )}
                          Run This
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCustomiseRecommendation(rec)}
                          className="gap-1.5"
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                          Customise
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 2b: Select analysis type (manual) */}
        {step === "select-analysis" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Step 2: Select analysis type</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setStep("choose-method")}
              >
                Back
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {ANALYSIS_TYPES.map((at) => (
                <button
                  key={at.value}
                  onClick={() => {
                    setSelectedAnalysis(at.value);
                    setStep("map-columns");
                  }}
                  className="rounded-md border p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <p className="text-sm font-medium">{at.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {at.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Map columns */}
        {step === "map-columns" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Step 3: Map columns</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setStep("select-analysis")}
              >
                Back
              </Button>
            </div>
            <div className="space-y-2">
              {["outcome", "predictor", "group", "time", "event"].map(
                (role) => (
                  <div key={role} className="flex items-center gap-3">
                    <label className="w-24 text-sm font-medium capitalize">
                      {role}:
                    </label>
                    <select
                      value={String(columnMapping[role] ?? "")}
                      onChange={(e) =>
                        setColumnMapping((prev) => ({
                          ...prev,
                          [role]: e.target.value,
                        }))
                      }
                      className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
                    >
                      <option value="">— none —</option>
                      {columns.map((col) => (
                        <option key={col.name} value={col.name}>
                          {col.name} ({col.type})
                        </option>
                      ))}
                    </select>
                  </div>
                )
              )}
            </div>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BarChart3 className="h-4 w-4" />
              )}
              {submitting ? "Starting..." : "Run Analysis"}
            </Button>
          </div>
        )}

        {/* Step 4: Running */}
        {step === "running" && (
          <div className="flex flex-col items-center gap-3 py-6">
            {runningIds.size > 0 ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {runningIds.size} analysis(es) in progress...
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <p className="text-sm text-muted-foreground">
                  All analyses complete
                </p>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setStep("select-dataset");
                setRunningIds(new Set());
              }}
            >
              Start Another
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
