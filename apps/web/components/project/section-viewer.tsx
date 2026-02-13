"use client";

import type { Section } from "@/lib/types/database";
import { cn } from "@/lib/utils";

interface SectionViewerProps {
  section: Section | null;
  phaseName: string;
  isLoading?: boolean;
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    generating: "bg-yellow-100 text-yellow-700",
    review: "bg-blue-100 text-blue-700",
    approved: "bg-green-100 text-green-700",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[status] ?? styles.draft
      )}
    >
      {status}
    </span>
  );
}

export function SectionViewer({
  section,
  phaseName,
  isLoading,
}: SectionViewerProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-1/3 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-2/3 rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!section) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          No content for {phaseName} yet. Generate content to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{phaseName}</h3>
        <div className="flex items-center gap-3">
          {section.word_count > 0 && (
            <span className="text-xs text-muted-foreground">
              {section.word_count} words
            </span>
          )}
          {statusBadge(section.status)}
        </div>
      </div>

      {section.latex_content && (
        <div className="rounded-md bg-muted/50 p-4">
          <pre className="whitespace-pre-wrap break-words text-sm font-mono">
            {section.latex_content}
          </pre>
        </div>
      )}
    </div>
  );
}
