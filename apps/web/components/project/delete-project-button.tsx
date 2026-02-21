"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface DeleteProjectButtonProps {
  projectId: string;
  projectTitle: string;
}

export function DeleteProjectButton({
  projectId,
  projectTitle,
}: DeleteProjectButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setDeleting(true);
    try {
      const resp = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      if (resp.ok) {
        toast.success("Project deleted.");
        router.refresh();
      } else {
        const body = await resp.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to delete project. Please try again.");
      }
    } catch {
      toast.error("Failed to delete project. Please try again.");
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div
        className="flex items-center gap-2"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <span className="text-xs text-destructive">Delete?</span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void handleDelete();
          }}
          disabled={deleting}
          className="rounded px-2 py-0.5 text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
        >
          {deleting ? "..." : "Yes"}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setConfirming(false);
          }}
          className="rounded px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirming(true);
      }}
      className="rounded p-1 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
      title={`Delete ${projectTitle}`}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
