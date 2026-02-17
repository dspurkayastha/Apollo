import { foldService } from "@codemirror/language";

/**
 * Custom fold service for LaTeX environments.
 * Detects `\begin{env}` at a line and folds to the matching `\end{env}`,
 * handling nested environments via depth tracking.
 */
export const environmentFold = foldService.of((state, from, to) => {
  const line = state.doc.lineAt(from);
  const beginMatch = line.text.match(/\\begin\{(\w+)\}/);
  if (!beginMatch) return null;

  const envName = beginMatch[1];
  let depth = 1;
  const beginRe = new RegExp(`\\\\begin\\{${envName}\\}`, "g");
  const endRe = new RegExp(`\\\\end\\{${envName}\\}`, "g");

  for (let lineNum = line.number + 1; lineNum <= state.doc.lines; lineNum++) {
    const l = state.doc.line(lineNum);
    const opens = (l.text.match(beginRe) ?? []).length;
    const closes = (l.text.match(endRe) ?? []).length;
    depth += opens - closes;

    if (depth <= 0) {
      // Fold from end of \begin line to start of \end line
      return { from: line.to, to: l.from - 1 };
    }
  }

  return null;
});
