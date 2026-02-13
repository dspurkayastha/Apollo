"use client";

import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { useSSE } from "@/hooks/use-sse";
import type { SSEMessage } from "@/hooks/use-sse";

interface AIGenerateButtonProps {
  projectId: string;
  phaseNumber: number;
  disabled?: boolean;
  onComplete?: (data: SSEMessage) => void;
}

export function AIGenerateButton({
  projectId,
  phaseNumber,
  disabled,
  onComplete,
}: AIGenerateButtonProps) {
  const { start, stop, isStreaming, streamedText, error } = useSSE({
    onComplete: (data) => {
      onComplete?.(data);
    },
  });

  function handleGenerate() {
    start(`/api/projects/${projectId}/sections/${phaseNumber}/generate`, {
      body: JSON.stringify({}),
    });
  }

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
    </div>
  );
}
