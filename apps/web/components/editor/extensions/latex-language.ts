import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";

/**
 * CodeMirror 6 LaTeX language support via the legacy stex grammar.
 * Provides syntax highlighting for LaTeX commands, environments,
 * math mode, comments, and braces.
 */
export const latexLanguage = StreamLanguage.define(stex);
