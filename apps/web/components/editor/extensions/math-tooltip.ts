import { hoverTooltip, type EditorView, type Tooltip } from "@codemirror/view";
import katex from "katex";

/**
 * Detect whether the position is inside a `$...$` or `$$...$$` math region.
 * Returns the math content (without delimiters) if found.
 */
function getMathAtPos(
  view: EditorView,
  pos: number
): { from: number; to: number; math: string; display: boolean } | null {
  const line = view.state.doc.lineAt(pos);
  const text = line.text;
  const offset = pos - line.from;

  // Try display math first ($$...$$)
  const displayRe = /\$\$([^$]+)\$\$/g;
  let match: RegExpExecArray | null;
  while ((match = displayRe.exec(text)) !== null) {
    if (offset >= match.index && offset <= match.index + match[0].length) {
      return {
        from: line.from + match.index,
        to: line.from + match.index + match[0].length,
        math: match[1],
        display: true,
      };
    }
  }

  // Try inline math ($...$)
  const inlineRe = /(?<!\$)\$(?!\$)([^$]+)\$(?!\$)/g;
  while ((match = inlineRe.exec(text)) !== null) {
    if (offset >= match.index && offset <= match.index + match[0].length) {
      return {
        from: line.from + match.index,
        to: line.from + match.index + match[0].length,
        math: match[1],
        display: false,
      };
    }
  }

  return null;
}

/**
 * Hover tooltip that renders KaTeX-processed math when hovering over
 * `$...$` (inline) or `$$...$$` (display) math regions.
 */
export const mathTooltip = hoverTooltip(
  (view: EditorView, pos: number): Tooltip | null => {
    const result = getMathAtPos(view, pos);
    if (!result) return null;

    return {
      pos: result.from,
      end: result.to,
      above: true,
      create() {
        const dom = document.createElement("div");
        dom.className = "cm-math-tooltip";
        try {
          dom.innerHTML = katex.renderToString(result.math, {
            displayMode: result.display,
            throwOnError: false,
          });
        } catch {
          dom.textContent = result.math;
        }
        return { dom };
      },
    };
  }
);
