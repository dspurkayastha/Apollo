"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { Project } from "@/lib/types/database";

interface AttachDialogProps {
  licenceId: string;
  onAttached: () => void;
}

export function AttachDialog({ licenceId, onAttached }: AttachDialogProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [attaching, setAttaching] = useState(false);

  // Fetch sandbox projects
  useEffect(() => {
    async function fetchSandboxProjects() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/projects");
        if (!res.ok) {
          throw new Error("Failed to fetch projects");
        }

        const { data } = (await res.json()) as { data: Project[] };
        const sandboxProjects = data.filter((p) => p.status === "sandbox");
        setProjects(sandboxProjects);

        if (sandboxProjects.length === 0) {
          setError("No sandbox projects available to attach a licence to.");
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load projects";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    fetchSandboxProjects();
  }, []);

  const handleAttach = useCallback(async () => {
    if (!selectedProjectId) {
      toast.error("Please select a project first.");
      return;
    }

    setAttaching(true);

    try {
      const res = await fetch(
        `/api/licenses/${licenceId}/attach/${selectedProjectId}`,
        { method: "POST" }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(
          errData?.error?.message ?? `Failed to attach licence (${res.status})`
        );
      }

      toast.success("Licence attached successfully.");
      onAttached();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to attach licence";
      toast.error(message);
    } finally {
      setAttaching(false);
    }
  }, [licenceId, selectedProjectId, onAttached]);

  return (
    <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
      <h3 className="mb-1 text-lg font-semibold text-gray-900">
        Attach Licence to Project
      </h3>
      <p className="mb-5 text-sm text-gray-500">
        Select a sandbox project to activate with this licence.
      </p>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span className="ml-2 text-sm text-gray-500">
            Loading projects...
          </span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Project list */}
      {!loading && !error && projects.length > 0 && (
        <div className="mb-5 max-h-64 space-y-2 overflow-y-auto">
          {projects.map((project) => {
            const isSelected = selectedProjectId === project.id;

            return (
              <button
                key={project.id}
                type="button"
                onClick={() => setSelectedProjectId(project.id)}
                className={`w-full rounded-md border-2 p-3 text-left transition-colors ${
                  isSelected
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    isSelected ? "text-blue-900" : "text-gray-900"
                  }`}
                >
                  {project.title}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {project.university_type
                    ? project.university_type.toUpperCase()
                    : "No university set"}{" "}
                  &middot; Created{" "}
                  {new Date(project.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Action buttons */}
      {!loading && !error && projects.length > 0 && (
        <div className="flex justify-end gap-3">
          <button
            type="button"
            disabled={!selectedProjectId || attaching}
            onClick={handleAttach}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {attaching ? "Attaching..." : "Attach Licence"}
          </button>
        </div>
      )}
    </div>
  );
}
