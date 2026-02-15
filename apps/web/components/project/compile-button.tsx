"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Clock } from "lucide-react";

interface CompileButtonProps {
  projectId: string;
  disabled?: boolean;
  onCompileSuccess?: () => void;
}

interface CompileResponse {
  data: {
    compilation_id: string;
    status: string;
    warnings: string[];
    errors: string[];
    compile_time_ms: number;
    queue_position?: number;
    estimated_wait_ms?: number;
  };
}

export function CompileButton({ projectId, disabled, onCompileSuccess }: CompileButtonProps) {
  const [isCompiling, setIsCompiling] = useState(false);
  const [result, setResult] = useState<CompileResponse["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [estimatedWait, setEstimatedWait] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for queue position when queued
  useEffect(() => {
    if (queuePosition === null || queuePosition <= 0) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        // Re-attempt the compile — server will either queue again or start
        const response = await fetch(`/api/projects/${projectId}/compile`, {
          method: "POST",
        });
        const body = await response.json();

        if (response.status === 202 || response.status === 429) {
          // Still queued
          const pos = body.data?.queue_position ?? body.error?.queue_position;
          const wait = body.data?.estimated_wait_ms ?? body.error?.estimated_wait_ms;
          setQueuePosition(pos ?? null);
          setEstimatedWait(wait ?? null);
        } else if (response.ok && body.data?.status === "completed") {
          // Compilation succeeded
          setResult(body.data);
          setQueuePosition(null);
          setEstimatedWait(null);
          setIsCompiling(false);
          onCompileSuccess?.();
        } else if (body.error) {
          setError(body.error.message);
          setQueuePosition(null);
          setIsCompiling(false);
        }
      } catch {
        // Ignore polling errors
      }
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [queuePosition, projectId, onCompileSuccess]);

  async function handleCompile() {
    setIsCompiling(true);
    setResult(null);
    setError(null);
    setQueuePosition(null);
    setEstimatedWait(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/compile`, {
        method: "POST",
      });

      const body = (await response.json()) as CompileResponse | { error: { message: string; queue_position?: number; estimated_wait_ms?: number } };

      if (response.status === 202 || response.status === 429) {
        // Queued — extract position and start polling
        const errorBody = body as { error: { message: string; queue_position?: number; estimated_wait_ms?: number } };
        setQueuePosition(errorBody.error?.queue_position ?? 1);
        setEstimatedWait(errorBody.error?.estimated_wait_ms ?? null);
        return; // Don't set isCompiling to false — keep polling
      }

      if ("error" in body) {
        setError((body as { error: { message: string } }).error.message);
      } else {
        setResult(body.data);
        if (body.data.status === "completed") {
          onCompileSuccess?.();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compilation failed");
    } finally {
      if (queuePosition === null) {
        setIsCompiling(false);
      }
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          onClick={handleCompile}
          disabled={disabled || isCompiling}
          variant="outline"
          size="sm"
        >
          {isCompiling ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {queuePosition ? "Queued..." : "Compiling..."}
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              Compile PDF
            </>
          )}
        </Button>

        {/* Queue position badge */}
        {queuePosition !== null && queuePosition > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#D4A373]/10 px-2.5 py-1 text-xs font-medium text-[#B8885A]">
            <Clock className="h-3 w-3" />
            {queuePosition} ahead
            {estimatedWait !== null && (
              <> — est. {Math.ceil(estimatedWait / 1000)}s</>
            )}
          </span>
        )}
      </div>

      {result && (
        <div
          className={cn(
            "rounded-2xl p-3 text-sm",
            result.status === "completed"
              ? "bg-[#8B9D77]/10 text-[#8B9D77]"
              : "bg-destructive/10 text-destructive"
          )}
        >
          {result.status === "completed" ? (
            <p>
              Compiled successfully in {result.compile_time_ms}ms
              {result.warnings.length > 0 &&
                ` (${result.warnings.length} warnings)`}
            </p>
          ) : (
            <div>
              <p className="font-medium">Compilation failed</p>
              {result.errors.map((e, i) => (
                <p key={i} className="mt-1 text-xs opacity-80">
                  {e}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
