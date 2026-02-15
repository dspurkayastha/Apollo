"use client";

import type { Section } from "@/lib/types/database";
import { cn } from "@/lib/utils";

interface SectionViewerProps {
  section: Section | null;
  phaseName: string;
  phaseNumber?: number;
  isLoading?: boolean;
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    draft: "bg-[#F0F0F0] text-[#6B6B6B]",
    generating: "bg-[#D4A373]/20 text-[#D4A373]",
    review: "bg-[#8B9D77]/20 text-[#8B9D77]",
    approved: "bg-[#8B9D77]/30 text-[#6B7D57]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        styles[status] ?? styles.draft
      )}
    >
      {status}
    </span>
  );
}

/** Try to parse Phase 0 AI response (JSON synopsis data) */
function tryParseSynopsisJson(content: string): Record<string, unknown> | null {
  let cleaned = content.trim();
  // Strip markdown code fences
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  try {
    const obj = JSON.parse(cleaned);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return obj as Record<string, unknown>;
    }
  } catch {
    // Not JSON
  }
  return null;
}

function SynopsisDataView({ data }: { data: Record<string, unknown> }) {
  const fieldLabels: Record<string, string> = {
    title: "Title",
    study_type: "Study Type",
    study_design: "Study Design",
    department: "Department",
    sample_size: "Sample Size",
    duration: "Duration",
    setting: "Setting",
    methodology_summary: "Methodology",
    aims: "Aims",
    objectives: "Objectives",
    inclusion_criteria: "Inclusion Criteria",
    exclusion_criteria: "Exclusion Criteria",
    keywords: "Keywords",
  };

  const entries = Object.entries(data).filter(
    ([, value]) => value !== null && value !== undefined && value !== ""
  );

  if (entries.length === 0) return null;

  return (
    <div className="space-y-4">
      {entries.map(([key, value]) => {
        const label = fieldLabels[key] ?? key.replace(/_/g, " ");
        const isArray = Array.isArray(value);
        const isString = typeof value === "string";
        const isNumber = typeof value === "number";

        if (isArray && value.length === 0) return null;

        return (
          <div key={key} className="space-y-1">
            <dt className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">
              {label}
            </dt>
            <dd className="text-sm">
              {isArray ? (
                <ul className="list-inside list-disc space-y-1 text-[#2F2F2F]/90">
                  {(value as string[]).map((item, i) => (
                    <li key={i}>{String(item)}</li>
                  ))}
                </ul>
              ) : isString || isNumber ? (
                <p className="text-[#2F2F2F]/90">{String(value)}</p>
              ) : null}
            </dd>
          </div>
        );
      })}
    </div>
  );
}

export function SectionViewer({
  section,
  phaseName,
  phaseNumber,
  isLoading,
}: SectionViewerProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-black/[0.06] bg-white p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-1/3 rounded bg-[#F0F0F0]" />
          <div className="h-4 w-full rounded bg-[#F5F5F5]" />
          <div className="h-4 w-2/3 rounded bg-[#F5F5F5]" />
        </div>
      </div>
    );
  }

  if (!section) {
    return (
      <div className="rounded-2xl border border-black/[0.06] bg-white p-8 text-center">
        <p className="text-[#6B6B6B]">
          No content for {phaseName} yet. Generate content to get started.
        </p>
      </div>
    );
  }

  // Phase 0 (Orientation) content is often AI-parsed JSON — render as structured data
  const synopsisData =
    phaseNumber === 0 && section.latex_content
      ? tryParseSynopsisJson(section.latex_content)
      : null;

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold text-[#2F2F2F]">{phaseName}</h3>
        <div className="flex items-center gap-3">
          {section.word_count > 0 && (
            <span className="font-mono text-xs text-[#6B6B6B]">
              {section.word_count} words
            </span>
          )}
          {statusBadge(section.status)}
        </div>
      </div>

      {synopsisData ? (
        <div className="rounded-lg bg-[#FAFAFA] p-4">
          <SynopsisDataView data={synopsisData} />
        </div>
      ) : section.latex_content ? (
        <div className="rounded-lg bg-[#FAFAFA] p-4">
          <pre className="whitespace-pre-wrap break-words font-mono text-sm text-[#2F2F2F]/80">
            {section.latex_content}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
