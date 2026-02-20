"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import type {
  Project,
  Section,
  Citation,
  Dataset,
  Analysis,
  Figure,
  ComplianceCheck,
  Compilation,
} from "@/lib/types/database";
import type { ReviewIssue } from "@/lib/ai/review-section";
import { PHASES } from "@/lib/phases/constants";
import { PipelineTimeline } from "@/components/project/pipeline-timeline";
import { SectionViewer } from "@/components/project/section-viewer";
import { CompileButton } from "@/components/project/compile-button";
import { LicenceBanner } from "@/components/project/licence-banner";
import { AIGenerateButton } from "@/components/project/ai-generate-button";
import { ReviewDialog } from "@/components/project/review-dialog";
import { Button } from "@/components/ui/button";
import { useGlassSidebar } from "@/components/layout/glass-sidebar-provider";
import { useSupabaseClient } from "@/lib/supabase/client";
import { FileText, Eye, CheckCircle2, Loader2, X } from "lucide-react";
import { CitationListPanel } from "@/components/project/citation-list-panel";
import { ThesisCompletion } from "@/components/project/thesis-completion";
import { ExportMenu } from "@/components/project/export-menu";
import { ErrorBoundary } from "@/components/error-boundary";
import { TourOverlay } from "@/components/onboarding/tour-overlay";
import { DatasetUpload } from "@/components/project/dataset-upload";
import { AnalysisWizard } from "@/components/project/analysis-wizard";
import { ComplianceDashboard } from "@/components/project/compliance-dashboard";
import { FigureGallery } from "@/components/project/figure-gallery";
const MermaidEditor = dynamic(
  () => import("@/components/project/mermaid-editor").then((m) => m.MermaidEditor),
  { ssr: false }
);
import { ProgressDashboard } from "@/components/project/progress-dashboard";
import { AnalysisPlanReview } from "@/components/project/analysis-plan-review";
import { FinalQCDashboard } from "@/components/project/final-qc-dashboard";
import type { QCReport } from "@/lib/qc/final-qc";
import type { AnalysisPlanStatus } from "@/lib/types/database";

// Dynamic imports — heavy editor/viewer components
const LaTeXEditor = dynamic(
  () =>
    import("@/components/editor/latex-editor").then(
      (m) => m.LaTeXEditor
    ),
  { ssr: false, loading: () => <EditorSkeleton /> }
);

const PdfViewer = dynamic(
  () =>
    import("@/components/viewer/pdf-viewer").then((m) => m.PdfViewer),
  { ssr: false, loading: () => <EditorSkeleton /> }
);

const WordCountBar = dynamic(
  () =>
    import("@/components/editor/word-count-bar").then(
      (m) => m.WordCountBar
    ),
  { ssr: false }
);

function EditorSkeleton() {
  return (
    <div className="animate-pulse space-y-3 rounded-2xl bg-white p-4 landing-card-elevated">
      <div className="h-4 w-1/3 rounded bg-[#F0F0F0]" />
      <div className="h-64 rounded bg-[#F5F5F5]" />
    </div>
  );
}

type MobileTab = "edit" | "preview";

type WorkspaceTab = "editor" | "data" | "compliance" | "figures" | "progress";

interface ProjectWorkspaceProps {
  project: Project;
  sections: Section[];
  citations: Citation[];
  datasets: Dataset[];
  analyses: Analysis[];
  figures: Figure[];
  complianceChecks: ComplianceCheck[];
  compilations: Compilation[];
  latestPdfUrl?: string | null;
  devLicenceBypass?: boolean;
}

interface CompileResultInfo {
  warnings: string[];
  compile_time_ms: number;
}

// Phases that support direct AI generation (no external data dependency)
const AI_GENERATABLE_PHASES = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 10]);

export function ProjectWorkspace({
  project,
  sections,
  citations,
  datasets,
  analyses,
  figures,
  complianceChecks,
  compilations,
  latestPdfUrl,
  devLicenceBypass,
}: ProjectWorkspaceProps) {
  const router = useRouter();
  const { setExpanded, isMobile } = useGlassSidebar();
  const supabase = useSupabaseClient();
  const [viewingPhase, setViewingPhase] = useState(project.current_phase);
  const [streamingContent, setStreamingContent] = useState("");
  const [mobileTab, setMobileTab] = useState<MobileTab>("edit");
  const [pdfUrl, setPdfUrl] = useState(latestPdfUrl ?? null);
  const [pdfKey, setPdfKey] = useState(0);
  const [reviewIssues, setReviewIssues] = useState<ReviewIssue[]>([]);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("editor");
  const [mermaidEditorOpen, setMermaidEditorOpen] = useState(false);

  const [isApproving, setIsApproving] = useState(false);
  const [refineDialogOpen, setRefineDialogOpen] = useState(false);
  const [refineInstructions, setRefineInstructions] = useState("");
  const [isRefining, setIsRefining] = useState(false);

  // Lifted status messages from button components — stable layout
  const [compileResult, setCompileResult] = useState<CompileResultInfo | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Auto-dismiss success messages after 8s
  useEffect(() => {
    if (!compileResult) return;
    const t = setTimeout(() => setCompileResult(null), 8000);
    return () => clearTimeout(t);
  }, [compileResult]);

  // Auto-collapse sidebar on desktop to maximise workspace area
  useEffect(() => {
    if (!isMobile) {
      setExpanded(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isCompleted = project.status === "completed";

  const currentSection =
    sections.find((s) => s.phase_number === viewingPhase) ?? null;

  // Subscribe to section changes for Realtime live preview during generation
  useEffect(() => {
    if (currentSection?.status !== "generating") {
      setStreamingContent("");
      return;
    }

    const channel = supabase
      .channel(`section-${project.id}-${viewingPhase}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sections",
          filter: `project_id=eq.${project.id}`,
        },
        (payload) => {
          const updated = payload.new as Record<string, unknown>;
          if ((updated.phase_number as number) === viewingPhase) {
            if (updated.streaming_content) {
              setStreamingContent(updated.streaming_content as string);
            }
            if (updated.status !== "generating") {
              setStreamingContent("");
              router.refresh();
            }
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentSection?.status, project.id, viewingPhase, supabase, router]);
  const phaseDef = PHASES.find((p) => p.number === viewingPhase);
  const isCurrentPhase = viewingPhase === project.current_phase;
  const isEditable =
    currentSection?.status === "draft" || currentSection?.status === "review";
  // Show the editor when the section has any viewable content
  const hasViewableContent = Boolean(currentSection?.latex_content);

  // Compile and refresh the PDF preview
  const compileAndRefreshPdf = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/compile`, {
        method: "POST",
      });
      if (res.ok) {
        const body = await res.json();
        if (body.data?.status === "completed") {
          setPdfUrl(
            `/api/projects/${project.id}/preview.pdf?t=${Date.now()}`,
          );
          setPdfKey((k) => k + 1);
        }
      }
    } catch {
      // Compile failure is non-blocking
    }
  }, [project.id]);

  const handleGenerateComplete = useCallback(() => {
    router.refresh();
    void compileAndRefreshPdf();
  }, [router, compileAndRefreshPdf]);

  const handleSaveSuccess = useCallback(() => {
    router.refresh();
    void compileAndRefreshPdf();
  }, [router, compileAndRefreshPdf]);

  const doApprove = useCallback(async () => {
    if (isApproving) return;
    setIsApproving(true);
    try {
      const response = await fetch(
        `/api/projects/${project.id}/sections/${viewingPhase}/approve`,
        { method: "POST" }
      );
      if (response.ok) {
        router.refresh();
        void compileAndRefreshPdf();
      } else if (response.status === 409) {
        // Section already approved or phase already advanced — just refresh
        router.refresh();
      }
    } catch {
      // Network error — refresh to show current state
      router.refresh();
    } finally {
      setIsApproving(false);
    }
  }, [project.id, viewingPhase, router, compileAndRefreshPdf, isApproving]);

  const handleApprove = useCallback(async () => {
    // Run review check before approving
    try {
      const res = await fetch(
        `/api/projects/${project.id}/sections/${viewingPhase}/review`,
        { method: "POST" }
      );
      if (res.ok) {
        const { data } = await res.json();
        if (data.issues && data.issues.length > 0) {
          setReviewIssues(data.issues);
          setReviewDialogOpen(true);
          return;
        }
      }
      // No issues or review failed — proceed directly
      await doApprove();
    } catch {
      // Review is non-blocking — if it fails, approve directly
      await doApprove();
    }
  }, [project.id, viewingPhase, doApprove]);

  // Parse stored QC report for Phase 11
  const storedQCReport: QCReport | null = (() => {
    if (viewingPhase !== 11 || !currentSection?.latex_content) return null;
    try {
      return JSON.parse(currentSection.latex_content) as QCReport;
    } catch {
      return null;
    }
  })();

  // Render the editor pane based on mode
  const renderEditor = () => {
    // Phase 11: show Final QC Dashboard instead of regular editor
    if (viewingPhase === 11) {
      return (
        <FinalQCDashboard
          projectId={project.id}
          initialReport={storedQCReport}
        />
      );
    }

    // No section yet — show viewer placeholder
    if (!currentSection) {
      return (
        <SectionViewer
          section={null}
          phaseName={phaseDef?.label ?? `Phase ${viewingPhase}`}
          phaseNumber={viewingPhase}
        />
      );
    }

    // Generating with streaming content — show live Realtime preview
    if (currentSection.status === "generating" && streamingContent) {
      return (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[#8B9D77]" />
            <h3 className="font-serif text-lg font-semibold text-[#2F2F2F]">
              Generating {phaseDef?.label ?? `Phase ${viewingPhase}`}...
            </h3>
          </div>
          <div className="rounded-lg bg-[#FAFAFA] p-4">
            <pre className="whitespace-pre-wrap break-words font-mono text-sm text-[#2F2F2F]/80">
              {streamingContent}
            </pre>
          </div>
        </div>
      );
    }

    // Section with no content (e.g., just set to "generating" and content is empty)
    if (!hasViewableContent) {
      return (
        <SectionViewer
          section={currentSection}
          phaseName={phaseDef?.label ?? `Phase ${viewingPhase}`}
          phaseNumber={viewingPhase}
        />
      );
    }

    // Editable — show live LaTeX editor
    if (isEditable) {
      return (
        <LaTeXEditor
          key={`${currentSection.id}-editor`}
          projectId={project.id}
          phaseNumber={viewingPhase}
          initialContent={currentSection.latex_content}
          onSaveSuccess={handleSaveSuccess}
        />
      );
    }

    // Non-editable but has content (approved/generating) — read-only source view
    return (
      <div className="rounded-2xl bg-white p-6 landing-card-elevated">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-lg font-semibold text-[#2F2F2F]">{phaseDef?.label ?? `Phase ${viewingPhase}`}</h3>
          <div className="flex items-center gap-3">
            {currentSection.word_count > 0 && (
              <span className="font-mono text-xs text-[#6B6B6B]">
                {currentSection.word_count} words
              </span>
            )}
            <span className="font-mono text-xs text-[#6B6B6B] italic">Read-only</span>
          </div>
        </div>
        <div className="rounded-lg bg-[#FAFAFA] p-4">
          <pre className="whitespace-pre-wrap break-words font-mono text-sm text-[#2F2F2F]/80">
            {currentSection.latex_content}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Licence Banner */}
      {!isCompleted && (
        <LicenceBanner
          projectId={project.id}
          currentPhase={project.current_phase}
          projectStatus={project.status}
          devLicenceBypass={devLicenceBypass}
        />
      )}

      {/* Pipeline Timeline */}
      <div data-tour="pipeline">
        <PipelineTimeline
          currentPhase={project.current_phase}
          phasesCompleted={project.phases_completed}
          projectStatus={project.status}
          devLicenceBypass={devLicenceBypass}
          onPhaseClick={isCompleted ? undefined : setViewingPhase}
        />
      </div>

      {/* Completed — show celebration view */}
      {isCompleted && (
        <ThesisCompletion
          project={project}
          sections={sections}
          datasets={datasets}
          citations={citations}
        />
      )}

      {!isCompleted && <>
      {/* Status messages — above button row, auto-dismiss / click-dismiss */}
      {(compileResult || compileError || generateError) && (
        <div className="space-y-1">
          {compileResult && (
            <div
              className="flex items-center justify-between rounded-2xl bg-[#8B9D77]/10 p-3 text-sm text-[#8B9D77] cursor-pointer"
              onClick={() => setCompileResult(null)}
              title="Click to dismiss"
            >
              <span>
                Compiled successfully in {compileResult.compile_time_ms}ms
                {compileResult.warnings.length > 0 && ` (${compileResult.warnings.length} warnings)`}
              </span>
              <X className="h-3.5 w-3.5 opacity-50" />
            </div>
          )}
          {compileError && (
            <div
              className="flex items-center justify-between rounded-2xl bg-destructive/10 p-3 text-sm text-destructive cursor-pointer"
              onClick={() => setCompileError(null)}
              title="Click to dismiss"
            >
              <span>{compileError}</span>
              <X className="h-3.5 w-3.5 opacity-50" />
            </div>
          )}
          {generateError && (
            <div
              className="flex items-center justify-between rounded-2xl bg-destructive/10 p-3 text-sm text-destructive cursor-pointer"
              onClick={() => setGenerateError(null)}
              title="Click to dismiss"
            >
              <span>{generateError}</span>
              <X className="h-3.5 w-3.5 opacity-50" />
            </div>
          )}
        </div>
      )}

      {/* Action buttons — stable row, never shifts */}
      <div className="flex items-center gap-3" data-tour="compile">
        {isCurrentPhase && AI_GENERATABLE_PHASES.has(viewingPhase) && (
          <AIGenerateButton
            projectId={project.id}
            phaseNumber={viewingPhase}
            hasContent={hasViewableContent}
            backgroundMode={viewingPhase !== 0}
            onGenerating={() => router.refresh()}
            onComplete={handleGenerateComplete}
            onRefine={() => setRefineDialogOpen(true)}
            onError={setGenerateError}
          />
        )}

        {isCurrentPhase &&
          viewingPhase !== 11 &&
          (currentSection?.status === "review" ||
            currentSection?.status === "draft") &&
          currentSection?.latex_content && (
            <Button
              onClick={handleApprove}
              size="sm"
              variant="default"
              disabled={isApproving}
            >
              {isApproving ? "Approving..." : "Approve & Advance"}
            </Button>
          )}

        <CompileButton
          projectId={project.id}
          disabled={
            !sections.some(
              (s) => s.status === "approved" || s.status === "review"
            )
          }
          onCompileSuccess={() => {
            setPdfUrl(`/api/projects/${project.id}/preview.pdf?t=${Date.now()}`);
            setPdfKey((k) => k + 1);
          }}
          onResult={setCompileResult}
          onError={setCompileError}
        />

        {/* Show export menu from Phase 6b onwards (DECISIONS.md 8.4) */}
        {(project.current_phase > 6 ||
          (project.current_phase === 6 && project.analysis_plan_status === "approved")) && (
          <ExportMenu projectId={project.id} projectStatus={project.status} />
        )}

      </div>

      {/* Word count bar */}
      {currentSection && (
        <WordCountBar
          phaseNumber={viewingPhase}
          wordCount={currentSection.word_count}
        />
      )}

      {/* Workspace tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-full border border-black/[0.06] bg-white p-0.5">
        {(
          [
            { key: "editor", label: "Editor", icon: FileText },
            { key: "data", label: "Data & Analysis", icon: FileText },
            { key: "compliance", label: "Compliance", icon: FileText },
            { key: "figures", label: "Figures", icon: FileText },
            { key: "progress", label: "Progress", icon: FileText },
          ] as const
        ).map(({ key, label }) => (
          <Button
            key={key}
            size="sm"
            variant={workspaceTab === key ? "secondary" : "ghost"}
            onClick={() => setWorkspaceTab(key)}
            className="h-7 shrink-0 rounded-full px-3 text-xs"
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Workspace tab content */}
      {/* Phase 6: Sub-phase stepper (6a Dataset+Plan → 6b Results) */}
      {viewingPhase === 6 && workspaceTab === "editor" && (() => {
        const planStatus = (project.analysis_plan_status ?? "pending") as AnalysisPlanStatus;
        const planApproved = planStatus === "approved";
        const hasDataset = datasets.length > 0;
        const hasCompletedAnalyses = analyses.some((a) => a.status === "completed");
        const plan = (project.analysis_plan_json ?? []) as unknown as import("@/lib/validation/analysis-plan-schemas").PlannedAnalysis[];

        return (
          <div className="space-y-4">
            {/* 6a / 6b indicator */}
            <div className="rounded-lg border border-[#8B9D77]/20 bg-[#8B9D77]/5 p-4">
              <div className="mb-3 flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${!planApproved ? "bg-[#8B9D77] text-white" : "bg-[#8B9D77]/20 text-[#6B7D57]"}`}>
                  6a
                </span>
                <div className="h-px flex-1 bg-[#8B9D77]/30" />
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${planApproved ? "bg-[#8B9D77] text-white" : "bg-[#2F2F2F]/5 text-[#6B6B6B]"}`}>
                  6b
                </span>
              </div>
              <p className="mb-2 text-sm font-medium text-[#2F2F2F]">
                {planApproved ? "Phase 6b: Results" : "Phase 6a: Dataset & Analysis Planning"}
              </p>
              <div className="space-y-1.5">
                {/* 6a steps */}
                <div className="flex items-center gap-2 text-sm">
                  {hasDataset ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-[#D1D1D1]" />
                  )}
                  <span className={hasDataset ? "text-[#2F2F2F]" : "text-[#6B6B6B]"}>
                    Upload or generate dataset
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {planStatus === "approved" || planStatus === "review" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-[#D1D1D1]" />
                  )}
                  <span className={planStatus !== "pending" ? "text-[#2F2F2F]" : "text-[#6B6B6B]"}>
                    Generate analysis plan
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {planApproved ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-[#D1D1D1]" />
                  )}
                  <span className={planApproved ? "text-[#2F2F2F]" : "text-[#6B6B6B]"}>
                    Review & approve plan
                  </span>
                </div>
                {/* 6b steps */}
                <div className="flex items-center gap-2 text-sm">
                  {hasCompletedAnalyses ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-[#D1D1D1]" />
                  )}
                  <span className={hasCompletedAnalyses ? "text-[#2F2F2F]" : "text-[#6B6B6B]"}>
                    Execute analyses
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {currentSection?.latex_content ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-[#D1D1D1]" />
                  )}
                  <span className={currentSection?.latex_content ? "text-[#2F2F2F]" : "text-[#6B6B6B]"}>
                    Generate Results chapter
                  </span>
                </div>
              </div>
            </div>

            {/* Analysis Plan Review (inline in editor tab for Phase 6) */}
            {hasDataset && !planApproved && (
              <AnalysisPlanReview
                projectId={project.id}
                plan={plan}
                status={planStatus}
                onPlanUpdated={() => router.refresh()}
              />
            )}
          </div>
        );
      })()}

      {workspaceTab === "data" && (
        <div className="space-y-6">
          <DatasetUpload projectId={project.id} datasets={datasets} />
          <AnalysisWizard
            projectId={project.id}
            datasets={datasets}
            analyses={analyses}
            figures={figures}
            onViewFigures={() => setWorkspaceTab("figures")}
          />
        </div>
      )}

      {workspaceTab === "compliance" && (
        <ComplianceDashboard
          projectId={project.id}
          checks={complianceChecks}
          nbems={null}
          studyType={project.study_type}
        />
      )}

      {workspaceTab === "figures" && (
        <>
          <FigureGallery
            projectId={project.id}
            figures={figures}
            onOpenMermaid={() => setMermaidEditorOpen(true)}
            studyType={project.study_type}
          />
          <MermaidEditor
            projectId={project.id}
            open={mermaidEditorOpen}
            onClose={() => setMermaidEditorOpen(false)}
          />
        </>
      )}

      {workspaceTab === "progress" && (
        <ProgressDashboard
          project={project}
          sections={sections}
          citations={citations}
          complianceChecks={complianceChecks}
          compilations={compilations}
        />
      )}

      {/* Editor tab content */}
      {workspaceTab === "editor" && (
        <>
      {/* Citations panel */}
      <div data-tour="citations">
        <CitationListPanel
          projectId={project.id}
          citations={citations}
        />
      </div>

      {/* Mobile tab toggle */}
      <div className="flex gap-1 rounded-full border border-black/[0.06] bg-white p-0.5 md:hidden">
        <Button
          size="sm"
          variant={mobileTab === "edit" ? "secondary" : "ghost"}
          onClick={() => setMobileTab("edit")}
          className="h-7 flex-1 gap-1.5 rounded-full text-xs"
        >
          <FileText className="h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          size="sm"
          variant={mobileTab === "preview" ? "secondary" : "ghost"}
          onClick={() => setMobileTab("preview")}
          className="h-7 flex-1 gap-1.5 rounded-full text-xs"
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </Button>
      </div>

      {/* Desktop: resizable panels | Mobile: tabbed */}
      <div className="hidden md:block">
        <PanelGroup orientation="horizontal" className="min-h-[70vh]">
          <Panel defaultSize={50} minSize={30} className="pr-0">
            <div className="h-full rounded-2xl bg-white p-10 landing-card-elevated" data-tour="editor">
              <ErrorBoundary>
                {renderEditor()}
              </ErrorBoundary>
            </div>
          </Panel>
          <PanelResizeHandle className="group flex w-12 items-center justify-center">
            <div className="h-12 w-1 cursor-col-resize rounded-full bg-[#E5E5E5] transition-colors group-hover:bg-[#D1D1D1]" />
          </PanelResizeHandle>
          <Panel defaultSize={50} minSize={25} className="pl-0">
            <div className="h-full overflow-auto rounded-2xl bg-[#FDFDFD] landing-card-elevated">
              <ErrorBoundary>
                <PdfViewer key={pdfKey} url={pdfUrl} projectId={project.id} isSandbox={project.status === "sandbox"} />
              </ErrorBoundary>
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* Mobile: tabbed view */}
      <div className="md:hidden">
        <div
          className={mobileTab === "preview" ? "hidden" : ""}
        >
          <ErrorBoundary>
            {renderEditor()}
          </ErrorBoundary>
        </div>
        <div
          className={mobileTab === "edit" ? "hidden" : ""}
        >
          <ErrorBoundary>
            <PdfViewer key={pdfKey} url={pdfUrl} projectId={project.id} isSandbox={project.status === "sandbox"} />
          </ErrorBoundary>
        </div>
      </div>
        </>
      )}

      {/* Refine dialog — targeted AI editing */}
      {refineDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-serif text-lg font-semibold text-[#2F2F2F]">
              Refine this section
            </h3>
            <p className="mt-1 text-sm text-[#6B6B6B]">
              Describe what you&apos;d like to change. The AI will modify only the relevant parts.
            </p>
            <textarea
              value={refineInstructions}
              onChange={(e) => setRefineInstructions(e.target.value)}
              placeholder="e.g., Expand the paragraph about inclusion criteria&#10;Add a comparison table for the three main studies&#10;Add 5 more recent references (2020-2025)"
              className="mt-3 w-full rounded-xl border border-black/10 px-3 py-2 text-sm placeholder:text-[#D1D1D1] focus:border-[#8B9D77] focus:outline-none focus:ring-1 focus:ring-[#8B9D77]/30"
              rows={4}
              disabled={isRefining}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRefineDialogOpen(false);
                  setRefineInstructions("");
                }}
                disabled={isRefining}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!refineInstructions.trim() || isRefining}
                onClick={async () => {
                  setIsRefining(true);
                  try {
                    const res = await fetch(
                      `/api/projects/${project.id}/sections/${viewingPhase}/refine`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ instructions: refineInstructions.trim() }),
                      }
                    );
                    if (res.ok && res.body) {
                      // Consume the SSE stream to completion before refreshing
                      const reader = res.body.getReader();
                      try {
                        while (true) {
                          const { done } = await reader.read();
                          if (done) break;
                        }
                      } finally {
                        reader.releaseLock();
                      }
                      setRefineDialogOpen(false);
                      setRefineInstructions("");
                      router.refresh();
                      void compileAndRefreshPdf();
                    }
                  } catch {
                    // Error handled silently
                  } finally {
                    setIsRefining(false);
                  }
                }}
              >
                {isRefining ? "Refining..." : "Refine"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Review dialog — shown before approval when issues found */}
      <ReviewDialog
        open={reviewDialogOpen}
        issues={reviewIssues}
        onGoBack={() => setReviewDialogOpen(false)}
        onApproveAnyway={() => {
          setReviewDialogOpen(false);
          doApprove();
        }}
      />

      </>}

      {/* Onboarding tour — shows once for first-time users */}
      <TourOverlay />
    </div>
  );
}
