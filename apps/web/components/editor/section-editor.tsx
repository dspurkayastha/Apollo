"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  EditorRoot,
  EditorContent,
  EditorBubble,
  EditorBubbleItem,
  type JSONContent,
  StarterKit,
  Placeholder,
  TiptapLink,
  HorizontalRule,
} from "novel";
import { Bold, Italic, Underline, Code, Save, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CitationSearchDialog } from "@/components/project/citation-search-dialog";

// Configure extensions — StarterKit includes doc, paragraph, text, headings, lists, etc.
const starterKit = StarterKit.configure({
  bulletList: {
    HTMLAttributes: { class: "list-disc list-outside leading-3 -mt-2" },
  },
  orderedList: {
    HTMLAttributes: { class: "list-decimal list-outside leading-3 -mt-2" },
  },
  listItem: {
    HTMLAttributes: { class: "leading-normal -mb-2" },
  },
  blockquote: {
    HTMLAttributes: { class: "border-l-4 border-[#8B9D77]" },
  },
  code: {
    HTMLAttributes: {
      class: "rounded-md bg-[#F5F5F5] px-1.5 py-1 font-mono font-medium",
      spellcheck: "false",
    },
  },
  codeBlock: {
    HTMLAttributes: {
      class: "rounded-sm bg-[#F5F5F5] border border-black/[0.06] p-5 font-mono font-medium",
    },
  },
  horizontalRule: false,
  dropcursor: { color: "#8B9D77", width: 4 },
  gapcursor: false,
});

const placeholder = Placeholder.configure({
  placeholder: "Start writing...",
  emptyNodeClass: "text-[#D1D1D1]",
});

const tiptapLink = TiptapLink.configure({
  HTMLAttributes: {
    class:
      "text-[#6B6B6B] underline underline-offset-[3px] hover:text-[#2F2F2F] transition-colors cursor-pointer",
  },
});

const horizontalRule = HorizontalRule.configure({
  HTMLAttributes: {
    class: "mt-4 mb-6 border-t border-black/[0.06]",
  },
});

const extensions = [starterKit, placeholder, tiptapLink, horizontalRule];

interface SectionEditorProps {
  projectId: string;
  phaseNumber: number;
  initialContent: JSONContent | null;
  onSaveSuccess?: () => void;
}

const AUTO_SAVE_DELAY_MS = 30_000;

export function SectionEditor({
  projectId,
  phaseNumber,
  initialContent,
  onSaveSuccess,
}: SectionEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [citationSearchOpen, setCitationSearchOpen] = useState(false);
  const contentRef = useRef<JSONContent | null>(initialContent);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveContent = useCallback(async () => {
    if (!contentRef.current) return;
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/sections/${phaseNumber}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rich_content_json: contentRef.current,
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

  // Auto-save on debounce
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      void saveContent();
    }, AUTO_SAVE_DELAY_MS);
  }, [saveContent]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const handleUpdate = useCallback(
    ({ editor }: { editor: { getJSON: () => JSONContent } }) => {
      contentRef.current = editor.getJSON();
      setIsDirty(true);
      scheduleAutoSave();
    },
    [scheduleAutoSave]
  );

  const defaultContent: JSONContent = initialContent ?? {
    type: "doc",
    content: [{ type: "paragraph" }],
  };

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
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCitationSearchOpen(true)}
            title="Search & insert citation"
          >
            <BookOpen className="mr-1.5 h-3.5 w-3.5" />
            Cite
          </Button>
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

      {/* Editor */}
      <EditorRoot>
        <EditorContent
          extensions={extensions}
          initialContent={defaultContent}
          onUpdate={handleUpdate}
          className="prose prose-sm max-w-none rounded-2xl border border-black/[0.06] p-6 font-serif text-[18px] leading-[32px] focus-within:ring-2 focus-within:ring-[#2F2F2F]/10 md:text-[20px]"
          editorProps={{
            attributes: {
              class: "outline-none min-h-[300px]",
            },
          }}
        >
          {/* Bubble menu for inline formatting — glass styling */}
          <EditorBubble className="flex items-center gap-1 rounded-xl border border-white/30 bg-white/80 p-1 shadow-[0_4px_20px_rgba(0,0,0,0.06)] backdrop-blur-[20px]">
            <EditorBubbleItem
              onSelect={(editor) => editor.chain().focus().toggleBold().run()}
            >
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                <Bold className="h-3.5 w-3.5" />
              </Button>
            </EditorBubbleItem>
            <EditorBubbleItem
              onSelect={(editor) => editor.chain().focus().toggleItalic().run()}
            >
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                <Italic className="h-3.5 w-3.5" />
              </Button>
            </EditorBubbleItem>
            <EditorBubbleItem
              onSelect={(editor) =>
                editor.chain().focus().toggleUnderline().run()
              }
            >
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                <Underline className="h-3.5 w-3.5" />
              </Button>
            </EditorBubbleItem>
            <EditorBubbleItem
              onSelect={(editor) => editor.chain().focus().toggleCode().run()}
            >
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                <Code className="h-3.5 w-3.5" />
              </Button>
            </EditorBubbleItem>
          </EditorBubble>
        </EditorContent>
      </EditorRoot>

      {/* Citation search dialog */}
      <CitationSearchDialog
        projectId={projectId}
        open={citationSearchOpen}
        onOpenChange={setCitationSearchOpen}
        onInsert={(citeKey) => {
          setCitationSearchOpen(false);
          // Insert \cite{key} as code-marked text at current cursor
          if (contentRef.current) {
            const citeText = `\\cite{${citeKey}}`;
            // Append as a code node in the current content
            const doc = contentRef.current;
            if (doc.content && doc.content.length > 0) {
              const lastNode = doc.content[doc.content.length - 1];
              if (lastNode.type === "paragraph") {
                lastNode.content = [
                  ...(lastNode.content ?? []),
                  {
                    type: "text",
                    marks: [{ type: "code" }],
                    text: citeText,
                  },
                ];
                setIsDirty(true);
                scheduleAutoSave();
              }
            }
          }
        }}
      />
    </div>
  );
}
