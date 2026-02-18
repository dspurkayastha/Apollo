"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Wand2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useSSE } from "@/hooks/use-sse";
import type { SSEMessage } from "@/hooks/use-sse";

interface CitationSummary {
  total: number;
  tierA: number;
  tierD: number;
  errors: number;
}

interface AIGenerateButtonProps {
  projectId: string;
  phaseNumber: number;
  disabled?: boolean;
  hasContent?: boolean;
  /** true for phases 1-8 (Inngest background jobs); false for Phase 0 (SSE streaming) */
  backgroundMode?: boolean;
  /** Called when section status is "generating" (so parent shows live preview via Realtime) */
  onGenerating?: () => void;
  onComplete?: (data: SSEMessage) => void;
  onRefine?: () => void;
}

export function AIGenerateButton({
  projectId,
  phaseNumber,
  disabled,
  hasContent,
  backgroundMode,
  onGenerating,
  onComplete,
  onRefine,
}: AIGenerateButtonProps) {
  const [citationSummary, setCitationSummary] = useState<CitationSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bgError, setBgError] = useState<string | null>(null);
  // Defer showing the Refine button to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // SSE hook — only used for Phase 0 (synopsis parsing)
  const { start, stop, isStreaming, streamedText, error: sseError } = useSSE({
    onComplete: (data) => {
      const summary = (data as unknown as Record<string, unknown>).citationSummary as CitationSummary | null;
      setCitationSummary(summary ?? null);
      onComplete?.(data);
    },
  });

  async function handleBackgroundGenerate() {
    setCitationSummary(null);
    setBgError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/sections/${phaseNumber}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        const msg =
          (errorBody as Record<string, Record<string, string>>)?.error?.message ??
          `Request failed with status ${res.status}`;
        setBgError(msg);
        return;
      }
      // Generation enqueued — notify parent to show Realtime live preview
      onGenerating?.();
      onComplete?.({ type: "complete" });
    } catch (err) {
      setBgError(err instanceof Error ? err.message : "Failed to start generation");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleGenerate() {
    if (backgroundMode) {
      void handleBackgroundGenerate();
    } else {
      setCitationSummary(null);
      start(`/api/projects/${projectId}/sections/${phaseNumber}/generate`, {
        body: JSON.stringify({}),
      });
    }
  }

  const isBusy = backgroundMode ? isSubmitting : isStreaming;
  const error = backgroundMode ? bgError : sseError;

  const verified = citationSummary
    ? citationSummary.total - citationSummary.tierD
    : 0;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          onClick={handleGenerate}
          disabled={disabled || isBusy}
          size="sm"
        >
          {isBusy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {backgroundMode ? "Starting..." : "Generating..."}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate with AI
            </>
          )}
        </Button>

        {mounted && hasContent && onRefine && !isBusy && (
          <Button onClick={onRefine} variant="outline" size="sm">
            <Wand2 className="h-4 w-4" />
            Refine
          </Button>
        )}

        {!backgroundMode && isStreaming && (
          <Button onClick={stop} variant="outline" size="sm">
            Stop
          </Button>
        )}
      </div>

      {/* SSE inline preview — Phase 0 only */}
      {!backgroundMode && isStreaming && streamedText && (
        <div className="rounded-md bg-muted/50 p-4">
          <pre className="whitespace-pre-wrap break-words text-sm font-mono">
            {streamedText}
          </pre>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {citationSummary && citationSummary.total > 0 && (
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            citationSummary.tierD === 0
              ? "bg-[#8B9D77]/10 text-[#5A6B4A]"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          {citationSummary.tierD === 0 ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span>
            {verified} of {citationSummary.total} citations verified
            {citationSummary.tierD > 0 && (
              <> &mdash; {citationSummary.tierD} unverified (open Citations panel to review)</>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
