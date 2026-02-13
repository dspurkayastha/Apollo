"use client";

import Link from "next/link";

interface LicenceBannerProps {
  projectId: string;
  currentPhase: number;
  projectStatus: string;
}

export function LicenceBanner({
  projectId,
  currentPhase,
  projectStatus,
}: LicenceBannerProps) {
  // Only show when licence is needed but not attached
  if (projectStatus === "licensed" || projectStatus === "completed") return null;
  if (currentPhase < 1) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-amber-800">
            Licence required
          </h3>
          <p className="mt-1 text-sm text-amber-700">
            Attach a thesis licence to continue beyond Phase 1. Your work in
            Phase 0 and Phase 1 is preserved.
          </p>
        </div>
        <Link
          href={`/licences?attach=${projectId}`}
          className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-amber-700"
        >
          Attach licence
        </Link>
      </div>
    </div>
  );
}
