"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  CheckCircle2,
  FileText,
  Table2,
  AlertTriangle,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import type { Project, Section, Dataset, Citation } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/project/export-menu";

interface ThesisCompletionProps {
  project: Project;
  sections: Section[];
  datasets: Dataset[];
  citations: Citation[];
}

const EASE = [0.16, 1, 0.3, 1] as const;

function CursorGlowCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = cardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
      el.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
    },
    []
  );

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`group relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white transition-[border-color,box-shadow] duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[#8B9D77]/30 hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] ${className}`}
    >
      {/* Cursor-tracking sage glow overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(139,157,119,0.15) 0%, rgba(139,157,119,0.12) 20%, rgba(139,157,119,0.06) 40%, transparent 80%)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

export function ThesisCompletion({
  project,
  sections,
  datasets,
  citations,
}: ThesisCompletionProps) {
  const router = useRouter();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);

  const totalWords = sections.reduce((sum, s) => sum + (s.word_count || 0), 0);
  const approxPages = Math.round(totalWords / 250);
  const tierACitations = citations.filter(
    (c) => c.provenance_tier === "A"
  ).length;
  const dataset = datasets[0] ?? null;
  const completionDate = new Date(project.updated_at).toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "long", year: "numeric" }
  );

  const handleDownloadPdf = useCallback(async () => {
    setDownloadingPdf(true);
    try {
      const res = await fetch(
        `/api/projects/${project.id}/preview.pdf?download=1`
      );
      if (!res.ok) return;
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "thesis.pdf";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // Download failure is non-blocking
    } finally {
      setDownloadingPdf(false);
    }
  }, [project.id]);

  const handleDownloadCsv = useCallback(async () => {
    if (!dataset) return;
    setDownloadingCsv(true);
    try {
      const res = await fetch(
        `/api/projects/${project.id}/datasets/${dataset.id}/download`
      );
      if (!res.ok) return;
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "dataset.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // Download failure is non-blocking
    } finally {
      setDownloadingCsv(false);
    }
  }, [project.id, dataset]);

  const stats = [
    {
      value: totalWords.toLocaleString("en-GB"),
      label: `~${approxPages} pages`,
    },
    { value: "12/12", label: "Phases completed" },
    {
      value: tierACitations.toString(),
      label: `Verified Tier A citation${tierACitations !== 1 ? "s" : ""}`,
    },
    {
      value: dataset?.row_count?.toLocaleString("en-GB") ?? "---",
      label: "Dataset rows",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Success Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="flex flex-col items-center text-center"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#8B9D77]/10">
          <CheckCircle2 className="h-10 w-10 text-[#8B9D77]" />
        </div>
        <h1
          className="mt-5 text-3xl font-semibold tracking-tight text-[#2F2F2F]"
          style={{ fontFamily: "var(--font-brand)" }}
        >
          Thesis Complete
        </h1>
        <p
          className="mt-2 max-w-md text-lg text-[#6B6B6B]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {project.title}
        </p>
        <p className="mt-1 text-sm text-[#9B9B9B]">
          Completed on {completionDate}
        </p>
      </motion.div>

      {/* Download Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <CursorGlowCard className="landing-card-elevated p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#8B9D77]/10">
              <FileText className="h-5 w-5 text-[#8B9D77]" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-serif font-semibold text-[#2F2F2F]">
                Download Thesis PDF
              </h3>
              <p className="mt-1 text-sm text-[#6B6B6B]">
                Fully compiled, publication-ready document
              </p>
              <Button
                size="sm"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="mt-3 gap-1.5 rounded-full"
              >
                {downloadingPdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
                {downloadingPdf ? "Downloading..." : "Download PDF"}
              </Button>
            </div>
          </div>
        </CursorGlowCard>

        <CursorGlowCard className="landing-card-elevated p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#8B9D77]/10">
              <Table2 className="h-5 w-5 text-[#8B9D77]" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-serif font-semibold text-[#2F2F2F]">
                Download Dataset
              </h3>
              <p className="mt-1 text-sm text-[#6B6B6B]">
                {dataset
                  ? `${dataset.row_count?.toLocaleString("en-GB") ?? "---"} rows, ${dataset.columns_json?.length ?? 0} columns`
                  : "No dataset uploaded for this project"}
              </p>
              <Button
                size="sm"
                onClick={handleDownloadCsv}
                disabled={!dataset || downloadingCsv}
                variant={dataset ? "default" : "outline"}
                className="mt-3 gap-1.5 rounded-full"
              >
                {downloadingCsv ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Table2 className="h-3.5 w-3.5" />
                )}
                {downloadingCsv ? "Downloading..." : "Download CSV"}
              </Button>
            </div>
          </div>
        </CursorGlowCard>
      </motion.div>

      {/* Statistics Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-black/[0.06] bg-white p-5 text-center landing-card"
          >
            <p
              className="text-2xl font-semibold text-[#2F2F2F]"
              style={{ fontFamily: "var(--font-brand)" }}
            >
              {stat.value}
            </p>
            <p className="mt-1 text-sm text-[#6B6B6B]">{stat.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Disclaimers */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.35 }}
        className="rounded-2xl border border-[#D4A373]/20 bg-[#D4A373]/5 p-5"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#D4A373]" />
          <div className="space-y-2 text-sm text-[#6B6B6B]">
            <p className="font-medium text-[#2F2F2F]">Important Notices</p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                This thesis was generated with AI assistance. All content should
                be reviewed for accuracy before submission.
              </li>
              <li>
                The student bears full responsibility for the accuracy of all
                content, citations, and data presented in this thesis.
              </li>
              <li>
                Please have your thesis guide review the final document before
                institutional submission.
              </li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Actions Footer */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.5 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard")}
          className="gap-1.5 rounded-full"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <ExportMenu projectId={project.id} projectStatus={project.status} />
      </motion.div>
    </div>
  );
}
