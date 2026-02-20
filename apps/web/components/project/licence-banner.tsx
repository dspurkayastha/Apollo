"use client";

import Link from "next/link";

interface LicenceBannerProps {
  projectId: string;
  currentPhase: number;
  projectStatus: string;
  devLicenceBypass?: boolean;
}

export function LicenceBanner({
  projectId,
  currentPhase,
  projectStatus,
  devLicenceBypass,
}: LicenceBannerProps) {
  // Hide when licence is attached, or in dev bypass mode
  if (projectStatus === "licensed" || projectStatus === "completed") return null;
  if (devLicenceBypass) return null;
  if (currentPhase < 2) return null;

  return (
    <div className="rounded-2xl border border-[#D4A373]/30 bg-[#D4A373]/10 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[#D4A373]">
            Licence required
          </h3>
          <p className="mt-1 text-sm text-[#D4A373]/80">
            Attach a thesis licence to continue beyond Introduction (Phase 2).
            Your work in Phases 0--2 is preserved.
          </p>
        </div>
        <Link
          href={`/checkout?attach=${projectId}`}
          className="shrink-0 rounded-full bg-[#2F2F2F] px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-[#2F2F2F]/90"
        >
          Get licence
        </Link>
      </div>
    </div>
  );
}
