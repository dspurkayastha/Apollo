import {
  ViewPlugin,
  Decoration,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

const citeMark = Decoration.mark({ class: "cm-cite-chip" });

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const citeRe = /\\cite\{[^}]+\}/g;

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    let match: RegExpExecArray | null;
    citeRe.lastIndex = 0;
    while ((match = citeRe.exec(text)) !== null) {
      builder.add(from + match.index, from + match.index + match[0].length, citeMark);
    }
  }

  return builder.finish();
}

/**
 * ViewPlugin that decorates `\cite{key}` patterns with a styled CSS class.
 * The `.cm-cite-chip` class renders citation keys as sage-coloured badges.
 */
export const citationDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v: { decorations: DecorationSet }) => v.decorations,
  }
);
