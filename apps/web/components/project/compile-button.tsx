"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Clock } from "lucide-react";

interface CompileButtonProps {
  projectId: string;
  disabled?: boolean;
  onCompileSuccess?: () => void;
  onResult?: (r: CompileResult | null) => void;
  onError?: (e: string | null) => void;
}

interface CompileResult {
  compilation_id: string;
  status: string;
  warnings: string[];
  compile_time_ms: number;
}

export function CompileButton({ projectId, disabled, onCompileSuccess, onResult, onError }: CompileButtonProps) {
  const [isCompiling, setIsCompiling] = useState(false);
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
        const response = await fetch(`/api/projects/${projectId}/compile`, {
          method: "POST",
        });
        const body = await response.json();

        if (response.status === 202 || response.status === 429) {
          const pos = body.data?.queue_position ?? body.error?.queue_position;
          const wait = body.data?.estimated_wait_ms ?? body.error?.estimated_wait_ms;
          setQueuePosition(pos ?? null);
          setEstimatedWait(wait ?? null);
        } else if (response.ok && body.data?.status === "completed") {
          const r = {
            compilation_id: body.data.compilation_id,
            status: "completed",
            warnings: Array.isArray(body.data.warnings) ? body.data.warnings : [],
            compile_time_ms: body.data.compile_time_ms ?? 0,
          };
          onResult?.(r);
          setQueuePosition(null);
          setEstimatedWait(null);
          setIsCompiling(false);
          onCompileSuccess?.();
        } else if (body.error) {
          onError?.(body.error.message);
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
  }, [queuePosition, projectId, onCompileSuccess, onResult, onError]);

  async function handleCompile() {
    setIsCompiling(true);
    onResult?.(null);
    onError?.(null);
    setQueuePosition(null);
    setEstimatedWait(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/compile`, {
        method: "POST",
      });

      const body = await response.json();

      if (response.status === 202 || response.status === 429) {
        // Queued — extract position and start polling
        setQueuePosition(body.error?.queue_position ?? body.data?.queue_position ?? 1);
        setEstimatedWait(body.error?.estimated_wait_ms ?? body.data?.estimated_wait_ms ?? null);
        return; // Keep polling
      }

      const data = body.data;

      if (response.ok && data?.status === "completed") {
        // Success — store normalised result
        const r = {
          compilation_id: data.compilation_id,
          status: "completed",
          warnings: Array.isArray(data.warnings) ? data.warnings : [],
          compile_time_ms: data.compile_time_ms ?? 0,
        };
        onResult?.(r);
        onCompileSuccess?.();
      } else if (data?.status === "validation_failed") {
        // Pre-flight validation failed — show issues as error text
        const issues: { chapter: string; message: string }[] = Array.isArray(data.issues) ? data.issues : [];
        const msg = issues.length > 0
          ? `Validation failed: ${issues.map((i: { chapter: string; message: string }) => `${i.chapter} — ${i.message}`).join("; ")}`
          : "Validation failed — fix issues in the editor and retry";
        onError?.(msg);
      } else if (data?.status === "failed") {
        // Compile failed — show errors
        const errors: string[] = Array.isArray(data.errors) ? data.errors : [];
        const msg = errors.length > 0
          ? `Compilation failed: ${errors.join("; ")}`
          : "Compilation failed — check the LaTeX source for errors";
        onError?.(msg);
      } else if (body.error?.message) {
        onError?.(body.error.message);
      } else {
        onError?.("Unexpected response from server");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Compilation failed";
      onError?.(msg);
    } finally {
      if (queuePosition === null) {
        setIsCompiling(false);
      }
    }
  }

  return (
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
  );
}
