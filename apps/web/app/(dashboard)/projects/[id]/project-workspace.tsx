"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
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
} from "@/lib/types/database";
import type { JSONContent } from "novel";
import type { ReviewIssue } from "@/lib/ai/review-section";
import { latexToTiptap } from "@/lib/latex/latex-to-tiptap";
import { PHASES } from "@/lib/phases/constants";
import { PipelineTimeline } from "@/components/project/pipeline-timeline";
import { SectionViewer } from "@/components/project/section-viewer";
import { CompileButton } from "@/components/project/compile-button";
import { LicenceBanner } from "@/components/project/licence-banner";
import { AIGenerateButton } from "@/components/project/ai-generate-button";
import { ReviewDialog } from "@/components/project/review-dialog";
import { Button } from "@/components/ui/button";
import { useGlassSidebar } from "@/components/layout/glass-sidebar-provider";
import { FileText, Code, Eye, CheckCircle2 } from "lucide-react";
import { CitationListPanel } from "@/components/project/citation-list-panel";
import { CitationSearchDialog } from "@/components/project/citation-search-dialog";
import { DatasetUpload } from "@/components/project/dataset-upload";
import { AnalysisWizard } from "@/components/project/analysis-wizard";
import { ComplianceDashboard } from "@/components/project/compliance-dashboard";
import { FigureGallery } from "@/components/project/figure-gallery";
import { MermaidEditor } from "@/components/project/mermaid-editor";
import { ProgressDashboard } from "@/components/project/progress-dashboard";

// Dynamic imports — heavy editor/viewer components
const SectionEditor = dynamic(
  () =>
    import("@/components/editor/section-editor").then(
      (m) => m.SectionEditor
    ),
  { ssr: false, loading: () => <EditorSkeleton /> }
);

const LaTeXSourceView = dynamic(
  () =>
    import("@/components/editor/latex-source-view").then(
      (m) => m.LaTeXSourceView
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

type EditorMode = "richtext" | "source";
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
  latestPdfUrl?: string | null;
  devLicenceBypass?: boolean;
}

// Phases that support direct AI generation (no external data dependency)
const AI_GENERATABLE_PHASES = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]);

export function ProjectWorkspace({
  project,
  sections,
  citations,
  datasets,
  analyses,
  figures,
  complianceChecks,
  latestPdfUrl,
  devLicenceBypass,
}: ProjectWorkspaceProps) {
  const router = useRouter();
  const { setExpanded, isMobile } = useGlassSidebar();
  const [viewingPhase, setViewingPhase] = useState(project.current_phase);
  const [editorMode, setEditorMode] = useState<EditorMode>("source");
  const [mobileTab, setMobileTab] = useState<MobileTab>("edit");
  const [pdfUrl, setPdfUrl] = useState(latestPdfUrl ?? null);
  const [pdfKey, setPdfKey] = useState(0);
  const [reviewIssues, setReviewIssues] = useState<ReviewIssue[]>([]);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [citationSearchOpen, setCitationSearchOpen] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("editor");
  const [mermaidEditorOpen, setMermaidEditorOpen] = useState(false);

  const [isApproving, setIsApproving] = useState(false);

  // Auto-collapse sidebar on desktop to maximise workspace area
  useEffect(() => {
    if (!isMobile) {
      setExpanded(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentSection =
    sections.find((s) => s.phase_number === viewingPhase) ?? null;
  const phaseDef = PHASES.find((p) => p.number === viewingPhase);
  const isCurrentPhase = viewingPhase === project.current_phase;
  const isEditable =
    currentSection?.status === "draft" || currentSection?.status === "review";
  // Show the toggle when the section has any viewable content (even if not editable)
  const hasViewableContent = Boolean(
    currentSection?.latex_content || currentSection?.rich_content_json
  );

  // Compute rich content: use stored JSON, or convert from LaTeX on the fly
  const richContentForEditor = useMemo(() => {
    if (currentSection?.rich_content_json) {
      return currentSection.rich_content_json as JSONContent;
    }
    // Fallback: convert latex_content → Tiptap JSON for pre-existing sections
    if (currentSection?.latex_content) {
      const result = latexToTiptap(currentSection.latex_content);
      return result.json as JSONContent;
    }
    return null;
  }, [currentSection?.id, currentSection?.rich_content_json, currentSection?.latex_content]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select editor mode: richtext when rich content is available, source otherwise
  useEffect(() => {
    if (richContentForEditor) {
      setEditorMode("richtext");
    } else {
      setEditorMode("source");
    }
  }, [currentSection?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Render the editor pane based on mode
  const renderEditor = () => {
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

    // Editable — show live editor
    if (isEditable) {
      if (editorMode === "richtext") {
        return (
          <SectionEditor
            key={`${currentSection.id}-rich`}
            projectId={project.id}
            phaseNumber={viewingPhase}
            initialContent={richContentForEditor}
            onSaveSuccess={handleSaveSuccess}
          />
        );
      }

      return (
        <LaTeXSourceView
          key={`${currentSection.id}-source`}
          projectId={project.id}
          phaseNumber={viewingPhase}
          initialContent={currentSection.latex_content}
          onSaveSuccess={handleSaveSuccess}
        />
      );
    }

    // Non-editable but has content (approved/generating) — read-only view
    // Toggle between rich text rendering and source view
    if (editorMode === "source") {
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
    }

    // Rich text read-only view
    return (
      <SectionViewer
        section={currentSection}
        phaseName={phaseDef?.label ?? `Phase ${viewingPhase}`}
        phaseNumber={viewingPhase}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* Licence Banner */}
      <LicenceBanner
        projectId={project.id}
        currentPhase={project.current_phase}
        projectStatus={project.status}
        devLicenceBypass={devLicenceBypass}
      />

      {/* Pipeline Timeline */}
      <PipelineTimeline
        currentPhase={project.current_phase}
        phasesCompleted={project.phases_completed}
        projectStatus={project.status}
        devLicenceBypass={devLicenceBypass}
        onPhaseClick={setViewingPhase}
      />

      {/* Action Bar */}
      <div className="flex items-center gap-3">
        {isCurrentPhase && AI_GENERATABLE_PHASES.has(viewingPhase) && (
          <AIGenerateButton
            projectId={project.id}
            phaseNumber={viewingPhase}
            onComplete={handleGenerateComplete}
          />
        )}

        {isCurrentPhase &&
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
        />

        {/* Editor mode toggle — pushed right, visible when section has content */}
        {hasViewableContent && (
          <div className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-black/[0.06] bg-white p-0.5">
            <Button
              size="sm"
              variant={editorMode === "richtext" ? "secondary" : "ghost"}
              onClick={() => setEditorMode("richtext")}
              className="h-7 gap-1.5 rounded-full px-3 text-xs"
            >
              <FileText className="h-3.5 w-3.5" />
              Rich Text
            </Button>
            <Button
              size="sm"
              variant={editorMode === "source" ? "secondary" : "ghost"}
              onClick={() => setEditorMode("source")}
              className="h-7 gap-1.5 rounded-full px-3 text-xs"
            >
              <Code className="h-3.5 w-3.5" />
              Source
            </Button>
          </div>
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
      {/* Phase 6 sub-step indicator */}
      {viewingPhase === 6 && workspaceTab === "editor" && (
        <div className="rounded-lg border border-[#8B9D77]/20 bg-[#8B9D77]/5 p-4">
          <p className="mb-2 text-sm font-medium text-[#2F2F2F]">Results Checklist</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              {datasets.length > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-[#D1D1D1]" />
              )}
              <span className={datasets.length > 0 ? "text-[#2F2F2F]" : "text-[#6B6B6B]"}>
                Upload or generate dataset
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {analyses.some((a) => a.status === "completed") ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-[#D1D1D1]" />
              )}
              <span className={analyses.some((a) => a.status === "completed") ? "text-[#2F2F2F]" : "text-[#6B6B6B]"}>
                Run statistical analyses
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {currentSection?.latex_content ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-[#D1D1D1]" />
              )}
              <span className={currentSection?.latex_content ? "text-[#2F2F2F]" : "text-[#6B6B6B]"}>
                Generate Results section
              </span>
            </div>
          </div>
        </div>
      )}

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
        />
      )}

      {/* Editor tab content */}
      {workspaceTab === "editor" && (
        <>
      {/* Citations panel */}
      <CitationListPanel
        projectId={project.id}
        citations={citations}
        onAddCitation={() => setCitationSearchOpen(true)}
      />

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
            <div className="h-full rounded-2xl bg-white p-10 landing-card-elevated">
              {renderEditor()}
            </div>
          </Panel>
          <PanelResizeHandle className="group flex w-12 items-center justify-center">
            <div className="h-12 w-1 cursor-col-resize rounded-full bg-[#E5E5E5] transition-colors group-hover:bg-[#D1D1D1]" />
          </PanelResizeHandle>
          <Panel defaultSize={50} minSize={25} className="pl-0">
            <div className="h-full overflow-auto rounded-2xl bg-[#FDFDFD] landing-card-elevated">
              <PdfViewer key={pdfKey} url={pdfUrl} />
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* Mobile: tabbed view */}
      <div className="md:hidden">
        <div
          className={mobileTab === "preview" ? "hidden" : ""}
        >
          {renderEditor()}
        </div>
        <div
          className={mobileTab === "edit" ? "hidden" : ""}
        >
          <PdfViewer key={pdfKey} url={pdfUrl} />
        </div>
      </div>
        </>
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

      {/* Citation search dialog */}
      <CitationSearchDialog
        projectId={project.id}
        open={citationSearchOpen}
        onOpenChange={setCitationSearchOpen}
        onInsert={(citeKey) => {
          setCitationSearchOpen(false);
          // Refresh to show new citation in panel
          router.refresh();
        }}
      />
    </div>
  );
}
