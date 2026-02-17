"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ResetProjectButtonProps {
  projectId: string;
}

export function ResetProjectButton({ projectId }: ResetProjectButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleReset() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/reset`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Failed to reset project");
      }

      toast.success("Project reset to Phase 0");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to reset project"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
          Reset Project
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset project to Phase 0?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete all sections, citations, figures,
            analyses, compilations, and conversations. Your project will be
            reset to Phase 0 (Orientation). This action cannot be undone.
            <br />
            <br />
            <strong>You have 1 free reset per licence.</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleReset}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            Reset Project
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
