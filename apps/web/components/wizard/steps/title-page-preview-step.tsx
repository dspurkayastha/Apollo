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
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
            <p className="mb-4 text-sm text-blue-800">
              You can explore the workspace and generate content up to
              Introduction (Phase 2). To unlock full thesis generation, attach
              a licence.
            </p>
            <div className="flex items-center justify-center gap-3">
              <a
                href={`/projects/${project.id}`}
                className="inline-flex items-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Continue to Workspace
              </a>
              <a
                href={`/checkout?attach=${project.id}`}
                className="inline-flex items-center rounded-md border border-amber-300 bg-white px-5 py-2.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50"
              >
                Get Licence
              </a>
            </div>
          </div>
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
            Your thesis project is ready. Proceed to the workspace to start
            generating content.
          </p>
          <a
            href={`/projects/${project.id}`}
            className="mt-3 inline-flex items-center rounded-md bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
          >
            Continue to Workspace
          </a>
        </div>
      )}
    </div>
  );
}
