"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, PanelLeftClose, PanelLeftOpen, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Match worker version to installed pdfjs-dist package
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string | null;
  isSandbox?: boolean;
  projectId?: string;
}

function LazyThumbnail({
  pageNum,
  isActive,
  onClick,
}: {
  pageNum: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`rounded border transition-all ${
        isActive
          ? "border-[#8B9D77] ring-1 ring-[#8B9D77]/30"
          : "border-transparent hover:border-[#D1D1D1]"
      }`}
    >
      {isVisible ? (
        <Page
          pageNumber={pageNum}
          width={72}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      ) : (
        <div className="h-[102px] w-[72px] rounded bg-[#E8E8E8]" />
      )}
      <span className="block text-center text-[9px] text-[#6B6B6B]">
        {pageNum}
      </span>
    </button>
  );
}

export function PdfViewer({ url, isSandbox, projectId }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [showThumbnails, setShowThumbnails] = useState(false);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: total }: { numPages: number }) => {
      setNumPages(total);
      setPageNumber(1);
    },
    []
  );

  if (!url) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center rounded-2xl bg-[#FDFDFD] p-8">
        <div className="text-center">
          <p className="font-serif text-lg text-[#D1D1D1]">
            Compiled PDF Preview
          </p>
          <p className="mt-2 text-sm text-[#D1D1D1]">
            Compile the thesis to generate a preview.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-2 p-4">
      {/* Sandbox watermark overlay (matches Ghostscript watermark in compiled PDF) */}
      {isSandbox && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="rotate-[-45deg] select-none font-serif text-9xl italic tracking-[0.2em] text-black/[0.15]">
            Apollo
          </div>
        </div>
      )}

      {/* Glass pill controls */}
      <div className="flex items-center justify-between rounded-full border border-white/30 bg-white/80 px-4 py-2 backdrop-blur-[20px]">
        <div className="flex items-center gap-1">
          {/* Thumbnails toggle */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowThumbnails((t) => !t)}
            className="h-7 w-7 p-0"
            title={showThumbnails ? "Hide thumbnails" : "Show thumbnails"}
          >
            {showThumbnails ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </Button>
          <div className="mx-1 h-4 w-px bg-[#E5E5E5]" />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            className="h-7 w-7 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-mono text-xs text-[#6B6B6B]">
            {pageNumber} / {numPages}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
            className="h-7 w-7 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
            disabled={scale <= 0.5}
            className="h-7 w-7 p-0"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="font-mono text-xs text-[#6B6B6B]">
            {Math.round(scale * 100)}%
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setScale((s) => Math.min(2.0, s + 0.1))}
            disabled={scale >= 2.0}
            className="h-7 w-7 p-0"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          {projectId && (
            <>
              <div className="mx-1 h-4 w-px bg-[#E5E5E5]" />
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  window.open(
                    `/api/projects/${projectId}/preview.pdf?download=1`,
                    "_blank"
                  )
                }
                className="h-7 w-7 p-0"
                title="Download PDF"
              >
                <Download className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {/* Page thumbnails sidebar */}
        {showThumbnails && numPages > 0 && (
          <div
            className="flex w-24 shrink-0 flex-col gap-2 overflow-y-auto rounded-lg bg-[#F5F5F5] p-2"
            style={{ maxHeight: "70vh", scrollbarWidth: "thin", scrollbarColor: "rgba(0,0,0,0.1) transparent" }}
          >
            <Document file={url}>
              {Array.from({ length: numPages }, (_, i) => (
                <LazyThumbnail
                  key={i + 1}
                  pageNum={i + 1}
                  isActive={pageNumber === i + 1}
                  onClick={() => setPageNumber(i + 1)}
                />
              ))}
            </Document>
          </div>
        )}

        {/* PDF Document */}
        <div
          className="flex-1 overflow-auto rounded-2xl bg-white transition-opacity duration-200"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(0,0,0,0.1) transparent" }}
        >
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex h-64 items-center justify-center">
                <p className="font-mono text-sm text-[#D1D1D1]">Loading PDF\u2026</p>
              </div>
            }
            error={
              <div className="flex h-64 items-center justify-center">
                <p className="text-sm text-destructive">Failed to load PDF</p>
              </div>
            }
          >
            <Page pageNumber={pageNumber} scale={scale} />
          </Document>
        </div>
      </div>
    </div>
  );
}
