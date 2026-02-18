"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Download,
  FileText,
  FileArchive,
  BarChart3,
  Loader2,
  ChevronDown,
} from "lucide-react";

interface ExportMenuProps {
  projectId: string;
  projectStatus: string;
  currentPhase: number;
}

type ExportType = "pdf" | "source" | "stats";

const ALL_EXPORTS: { type: ExportType; label: string; icon: typeof FileText; description: string }[] = [
  { type: "pdf", label: "PDF", icon: FileText, description: "Compiled PDF" },
  { type: "source", label: "LaTeX Source", icon: FileArchive, description: "main.tex + chapters + .bib" },
  { type: "stats", label: "Statistics", icon: BarChart3, description: "R scripts + data + results" },
];

/**
 * Export access tiers per DECISIONS.md 8.4:
 *   Sandbox          → PDF download only
 *   Licensed <6b     → no ExportMenu (gated by workspace)
 *   Licensed >=6b    → full export (PDF/Source/Stats)
 *   Completed        → full export (clean)
 */
function getAvailableExports(projectStatus: string, _currentPhase: number) {
  if (projectStatus === "sandbox") {
    return ALL_EXPORTS.filter((e) => e.type === "pdf");
  }
  // Licensed Phase 6b+ or Completed — full export
  return ALL_EXPORTS;
}

export function ExportMenu({ projectId, projectStatus, currentPhase }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<ExportType | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canExport = projectStatus === "licensed" || projectStatus === "completed" || projectStatus === "sandbox";
  const exports = getAvailableExports(projectStatus, currentPhase);

  const handleExport = async (type: ExportType) => {
    if (!canExport) return;
    setLoading(type);
    setErrorMsg(null);

    try {
      const url = `/api/projects/${projectId}/export/${type}`;
      const res = await fetch(url);

      if (res.status === 402) {
        setErrorMsg("A licence is required to export. Purchase one from the dashboard.");
        return;
      }

      if (res.status === 403) {
        const body = await res.json().catch(() => null);
        setErrorMsg(body?.error?.message ?? "Export not available for this phase.");
        return;
      }

      if (!res.ok) {
        throw new Error("Export failed");
      }

      // For JSON responses, trigger download
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("json")) {
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `thesis-${type}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      } else if (res.redirected) {
        // PDF redirect — open in new tab
        window.open(res.url, "_blank");
      } else {
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `thesis.${type}`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (err) {
      console.error(`Export ${type} failed:`, err);
      setErrorMsg("Export failed. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen((o) => !o)}
        className="gap-1.5"
        disabled={!canExport}
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>

      {!canExport && (
        <p className="mt-1 text-xs text-muted-foreground">
          Purchase a licence to unlock exports
        </p>
      )}

      {errorMsg && (
        <p className="mt-1 max-w-[220px] text-xs text-red-600">
          {errorMsg}
        </p>
      )}

      {open && canExport && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border bg-white p-1 shadow-lg">
          {exports.map(({ type, label, icon: Icon, description }) => (
            <button
              key={type}
              onClick={() => {
                void handleExport(type);
                setOpen(false);
              }}
              disabled={loading === type}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 disabled:opacity-50"
            >
              {loading === type ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
