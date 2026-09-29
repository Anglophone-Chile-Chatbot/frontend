/**
 * Locates the retrieval search terms inside a cited passage, so the viewer
 * can shade the words that actually triggered the match.
 *
 * Terms arrive on the chat `sources` frame: the query rewrite's words (1–3
 * word phrases in period vocabulary) or, when the rewrite fell back, the
 * reader's own content words. Matching is case-insensitive, accent-folded
 * (a reader's "Valparaiso" still marks "Valparaíso") and anchored at a word
 * start, so "horse" marks "horses" but not "seahorse".
 */

export type TermRange = { start: number; end: number };

/**
 * Folds one string to lowercase, accent-free form WITHOUT changing its length.
 *
 * `normalize("NFD")` over the whole string is not safe here: text that is
 * already decomposed, or a character whose decomposition is longer, shifts
 * every later index, and the ranges would then mark the wrong letters of the
 * original. Folding per UTF-16 unit and keeping exactly one unit out per unit
 * in keeps indices aligned with the unfolded text.
 */
function foldSameLength(text: string): string {
  let out = "";
  for (const unit of text) {
    const folded = unit.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    out += folded.length === unit.length ? folded : unit;
  }
  return out;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns non-overlapping ranges of `text` matching any term, in order.
 *
 * Each term matches as a whole phrase only (flexible whitespace), never word
 * by word: retrieval scores a multi-word term as a phrase (`phraseto_tsquery`,
 * 'merchant' <-> 'hous'), so a lone "house" never contributed to the match
 * and shading it would claim otherwise. Longer patterns win
 * at the same position. Terms are regex-escaped: rewrite output such as
 * "St." or "H.M.S." must be literal, never a pattern.
 */
export function findTermRanges(text: string, terms: readonly string[]): TermRange[] {
  const patterns = new Set<string>();
  for (const term of terms) {
    const folded = foldSameLength(term.trim());
    if (folded.length === 0) continue;
    const words = folded.split(/\s+/).filter(Boolean);
    patterns.add(words.map(escapeRegExp).join("\\s+"));
  }
  if (patterns.size === 0) return [];

  const sorted = Array.from(patterns).sort((a, b) => b.length - a.length);
  // Word start without \b, which treats accented letters as non-word
  // characters and would miss a term beginning after "í".
  const regex = new RegExp(`(?<![\\p{L}\\p{N}])(?:${sorted.join("|")})`, "gu");

  const ranges: TermRange[] = [];
  for (const match of foldSameLength(text).matchAll(regex)) {
    if (match[0].length === 0 || match.index === undefined) continue;
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  return ranges;
}
