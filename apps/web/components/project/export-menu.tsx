"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Download,
  FileText,
  FileCode,
  FileArchive,
  BarChart3,
  Loader2,
  ChevronDown,
} from "lucide-react";

interface ExportMenuProps {
  projectId: string;
  projectStatus: string;
}

type ExportType = "pdf" | "docx" | "source" | "stats";

const EXPORTS: { type: ExportType; label: string; icon: typeof FileText; description: string }[] = [
  { type: "pdf", label: "PDF", icon: FileText, description: "Clean compiled PDF" },
  { type: "docx", label: "DOCX", icon: FileCode, description: "Word document" },
  { type: "source", label: "LaTeX Source", icon: FileArchive, description: "main.tex + chapters + .bib" },
  { type: "stats", label: "Statistics", icon: BarChart3, description: "R scripts + data + results" },
];

export function ExportMenu({ projectId, projectStatus }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<ExportType | null>(null);

  const isLicensed = projectStatus === "licensed" || projectStatus === "completed";

  const handleExport = async (type: ExportType) => {
    if (!isLicensed) return;
    setLoading(type);

    try {
      const url = `/api/projects/${projectId}/export/${type}`;
      const res = await fetch(url);

      if (res.status === 402) {
        // Not licensed — show message
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
        a.download = `thesis.${type === "docx" ? "tex" : type}`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (err) {
      console.error(`Export ${type} failed:`, err);
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
        disabled={!isLicensed}
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>

      {!isLicensed && (
        <p className="mt-1 text-xs text-muted-foreground">
          Purchase a licence to unlock exports
        </p>
      )}

      {open && isLicensed && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border bg-white p-1 shadow-lg">
          {EXPORTS.map(({ type, label, icon: Icon, description }) => (
            <button
              key={type}
              onClick={() => {
                handleExport(type);
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
