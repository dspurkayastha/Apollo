"use client";

import { useMemo } from "react";
import type { Project } from "@/lib/types/database";
import { generateTitlePageHtml } from "@/lib/preview/title-page";
import { TitlePagePreview } from "@/components/preview/title-page-preview";

interface TitlePagePreviewStepProps {
  project: Project;
  isSandbox: boolean;
}

export function TitlePagePreviewStep({
  project,
  isSandbox,
}: TitlePagePreviewStepProps) {
  const html = useMemo(
    () =>
      generateTitlePageHtml(
        project.metadata_json,
        project.title,
        project.university_type,
        isSandbox
      ),
    [project.metadata_json, project.title, project.university_type, isSandbox]
  );

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">
        Title Page Preview
      </h2>
      <p className="mb-6 text-sm text-gray-500">
        This is how the title page of your thesis will appear. Review the details
        below and go back to make corrections if needed.
      </p>

      {/* Preview */}
      <div className="mb-6 flex justify-center">
        <TitlePagePreview html={html} />
      </div>

      {/* Action area */}
      {isSandbox ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="mb-3 text-sm text-amber-800">
            This project is currently in <strong>sandbox mode</strong>. To
            unlock full thesis generation, attach a licence.
          </p>
          <a
            href="/licences"
            className="inline-flex items-center rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700"
          >
            Activate with a Licence
          </a>
        </div>
      ) : (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
          <svg
            className="mx-auto mb-2 h-8 w-8 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
          <p className="text-sm font-medium text-green-800">
            Setup Complete
          </p>
          <p className="mt-1 text-xs text-green-600">
            Your thesis project is ready. You can now proceed to the writing
            phases.
          </p>
        </div>
      )}
    </div>
  );
}
