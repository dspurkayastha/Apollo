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
    <div className="rounded-2xl border border-[#C8964C]/40 bg-[#FDF6EE] p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[#92600A]">
            Licence required
          </h3>
          <p className="mt-1 text-sm text-[#7A5F2A]">
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
