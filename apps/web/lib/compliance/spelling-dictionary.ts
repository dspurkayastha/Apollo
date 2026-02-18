/**
 * Shared American -> British English spelling dictionary.
 *
 * Single source of truth used by:
 * - spell-check.ts (pre-flight British English checker)
 * - final-qc.ts (Final QC British English check)
 * - qc/fix/route.ts (auto-fix spelling action)
 * - review-section.ts (section review spot-check)
 */

/** American -> British spelling replacements (comprehensive medical + general) */
export const AMERICAN_TO_BRITISH: [RegExp, string][] = [
  // -ize -> -ise
  [/\banalyze\b/gi, "analyse"],
  [/\banalyzed\b/gi, "analysed"],
  [/\banalyzing\b/gi, "analysing"],
  [/\borganize\b/gi, "organise"],
  [/\borganized\b/gi, "organised"],
  [/\borganizing\b/gi, "organising"],
  [/\brecognize\b/gi, "recognise"],
  [/\brecognized\b/gi, "recognised"],
  [/\boptimize\b/gi, "optimise"],
  [/\boptimized\b/gi, "optimised"],
  [/\brandomize\b/gi, "randomise"],
  [/\brandomized\b/gi, "randomised"],
  [/\bstandardize\b/gi, "standardise"],
  [/\bstandardized\b/gi, "standardised"],
  [/\bminimize\b/gi, "minimise"],
  [/\bminimized\b/gi, "minimised"],
  [/\bmaximize\b/gi, "maximise"],
  [/\bmaximized\b/gi, "maximised"],
  [/\butilize\b/gi, "utilise"],
  [/\butilized\b/gi, "utilised"],
  [/\bspecialize\b/gi, "specialise"],
  [/\bspecialized\b/gi, "specialised"],
  [/\bhospitalize\b/gi, "hospitalise"],
  [/\bhospitalized\b/gi, "hospitalised"],
  [/\bcategorize\b/gi, "categorise"],
  [/\bcategorized\b/gi, "categorised"],
  [/\bsummarize\b/gi, "summarise"],
  [/\bsummarized\b/gi, "summarised"],
  [/\bcharacterize\b/gi, "characterise"],
  [/\bcharacterized\b/gi, "characterised"],
  // -or -> -our
  [/\bcolor\b/gi, "colour"],
  [/\bbehavior\b/gi, "behaviour"],
  [/\bfavor\b/gi, "favour"],
  [/\bfavorable\b/gi, "favourable"],
  [/\bhonor\b/gi, "honour"],
  [/\bhumor\b/gi, "humour"],
  [/\blabor\b/gi, "labour"],
  [/\bneighbor\b/gi, "neighbour"],
  [/\btumor\b/gi, "tumour"],
  // -er -> -re
  [/\bcenter\b/gi, "centre"],
  [/\bfiber\b/gi, "fibre"],
  [/\bliter\b/gi, "litre"],
  [/\bmeter\b/gi, "metre"],
  // -se -> -ce
  [/\bdefense\b/gi, "defence"],
  [/\boffense\b/gi, "offence"],
  [/\blicense\b/gi, "licence"],
  [/\bpractice\b(?=\s)/gi, "practise"], // Only the verb form
  // Medical terms
  [/\bfetus\b/gi, "foetus"],
  [/\banemia\b/gi, "anaemia"],
  [/\banemic\b/gi, "anaemic"],
  [/\banesthesia\b/gi, "anaesthesia"],
  [/\bdiarrhea\b/gi, "diarrhoea"],
  [/\bedema\b/gi, "oedema"],
  [/\bestrogen\b/gi, "oestrogen"],
  [/\bhemoglobin\b/gi, "haemoglobin"],
  [/\bhemorrhage\b/gi, "haemorrhage"],
  [/\bleukemia\b/gi, "leukaemia"],
  [/\bpediatric\b/gi, "paediatric"],
  [/\bgynecology\b/gi, "gynaecology"],
  [/\borthopedic\b/gi, "orthopaedic"],
  [/\besophagus\b/gi, "oesophagus"],
];
