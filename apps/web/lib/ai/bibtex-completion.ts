/**
 * BibTeX trailer integrity validation and completion.
 *
 * After AI generates a response, validates that every \cite{key} in the body
 * has a matching BibTeX entry in the trailer. If entries are missing (e.g. due
 * to max_tokens truncation), makes a targeted follow-up request for ONLY the
 * missing entries.
 */

import { extractCiteKeys } from "@/lib/citations/extract-keys";
import { splitBibtex } from "@/lib/latex/assemble";
import { getAnthropicClient } from "./client";

/**
 * Extract cite keys that appear in BibTeX entries.
 * Matches @article{key, / @book{key, etc.
 */
function extractBibtexEntryKeys(bibtex: string): Set<string> {
  const keys = new Set<string>();
  const re = /@\w+\s*\{\s*([^,\s]+)\s*,/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bibtex)) !== null) {
    keys.add(m[1].trim());
  }
  return keys;
}

export interface BibtexIntegrityResult {
  complete: boolean;
  missingKeys: string[];
  bodyKeyCount: number;
  entryCount: number;
}

/**
 * Check if every \cite{key} in the body has a matching BibTeX entry.
 */
export function checkBibtexIntegrity(fullResponse: string): BibtexIntegrityResult {
  const { body, bib } = splitBibtex(fullResponse);
  const bodyKeys = new Set(extractCiteKeys(body));
  const entryKeys = extractBibtexEntryKeys(bib);

  const missingKeys = [...bodyKeys].filter((k) => !entryKeys.has(k));

  return {
    complete: missingKeys.length === 0,
    missingKeys,
    bodyKeyCount: bodyKeys.size,
    entryCount: entryKeys.size,
  };
}

/**
 * Request missing BibTeX entries from the AI.
 * Returns ONLY the missing entries as a BibTeX string.
 */
export async function requestMissingBibtexEntries(
  missingKeys: string[],
  originalBody: string,
): Promise<string> {
  if (missingKeys.length === 0) return "";

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: Math.max(2000, missingKeys.length * 200),
    system: `You are a bibliographer. Generate complete BibTeX entries for the given citation keys based on the chapter context. Output ONLY valid BibTeX entries --- no explanation, no markdown fences. Use ASCII only (no Unicode). Each entry must have: author, title, journal/publisher, year. Use realistic but plausible bibliographic data consistent with the chapter content.`,
    messages: [{
      role: "user",
      content: `The following citation keys were used in a medical thesis chapter but their BibTeX entries are missing. Generate complete BibTeX entries for each.\n\nMissing keys: ${missingKeys.join(", ")}\n\nChapter context (first 2000 chars for reference):\n${originalBody.slice(0, 2000)}`,
    }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.type === "text" ? textBlock.text : "";
}
