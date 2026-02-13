"use client";

import { useCallback } from "react";
import type { ProjectMetadata } from "@/lib/types/database";

interface MetadataFormStepProps {
  metadata: ProjectMetadata;
  onChange: (metadata: ProjectMetadata) => void;
}

export function MetadataFormStep({ metadata, onChange }: MetadataFormStepProps) {
  const updateField = useCallback(
    (field: keyof ProjectMetadata, value: string) => {
      onChange({ ...metadata, [field]: value });
    },
    [metadata, onChange]
  );

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">
        Project Metadata
      </h2>
      <p className="mb-6 text-sm text-gray-500">
        Fill in the details that will appear on your thesis title page and
        throughout the document.
      </p>

      <div className="space-y-8">
        {/* Candidate Details */}
        <fieldset>
          <legend className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Candidate Details
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="meta-candidate-name"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Candidate Name
              </label>
              <input
                id="meta-candidate-name"
                type="text"
                value={metadata.candidate_name ?? ""}
                onChange={(e) => updateField("candidate_name", e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Dr. Full Name"
              />
            </div>
            <div>
              <label
                htmlFor="meta-registration-no"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Registration No.
              </label>
              <input
                id="meta-registration-no"
                type="text"
                value={metadata.registration_no ?? ""}
                onChange={(e) => updateField("registration_no", e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. MD/MS/2024/001"
              />
            </div>
          </div>
        </fieldset>

        {/* Supervision */}
        <fieldset>
          <legend className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Supervision
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="meta-guide-name"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Guide Name
              </label>
              <input
                id="meta-guide-name"
                type="text"
                value={metadata.guide_name ?? ""}
                onChange={(e) => updateField("guide_name", e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Prof. Full Name"
              />
            </div>
            <div>
              <label
                htmlFor="meta-hod-name"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Head of Department
              </label>
              <input
                id="meta-hod-name"
                type="text"
                value={metadata.hod_name ?? ""}
                onChange={(e) => updateField("hod_name", e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Prof. Full Name"
              />
            </div>
          </div>
        </fieldset>

        {/* Academic */}
        <fieldset>
          <legend className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Academic
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="meta-department"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Department
              </label>
              <input
                id="meta-department"
                type="text"
                value={metadata.department ?? ""}
                onChange={(e) => updateField("department", e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. General Surgery"
              />
            </div>
            <div>
              <label
                htmlFor="meta-degree"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Degree
              </label>
              <input
                id="meta-degree"
                type="text"
                value={metadata.degree ?? ""}
                onChange={(e) => updateField("degree", e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. M.S. (General Surgery)"
              />
            </div>
            <div>
              <label
                htmlFor="meta-speciality"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Speciality
              </label>
              <input
                id="meta-speciality"
                type="text"
                value={metadata.speciality ?? ""}
                onChange={(e) => updateField("speciality", e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Orthopaedics"
              />
            </div>
            <div>
              <label
                htmlFor="meta-session"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Session
              </label>
              <input
                id="meta-session"
                type="text"
                value={metadata.session ?? ""}
                onChange={(e) => updateField("session", e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. 2023-2026"
              />
            </div>
            <div>
              <label
                htmlFor="meta-year"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Year
              </label>
              <input
                id="meta-year"
                type="text"
                value={metadata.year ?? ""}
                onChange={(e) => updateField("year", e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. 2026"
              />
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  );
}
