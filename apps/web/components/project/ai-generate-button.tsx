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
  onComplete?: (data: SSEMessage) => void;
  onRefine?: () => void;
}

export function AIGenerateButton({
  projectId,
  phaseNumber,
  disabled,
  hasContent,
  onComplete,
  onRefine,
}: AIGenerateButtonProps) {
  const [citationSummary, setCitationSummary] = useState<CitationSummary | null>(null);
  // Defer showing the Refine button to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { start, stop, isStreaming, streamedText, error } = useSSE({
    onComplete: (data) => {
      // Extract citation summary from complete event
      const summary = (data as unknown as Record<string, unknown>).citationSummary as CitationSummary | null;
      setCitationSummary(summary ?? null);
      onComplete?.(data);
    },
  });

  function handleGenerate() {
    setCitationSummary(null);
    start(`/api/projects/${projectId}/sections/${phaseNumber}/generate`, {
      body: JSON.stringify({}),
    });
  }

  const verified = citationSummary
    ? citationSummary.total - citationSummary.tierD
    : 0;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          onClick={handleGenerate}
          disabled={disabled || isStreaming}
          size="sm"
        >
          {isStreaming ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate with AI
            </>
          )}
        </Button>

        {mounted && hasContent && onRefine && !isStreaming && (
          <Button onClick={onRefine} variant="outline" size="sm">
            <Wand2 className="h-4 w-4" />
            Refine
          </Button>
        )}

        {isStreaming && (
          <Button onClick={stop} variant="outline" size="sm">
            Stop
          </Button>
        )}
      </div>

      {isStreaming && streamedText && (
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
