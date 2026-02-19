"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import type { EditorView } from "@codemirror/view";
import { keymap } from "@codemirror/view";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LaTeXToolbar } from "./latex-toolbar";
import { CitationSearchDialog } from "@/components/project/citation-search-dialog";
import { latexLanguage } from "./extensions/latex-language";
import { citationDecorations } from "./extensions/citation-decorations";
import { mathTooltip } from "./extensions/math-tooltip";
import { environmentFold } from "./extensions/environment-fold";

interface LaTeXEditorProps {
  projectId: string;
  phaseNumber: number;
  initialContent: string;
  onSaveSuccess?: () => void;
  onContentChange?: (content: string) => void;
}

const AUTO_SAVE_DELAY_MS = 30_000;

export function LaTeXEditor({
  projectId,
  phaseNumber,
  initialContent,
  onSaveSuccess,
  onContentChange,
}: LaTeXEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [citationSearchOpen, setCitationSearchOpen] = useState(false);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const contentRef = useRef(initialContent);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cmRef = useRef<ReactCodeMirrorRef>(null);

  const saveContent = useCallback(async () => {
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/sections/${phaseNumber}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latex_content: contentRef.current }),
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

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      void saveContent();
    }, AUTO_SAVE_DELAY_MS);
  }, [saveContent]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Capture editor view on mount — no deps array intentional: CodeMirror
  // lazily creates the view after the first render, so we need to re-check
  // on every render until the view is available.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (cmRef.current?.view) {
      setEditorView(cmRef.current.view);
    }
  });

  const handleChange = useCallback(
    (value: string) => {
      contentRef.current = value;
      setIsDirty(true);
      scheduleAutoSave();
      onContentChange?.(value);
    },
    [scheduleAutoSave, onContentChange]
  );

  // Cmd/Ctrl+S save shortcut
  const saveKeymap = useMemo(
    () =>
      keymap.of([
        {
          key: "Mod-s",
          run: () => {
            void saveContent();
            return true;
          },
        },
      ]),
    [saveContent]
  );

  const extensions = useMemo(
    () => [
      latexLanguage,
      citationDecorations,
      mathTooltip,
      environmentFold,
      saveKeymap,
    ],
    [saveKeymap]
  );

  const handleInsertCitation = useCallback(
    (citeKey: string) => {
      setCitationSearchOpen(false);
      if (editorView) {
        const pos = editorView.state.selection.main.head;
        editorView.dispatch({
          changes: { from: pos, insert: `\\cite{${citeKey}}` },
        });
        editorView.focus();
      }
    },
    [editorView]
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar row */}
      <div className="flex items-center justify-between gap-2">
        <LaTeXToolbar view={editorView} onCiteClick={() => setCitationSearchOpen(true)} />

        <div className="flex shrink-0 items-center gap-2">
          <div className="font-mono text-[12px] text-[#6B6B6B]">
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
      </div>

      {/* CodeMirror editor */}
      <CodeMirror
        ref={cmRef}
        value={initialContent}
        onChange={handleChange}
        height="calc(100vh - 200px)"
        theme="light"
        extensions={extensions}
        className="rounded-2xl border border-black/[0.06] text-sm shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          bracketMatching: true,
        }}
      />

      {/* Citation search dialog */}
      <CitationSearchDialog
        projectId={projectId}
        open={citationSearchOpen}
        onOpenChange={setCitationSearchOpen}
        onInsert={handleInsertCitation}
      />
    </div>
  );
}
