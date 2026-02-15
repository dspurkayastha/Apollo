"use client";

import { useState, useCallback, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LaTeXSourceViewProps {
  projectId: string;
  phaseNumber: number;
  initialContent: string;
  onSaveSuccess?: () => void;
}

export function LaTeXSourceView({
  projectId,
  phaseNumber,
  initialContent,
  onSaveSuccess,
}: LaTeXSourceViewProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const contentRef = useRef(initialContent);

  const handleChange = useCallback((value: string) => {
    contentRef.current = value;
    setIsDirty(true);
  }, []);

  const saveContent = useCallback(async () => {
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/sections/${phaseNumber}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latex_content: contentRef.current,
          }),
        }
      );
      if (response.ok) {
        setIsDirty(false);
        setLastSaved(new Date());
        onSaveSuccess?.();
      }
    } finally {
      setIsSaving(false);
    }
  }, [projectId, phaseNumber, onSaveSuccess]);

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-1 font-mono text-[12px] text-[#6B6B6B]">
          {isDirty && <span>Unsaved changes</span>}
          {lastSaved && !isDirty && (
            <span>Saved {lastSaved.toLocaleTimeString()}</span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void saveContent()}
          disabled={isSaving || !isDirty}
        >
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {isSaving ? "Saving\u2026" : "Save"}
        </Button>
      </div>

      {/* CodeMirror editor — light theme for Zen palette */}
      <CodeMirror
        value={initialContent}
        onChange={handleChange}
        height="500px"
        theme="light"
        className="rounded-2xl border border-black/[0.06] text-sm shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          bracketMatching: true,
        }}
      />
    </div>
  );
}
