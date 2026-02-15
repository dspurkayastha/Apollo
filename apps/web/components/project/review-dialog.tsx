"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ReviewIssue } from "@/lib/ai/review-section";

interface ReviewDialogProps {
  open: boolean;
  issues: ReviewIssue[];
  onGoBack: () => void;
  onApproveAnyway: () => void;
}

const SEVERITY_STYLES: Record<string, { label: string; className: string }> = {
  error: { label: "Error", className: "text-destructive" },
  warning: {
    label: "Warning",
    className: "text-[#D4A373]",
  },
  info: { label: "Info", className: "text-[#8B9D77]" },
};

const CATEGORY_LABELS: Record<string, string> = {
  citation: "Citations",
  "word-count": "Word Count",
  structure: "Structure",
  spelling: "Spelling",
};

export function ReviewDialog({
  open,
  issues,
  onGoBack,
  onApproveAnyway,
}: ReviewDialogProps) {
  const warnings = issues.filter((i) => i.severity === "warning");
  const infos = issues.filter((i) => i.severity === "info");
  const errors = issues.filter((i) => i.severity === "error");

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-h-[80vh] overflow-y-auto rounded-2xl border border-black/[0.06]">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-[#2F2F2F]">Section Review</AlertDialogTitle>
          <AlertDialogDescription className="text-[#6B6B6B]">
            {warnings.length + errors.length > 0
              ? `Found ${warnings.length + errors.length} issue${warnings.length + errors.length !== 1 ? "s" : ""} to review before approving.`
              : "Minor suggestions found — no blocking issues."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          {errors.length > 0 && (
            <IssueGroup title="Errors" issues={errors} />
          )}
          {warnings.length > 0 && (
            <IssueGroup title="Warnings" issues={warnings} />
          )}
          {infos.length > 0 && (
            <IssueGroup title="Suggestions" issues={infos} />
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onGoBack}
            className="rounded-full border-black/[0.06]"
          >
            Go Back &amp; Edit
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onApproveAnyway}
            className="rounded-full bg-[#2F2F2F] text-white hover:bg-[#2F2F2F]/90"
          >
            Approve Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function IssueGroup({
  title,
  issues,
}: {
  title: string;
  issues: ReviewIssue[];
}) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-medium text-[#2F2F2F]">{title}</h4>
      <ul className="space-y-1.5">
        {issues.map((issue, idx) => {
          const style = SEVERITY_STYLES[issue.severity] ?? SEVERITY_STYLES.info;
          const categoryLabel =
            CATEGORY_LABELS[issue.category] ?? issue.category;
          return (
            <li key={idx} className="text-sm text-[#6B6B6B]">
              <span className={`font-medium ${style.className}`}>
                [{categoryLabel}]
              </span>{" "}
              {issue.message}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
