"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Save, Loader2, X } from "lucide-react";

interface MermaidEditorProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

const DEFAULT_SOURCE = `flowchart TD
    A[Study Population] --> B{Eligibility Criteria}
    B -->|Included| C[Enrolled n=100]
    B -->|Excluded| D[Excluded n=20]
    C --> E[Group A n=50]
    C --> F[Group B n=50]
    E --> G[Analysis]
    F --> G
`;

export function MermaidEditor({
  projectId,
  open,
  onClose,
}: MermaidEditorProps) {
  const router = useRouter();
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [caption, setCaption] = useState("Study Flow Diagram");
  const [label, setLabel] = useState("fig:flowchart");
  const [saving, setSaving] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Render Mermaid preview
  useEffect(() => {
    if (!open || !previewRef.current) return;

    let cancelled = false;

    const renderMermaid = async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "strict",
        });

        if (cancelled || !previewRef.current) return;

        // Clear previous content
        previewRef.current.innerHTML = "";

        const { svg } = await mermaid.render(
          `mermaid-preview-${Date.now()}`,
          source
        );

        if (cancelled || !previewRef.current) return;

        previewRef.current.innerHTML = svg;
        setRenderError(null);
      } catch (err) {
        if (!cancelled) {
          setRenderError(
            err instanceof Error ? err.message : "Invalid Mermaid syntax"
          );
        }
      }
    };

    // Debounce rendering
    const timer = setTimeout(renderMermaid, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source, open]);

  const handleSave = useCallback(async () => {
    if (!label.match(/^fig:[a-z0-9-]+$/)) {
      toast.error("Label must match fig:lowercase-dashes format");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/figures/mermaid`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_code: source,
            caption,
            label,
            figure_type: "flowchart",
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? "Save failed");
      }

      toast.success("Mermaid diagram saved as figure");
      router.refresh();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [projectId, source, caption, label, router, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="flex h-[80vh] w-[90vw] max-w-5xl flex-col overflow-hidden rounded-lg bg-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-lg font-semibold">Mermaid Diagram Editor</h3>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !!renderError}
              className="gap-1.5"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save as Figure
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex gap-3 border-b p-3">
          <div className="flex-1">
            <Input
              placeholder="Caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="w-48">
            <Input
              placeholder="fig:label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>

        {/* Split pane */}
        <div className="flex flex-1 overflow-hidden">
          {/* Source editor */}
          <div className="flex-1 border-r">
            <textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="h-full w-full resize-none bg-background p-4 font-mono text-sm focus:outline-none"
              spellCheck={false}
            />
          </div>

          {/* Preview */}
          <div className="flex-1 overflow-auto p-4">
            {renderError ? (
              <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-500">
                {renderError}
              </div>
            ) : (
              <div
                ref={previewRef}
                className="flex items-center justify-center [&_svg]:max-w-full"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
