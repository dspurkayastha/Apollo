"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";

interface CompileButtonProps {
  projectId: string;
  disabled?: boolean;
}

interface CompileResponse {
  data: {
    compilation_id: string;
    status: string;
    warnings: string[];
    errors: string[];
    compile_time_ms: number;
  };
}

export function CompileButton({ projectId, disabled }: CompileButtonProps) {
  const [isCompiling, setIsCompiling] = useState(false);
  const [result, setResult] = useState<CompileResponse["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCompile() {
    setIsCompiling(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/compile`, {
        method: "POST",
      });

      const body = (await response.json()) as CompileResponse | { error: { message: string } };

      if ("error" in body) {
        setError((body as { error: { message: string } }).error.message);
      } else {
        setResult(body.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compilation failed");
    } finally {
      setIsCompiling(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleCompile}
        disabled={disabled || isCompiling}
        variant="outline"
        size="sm"
      >
        {isCompiling ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Compiling...
          </>
        ) : (
          <>
            <FileText className="h-4 w-4" />
            Compile PDF
          </>
        )}
      </Button>

      {result && (
        <div
          className={cn(
            "rounded-md p-3 text-sm",
            result.status === "completed"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
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
                <p key={i} className="mt-1 text-xs">
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
