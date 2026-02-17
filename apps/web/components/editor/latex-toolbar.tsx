"use client";

import type { EditorView } from "@codemirror/view";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  BookOpen,
  List,
  ListOrdered,
  Sigma,
} from "lucide-react";

interface LaTeXToolbarProps {
  view: EditorView | null;
  onCiteClick: () => void;
}

function wrapSelection(view: EditorView, before: string, after: string) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: `${before}${selected}${after}` },
    selection: { anchor: from + before.length, head: from + before.length + selected.length },
  });
  view.focus();
}

function wrapLines(view: EditorView, envName: string) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const lines = selected.split("\n").filter((l: string) => l.trim());
  const items = lines.length > 0
    ? lines.map((l: string) => `  \\item ${l.trim()}`).join("\n")
    : "  \\item ";
  const wrapped = `\\begin{${envName}}\n${items}\n\\end{${envName}}`;
  view.dispatch({
    changes: { from, to, insert: wrapped },
  });
  view.focus();
}

const BUTTONS = [
  { label: "Bold", icon: Bold, action: (v: EditorView) => wrapSelection(v, "\\textbf{", "}") },
  { label: "Italic", icon: Italic, action: (v: EditorView) => wrapSelection(v, "\\textit{", "}") },
  { label: "Underline", icon: Underline, action: (v: EditorView) => wrapSelection(v, "\\underline{", "}") },
  { label: "Section", icon: Heading1, action: (v: EditorView) => wrapSelection(v, "\\section{", "}") },
  { label: "Subsection", icon: Heading2, action: (v: EditorView) => wrapSelection(v, "\\subsection{", "}") },
  { label: "Bullet list", icon: List, action: (v: EditorView) => wrapLines(v, "itemize") },
  { label: "Numbered list", icon: ListOrdered, action: (v: EditorView) => wrapLines(v, "enumerate") },
  { label: "Math", icon: Sigma, action: (v: EditorView) => wrapSelection(v, "$", "$") },
] as const;

export function LaTeXToolbar({ view, onCiteClick }: LaTeXToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-black/[0.06] bg-white/80 px-1.5 py-1 backdrop-blur-sm">
      {BUTTONS.map(({ label, icon: Icon, action }) => (
        <Button
          key={label}
          size="sm"
          variant="ghost"
          title={label}
          className="h-7 w-7 p-0 text-[#6B6B6B] hover:text-[#2F2F2F]"
          onClick={() => view && action(view)}
          disabled={!view}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      ))}

      <div className="mx-1 h-4 w-px bg-black/[0.06]" />

      <Button
        size="sm"
        variant="ghost"
        title="Insert citation"
        className="h-7 gap-1 px-2 text-xs text-[#6B6B6B] hover:text-[#2F2F2F]"
        onClick={onCiteClick}
      >
        <BookOpen className="h-3.5 w-3.5" />
        Cite
      </Button>
    </div>
  );
}
