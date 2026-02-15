"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Abbreviation } from "@/lib/types/database";

interface AbbreviationManagerProps {
  projectId: string;
  abbreviations: Abbreviation[];
}

export function AbbreviationManager({
  projectId,
  abbreviations: initialAbbreviations,
}: AbbreviationManagerProps) {
  const [abbreviations, setAbbreviations] = useState<Abbreviation[]>(initialAbbreviations);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newShortForm, setNewShortForm] = useState("");
  const [newLongForm, setNewLongForm] = useState("");
  const [editShortForm, setEditShortForm] = useState("");
  const [editLongForm, setEditLongForm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!newShortForm.trim() || !newLongForm.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/abbreviations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          short_form: newShortForm.trim(),
          long_form: newLongForm.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message ?? "Failed to add abbreviation");
      }

      const { data } = await res.json();
      setAbbreviations((prev) =>
        [...prev, data].sort((a, b) => a.short_form.localeCompare(b.short_form))
      );
      setNewShortForm("");
      setNewLongForm("");
      setIsAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add abbreviation");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdate(abbrevId: string) {
    if (!editShortForm.trim() || !editLongForm.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/projects/${projectId}/abbreviations/${abbrevId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            short_form: editShortForm.trim(),
            long_form: editLongForm.trim(),
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message ?? "Failed to update abbreviation");
      }

      const { data } = await res.json();
      setAbbreviations((prev) =>
        prev
          .map((a) => (a.id === abbrevId ? data : a))
          .sort((a, b) => a.short_form.localeCompare(b.short_form))
      );
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update abbreviation");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(abbrevId: string) {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/projects/${projectId}/abbreviations/${abbrevId}`,
        { method: "DELETE" }
      );

      if (!res.ok && res.status !== 204) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message ?? "Failed to delete abbreviation");
      }

      setAbbreviations((prev) => prev.filter((a) => a.id !== abbrevId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete abbreviation");
    } finally {
      setIsLoading(false);
    }
  }

  function startEdit(abbr: Abbreviation) {
    setEditingId(abbr.id);
    setEditShortForm(abbr.short_form);
    setEditLongForm(abbr.long_form);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditShortForm("");
    setEditLongForm("");
  }

  function cancelAdd() {
    setIsAdding(false);
    setNewShortForm("");
    setNewLongForm("");
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Abbreviations</h3>
        {!isAdding && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsAdding(true);
              setError(null);
            }}
            disabled={isLoading}
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2 pr-4 font-medium text-muted-foreground">
                Short Form
              </th>
              <th className="pb-2 pr-4 font-medium text-muted-foreground">
                Long Form
              </th>
              <th className="pb-2 w-24 font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isAdding && (
              <tr className="border-b">
                <td className="py-2 pr-4">
                  <input
                    type="text"
                    value={newShortForm}
                    onChange={(e) => setNewShortForm(e.target.value)}
                    placeholder="e.g. WHO"
                    maxLength={20}
                    className="w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    disabled={isLoading}
                    autoFocus
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="text"
                    value={newLongForm}
                    onChange={(e) => setNewLongForm(e.target.value)}
                    placeholder="e.g. World Health Organisation"
                    maxLength={500}
                    className="w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    disabled={isLoading}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAdd();
                      if (e.key === "Escape") cancelAdd();
                    }}
                  />
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleAdd}
                      disabled={isLoading || !newShortForm.trim() || !newLongForm.trim()}
                      title="Save"
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={cancelAdd}
                      disabled={isLoading}
                      title="Cancel"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </td>
              </tr>
            )}

            {abbreviations.map((abbr) => (
              <tr key={abbr.id} className="border-b last:border-b-0">
                {editingId === abbr.id ? (
                  <>
                    <td className="py-2 pr-4">
                      <input
                        type="text"
                        value={editShortForm}
                        onChange={(e) => setEditShortForm(e.target.value)}
                        maxLength={20}
                        className="w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        disabled={isLoading}
                        autoFocus
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        type="text"
                        value={editLongForm}
                        onChange={(e) => setEditLongForm(e.target.value)}
                        maxLength={500}
                        className="w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        disabled={isLoading}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdate(abbr.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUpdate(abbr.id)}
                          disabled={
                            isLoading ||
                            !editShortForm.trim() ||
                            !editLongForm.trim()
                          }
                          title="Save"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={cancelEdit}
                          disabled={isLoading}
                          title="Cancel"
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2 pr-4 font-mono">{abbr.short_form}</td>
                    <td className="py-2 pr-4">{abbr.long_form}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(abbr)}
                          disabled={isLoading}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(abbr.id)}
                          disabled={isLoading}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}

            {abbreviations.length === 0 && !isAdding && (
              <tr>
                <td
                  colSpan={3}
                  className="py-8 text-center text-muted-foreground"
                >
                  No abbreviations yet. Add one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
