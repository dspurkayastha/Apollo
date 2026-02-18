"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Image,
  Upload,
  Trash2,
  Loader2,
  Code2,
  X,
  BarChart3,
  GitBranch,
  Download,
} from "lucide-react";
import type { Figure } from "@/lib/types/database";

const SOURCE_BADGES: Record<string, { label: string; className: string }> = {
  ggplot2: { label: "R Analysis", className: "bg-[#8B9D77]/10 text-[#6B7D57]" },
  mermaid: { label: "Diagram", className: "bg-[#2F2F2F]/8 text-[#2F2F2F]" },
  tikz: { label: "Diagram", className: "bg-[#2F2F2F]/8 text-[#2F2F2F]" },
  upload: { label: "Uploaded", className: "bg-[#6B6B6B]/8 text-[#6B6B6B]" },
};

interface FigureGalleryProps {
  projectId: string;
  figures: Figure[];
  onOpenMermaid: () => void;
  studyType?: string | null;
}

export function FigureGallery({
  projectId,
  figures,
  onOpenMermaid,
  studyType,
}: FigureGalleryProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedFigure, setExpandedFigure] = useState<string | null>(null);

  const isSystematicOrMeta =
    studyType === "systematic_review" || studyType === "meta_analysis";

  // Group figures
  const { analysisFigures, otherFigures } = useMemo(() => {
    const analysis: Figure[] = [];
    const other: Figure[] = [];
    for (const fig of figures) {
      if (fig.source_tool === "ggplot2") {
        analysis.push(fig);
      } else {
        other.push(fig);
      }
    }
    return { analysisFigures: analysis, otherFigures: other };
  }, [figures]);

  const handleUpload = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/svg+xml,application/pdf";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append(
          "metadata",
          JSON.stringify({
            caption: file.name.replace(/\.[^.]+$/, ""),
            label: `fig:${Date.now()}`,
            width_pct: 100,
          })
        );

        const res = await fetch(`/api/projects/${projectId}/figures`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message ?? "Upload failed");
        }

        toast.success("Figure uploaded");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }, [projectId, router]);

  const handleDelete = useCallback(
    async (figureId: string) => {
      setDeleting(figureId);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/figures/${figureId}`,
          { method: "DELETE" }
        );
        if (res.ok || res.status === 204) {
          toast.success("Figure deleted");
          router.refresh();
        }
      } catch {
        toast.error("Failed to delete figure");
      } finally {
        setDeleting(null);
      }
    },
    [projectId, router]
  );

  const handleDownload = useCallback(
    (figureId: string) => {
      window.open(
        `/api/projects/${projectId}/figures/${figureId}/download`,
        "_blank"
      );
    },
    [projectId]
  );

  const isImageViewable = (fig: Figure) =>
    fig.file_url && (fig.format === "png" || fig.format === "svg");

  const renderFigureCard = (fig: Figure) => {
    const badge = SOURCE_BADGES[fig.source_tool] ?? SOURCE_BADGES.upload;

    return (
      <div
        key={fig.id}
        className="group relative overflow-hidden rounded-lg border"
      >
        <button
          onClick={() => setExpandedFigure(fig.id)}
          className="w-full p-3 text-left"
        >
          <div className="mb-2 flex h-24 items-center justify-center overflow-hidden rounded bg-muted/30">
            {isImageViewable(fig) ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={fig.file_url!}
                alt={fig.caption}
                className="h-full w-full object-contain"
              />
            ) : fig.format === "pdf" && fig.file_url ? (
              <iframe
                src={`/api/projects/${projectId}/figures/${fig.id}/download#toolbar=0&navpanes=0`}
                title={fig.caption}
                className="h-full w-full border-0 pointer-events-none"
              />
            ) : fig.source_tool === "mermaid" ? (
              <Code2 className="h-8 w-8 text-muted-foreground" />
            ) : (
              <Image className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <p className="truncate text-xs font-medium">{fig.caption}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}
            >
              {badge.label}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {fig.label}
            </span>
          </div>
        </button>
        {fig.file_url && (
          <Button
            size="sm"
            variant="ghost"
            className="absolute right-9 top-1 h-7 w-7 p-0 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => handleDownload(fig.id)}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="absolute right-1 top-1 h-7 w-7 p-0 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => handleDelete(fig.id)}
          disabled={deleting === fig.id}
        >
          {deleting === fig.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Figures</h3>
        <div className="flex gap-2">
          {isSystematicOrMeta && (
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenMermaid}
              className="gap-1.5"
            >
              <GitBranch className="h-3.5 w-3.5" />
              Generate PRISMA Flow
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenMermaid}
            className="gap-1.5"
          >
            <Code2 className="h-3.5 w-3.5" />
            Mermaid
          </Button>
          <Button
            size="sm"
            onClick={handleUpload}
            disabled={uploading}
            className="gap-1.5"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload
          </Button>
        </div>
      </div>

      {figures.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8">
          <Image className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No figures yet. Upload an image or create a Mermaid diagram.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Analysis Figures group */}
          {analysisFigures.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#8B9D77]" />
                <h4 className="text-sm font-semibold text-[#2F2F2F]">
                  Analysis Figures
                </h4>
                <span className="text-xs text-muted-foreground">
                  ({analysisFigures.length})
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {analysisFigures.map(renderFigureCard)}
              </div>
            </div>
          )}

          {/* Uploaded & Diagrams group */}
          {otherFigures.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Image className="h-4 w-4 text-[#6B6B6B]" />
                <h4 className="text-sm font-semibold text-[#2F2F2F]">
                  Uploaded &amp; Diagrams
                </h4>
                <span className="text-xs text-muted-foreground">
                  ({otherFigures.length})
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {otherFigures.map(renderFigureCard)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {expandedFigure && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setExpandedFigure(null)}
        >
          <div
            className="relative max-h-[80vh] max-w-[80vw] overflow-auto rounded-lg bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              variant="ghost"
              className="absolute right-2 top-2"
              onClick={() => setExpandedFigure(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            {(() => {
              const fig = figures.find((f) => f.id === expandedFigure);
              if (!fig) return null;
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold">{fig.caption}</h4>
                    {fig.file_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(fig.id)}
                        className="gap-1.5"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {fig.label} &middot; {fig.source_tool} &middot;{" "}
                    {fig.width_pct}% width &middot; {fig.dpi} DPI
                  </p>
                  {isImageViewable(fig) && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={fig.file_url!}
                      alt={fig.caption}
                      className="max-h-[60vh] rounded"
                    />
                  )}
                  {fig.format === "pdf" && fig.file_url && (
                    <iframe
                      src={`/api/projects/${projectId}/figures/${fig.id}/download`}
                      title={fig.caption}
                      className="h-[60vh] w-full rounded border-0"
                    />
                  )}
                  {fig.source_code && (
                    <pre className="max-h-60 overflow-auto rounded bg-muted/30 p-3 text-xs">
                      {fig.source_code}
                    </pre>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
