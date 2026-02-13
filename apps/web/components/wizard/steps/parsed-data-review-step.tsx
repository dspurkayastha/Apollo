"use client";

import { useEffect, useCallback } from "react";
import { parseSynopsis, type ParsedSynopsis } from "@/lib/synopsis/parser";

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
  // Auto-parse on mount if synopsis text is available but parsedData is not
  useEffect(() => {
    if (synopsisText && synopsisText.trim().length > 0 && !parsedData) {
      const result = parseSynopsis(synopsisText);
      onParsedDataChange(result);
    }
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
        <h2 className="mb-1 text-lg font-semibold text-gray-900">
          Review Parsed Data
        </h2>
        <div className="mt-8 flex flex-col items-center justify-center py-12 text-center">
          <svg
            className="mb-4 h-12 w-12 text-gray-300"
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
          <p className="text-sm text-gray-500">
            No synopsis text available. Please go back and provide your synopsis
            first.
          </p>
        </div>
      </div>
    );
  }

  if (!parsedData) {
    return (
      <div>
        <h2 className="mb-1 text-lg font-semibold text-gray-900">
          Review Parsed Data
        </h2>
        <div className="mt-8 flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span className="ml-3 text-sm text-gray-500">
            Parsing synopsis...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">
        Review Parsed Data
      </h2>
      <p className="mb-6 text-sm text-gray-500">
        Auto-parsed from your synopsis. Please review and correct as needed.
      </p>

      <div className="space-y-5">
        {/* Title */}
        <div>
          <label
            htmlFor="parsed-title"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Title
          </label>
          <input
            id="parsed-title"
            type="text"
            value={parsedData.title ?? ""}
            onChange={(e) => updateField("title", e.target.value || null)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Thesis title"
          />
        </div>

        {/* Study type */}
        <div>
          <label
            htmlFor="parsed-study-type"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Study Type
          </label>
          <input
            id="parsed-study-type"
            type="text"
            value={parsedData.study_type ?? ""}
            onChange={(e) => updateField("study_type", e.target.value || null)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="e.g. Cross-Sectional Study, Randomised Controlled Trial"
          />
        </div>

        {/* Sample size */}
        <div>
          <label
            htmlFor="parsed-sample-size"
            className="mb-1.5 block text-sm font-medium text-gray-700"
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
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="e.g. 100"
            min={0}
          />
        </div>

        {/* Aims */}
        <div>
          <label
            htmlFor="parsed-aims"
            className="mb-1.5 block text-sm font-medium text-gray-700"
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
            className="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="One aim per line"
          />
          <p className="mt-1 text-xs text-gray-400">One aim per line.</p>
        </div>

        {/* Inclusion criteria */}
        <div>
          <label
            htmlFor="parsed-inclusion"
            className="mb-1.5 block text-sm font-medium text-gray-700"
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
            className="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="One criterion per line"
          />
          <p className="mt-1 text-xs text-gray-400">
            One criterion per line.
          </p>
        </div>

        {/* Exclusion criteria */}
        <div>
          <label
            htmlFor="parsed-exclusion"
            className="mb-1.5 block text-sm font-medium text-gray-700"
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
            className="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="One criterion per line"
          />
          <p className="mt-1 text-xs text-gray-400">
            One criterion per line.
          </p>
        </div>
      </div>
    </div>
  );
}
