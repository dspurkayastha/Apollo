"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { parseSynopsis, type ParsedSynopsis } from "@/lib/synopsis/parser";
import { Sparkles, AlertTriangle } from "lucide-react";

interface ParsedDataReviewStepProps {
  synopsisText: string | null;
  parsedData: ParsedSynopsis | null;
  onParsedDataChange: (data: ParsedSynopsis) => void;
}

export function ParsedDataReviewStep({
  synopsisText,
  parsedData,
  onParsedDataChange,
}: ParsedDataReviewStepProps) {
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiAttemptedRef = useRef(false);

  // Auto-parse with AI on mount, fall back to regex if AI fails
  useEffect(() => {
    if (!synopsisText || synopsisText.trim().length === 0 || parsedData) return;
    if (aiAttemptedRef.current) return;
    aiAttemptedRef.current = true;

    async function aiParse() {
      setIsAiParsing(true);
      setAiError(null);
      try {
        const resp = await fetch("/api/synopsis/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ synopsis_text: synopsisText }),
        });

        if (resp.ok) {
          const { data } = await resp.json();
          onParsedDataChange(data as ParsedSynopsis);
          return;
        }

        // AI failed — fall back to regex
        console.warn("AI parse failed, falling back to regex parser");
        setAiError("AI parsing unavailable — used quick extraction instead.");
        const result = parseSynopsis(synopsisText!);
        onParsedDataChange(result);
      } catch {
        console.warn("AI parse error, falling back to regex parser");
        setAiError("AI parsing unavailable — used quick extraction instead.");
        const result = parseSynopsis(synopsisText!);
        onParsedDataChange(result);
      } finally {
        setIsAiParsing(false);
      }
    }

    void aiParse();
  }, [synopsisText, parsedData, onParsedDataChange]);

  const updateField = useCallback(
    <K extends keyof ParsedSynopsis>(field: K, value: ParsedSynopsis[K]) => {
      if (!parsedData) return;
      onParsedDataChange({ ...parsedData, [field]: value });
    },
    [parsedData, onParsedDataChange]
  );

  if (!synopsisText || synopsisText.trim().length === 0) {
    return (
      <div>
        <h2 className="mb-1 text-lg font-semibold">Review Parsed Data</h2>
        <div className="mt-8 flex flex-col items-center justify-center py-12 text-center">
          <svg
            className="mb-4 h-12 w-12 text-muted-foreground/30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
            />
          </svg>
          <p className="text-sm text-muted-foreground">
            No synopsis text available. Please go back and provide your synopsis
            first.
          </p>
        </div>
      </div>
    );
  }

  if (isAiParsing || !parsedData) {
    return (
      <div>
        <h2 className="mb-1 text-lg font-semibold">Review Parsed Data</h2>
        <div className="mt-8 flex flex-col items-center justify-center py-12 gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 animate-pulse text-primary" />
            <span className="text-sm text-muted-foreground">
              AI is analysing your synopsis...
            </span>
          </div>
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/2 animate-[shimmer_1.5s_ease-in-out_infinite] rounded-full bg-primary/60" />
          </div>
        </div>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Review Parsed Data</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        <Sparkles className="mr-1 inline-block h-3.5 w-3.5 text-primary" />
        AI-extracted from your synopsis. Please review and correct as needed.
      </p>

      {aiError && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{aiError}</span>
        </div>
      )}

      <div className="space-y-5">
        {/* Title */}
        <div>
          <label
            htmlFor="parsed-title"
            className="mb-1.5 block text-sm font-medium"
          >
            Title
          </label>
          <input
            id="parsed-title"
            type="text"
            value={parsedData.title ?? ""}
            onChange={(e) => updateField("title", e.target.value || null)}
            className={inputClass}
            placeholder="Thesis title"
          />
        </div>

        {/* Study type */}
        <div>
          <label
            htmlFor="parsed-study-type"
            className="mb-1.5 block text-sm font-medium"
          >
            Study Type
          </label>
          <input
            id="parsed-study-type"
            type="text"
            value={parsedData.study_type ?? ""}
            onChange={(e) => updateField("study_type", e.target.value || null)}
            className={inputClass}
            placeholder="e.g. Cross-Sectional Study, Randomised Controlled Trial"
          />
        </div>

        {/* Sample size */}
        <div>
          <label
            htmlFor="parsed-sample-size"
            className="mb-1.5 block text-sm font-medium"
          >
            Sample Size
          </label>
          <input
            id="parsed-sample-size"
            type="number"
            value={parsedData.sample_size ?? ""}
            onChange={(e) =>
              updateField(
                "sample_size",
                e.target.value ? parseInt(e.target.value, 10) : null
              )
            }
            className={inputClass}
            placeholder="e.g. 100"
            min={0}
          />
        </div>

        {/* Personnel & Institutional fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="parsed-candidate-name" className="mb-1.5 block text-sm font-medium">
              Candidate Name
            </label>
            <input
              id="parsed-candidate-name"
              type="text"
              value={parsedData.candidate_name ?? ""}
              onChange={(e) => updateField("candidate_name", e.target.value || null)}
              className={inputClass}
              placeholder="Dr. Full Name"
            />
          </div>
          <div>
            <label htmlFor="parsed-registration-no" className="mb-1.5 block text-sm font-medium">
              Registration No.
            </label>
            <input
              id="parsed-registration-no"
              type="text"
              value={parsedData.registration_no ?? ""}
              onChange={(e) => updateField("registration_no", e.target.value || null)}
              className={inputClass}
              placeholder="e.g. MD/MS/2024/001"
            />
          </div>
          <div>
            <label htmlFor="parsed-guide-name" className="mb-1.5 block text-sm font-medium">
              Guide Name
            </label>
            <input
              id="parsed-guide-name"
              type="text"
              value={parsedData.guide_name ?? ""}
              onChange={(e) => updateField("guide_name", e.target.value || null)}
              className={inputClass}
              placeholder="Prof. Full Name"
            />
          </div>
          <div>
            <label htmlFor="parsed-co-guide-name" className="mb-1.5 block text-sm font-medium">
              Co-Guide Name
            </label>
            <input
              id="parsed-co-guide-name"
              type="text"
              value={parsedData.co_guide_name ?? ""}
              onChange={(e) => updateField("co_guide_name", e.target.value || null)}
              className={inputClass}
              placeholder="If applicable"
            />
          </div>
          <div>
            <label htmlFor="parsed-department" className="mb-1.5 block text-sm font-medium">
              Department
            </label>
            <input
              id="parsed-department"
              type="text"
              value={parsedData.department ?? ""}
              onChange={(e) => updateField("department", e.target.value || null)}
              className={inputClass}
              placeholder="e.g. General Surgery"
            />
          </div>
          <div>
            <label htmlFor="parsed-institute-name" className="mb-1.5 block text-sm font-medium">
              Institute Name
            </label>
            <input
              id="parsed-institute-name"
              type="text"
              value={parsedData.institute_name ?? ""}
              onChange={(e) => updateField("institute_name", e.target.value || null)}
              className={inputClass}
              placeholder="e.g. IPGME&amp;R and SSKM Hospital"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="parsed-university-name" className="mb-1.5 block text-sm font-medium">
              University Name
            </label>
            <input
              id="parsed-university-name"
              type="text"
              value={parsedData.university_name ?? ""}
              onChange={(e) => updateField("university_name", e.target.value || null)}
              className={inputClass}
              placeholder="Cross-check with Step 1 selection"
            />
          </div>
        </div>

        {/* Aims */}
        <div>
          <label
            htmlFor="parsed-aims"
            className="mb-1.5 block text-sm font-medium"
          >
            Aims
          </label>
          <textarea
            id="parsed-aims"
            value={parsedData.aims.join("\n")}
            onChange={(e) =>
              updateField(
                "aims",
                e.target.value
                  .split("\n")
                  .filter((line) => line.trim().length > 0)
              )
            }
            rows={4}
            className={`${inputClass} resize-y`}
            placeholder="One aim per line"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            One aim per line.
          </p>
        </div>

        {/* Objectives */}
        <div>
          <label
            htmlFor="parsed-objectives"
            className="mb-1.5 block text-sm font-medium"
          >
            Objectives
          </label>
          <textarea
            id="parsed-objectives"
            value={parsedData.objectives.join("\n")}
            onChange={(e) =>
              updateField(
                "objectives",
                e.target.value
                  .split("\n")
                  .filter((line) => line.trim().length > 0)
              )
            }
            rows={4}
            className={`${inputClass} resize-y`}
            placeholder="One objective per line"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            One objective per line.
          </p>
        </div>

        {/* Inclusion criteria */}
        <div>
          <label
            htmlFor="parsed-inclusion"
            className="mb-1.5 block text-sm font-medium"
          >
            Inclusion Criteria
          </label>
          <textarea
            id="parsed-inclusion"
            value={parsedData.inclusion_criteria.join("\n")}
            onChange={(e) =>
              updateField(
                "inclusion_criteria",
                e.target.value
                  .split("\n")
                  .filter((line) => line.trim().length > 0)
              )
            }
            rows={3}
            className={`${inputClass} resize-y`}
            placeholder="One criterion per line"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            One criterion per line.
          </p>
        </div>

        {/* Exclusion criteria */}
        <div>
          <label
            htmlFor="parsed-exclusion"
            className="mb-1.5 block text-sm font-medium"
          >
            Exclusion Criteria
          </label>
          <textarea
            id="parsed-exclusion"
            value={parsedData.exclusion_criteria.join("\n")}
            onChange={(e) =>
              updateField(
                "exclusion_criteria",
                e.target.value
                  .split("\n")
                  .filter((line) => line.trim().length > 0)
              )
            }
            rows={3}
            className={`${inputClass} resize-y`}
            placeholder="One criterion per line"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            One criterion per line.
          </p>
        </div>
      </div>
    </div>
  );
}
