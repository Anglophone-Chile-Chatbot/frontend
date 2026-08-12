/**
 * Locate a cited chunk inside the page text it came from.
 *
 * Why this file exists
 * --------------------
 * The stored chunk is deliberately *not* a copy of the page. The ingest
 * chunker (`infra/scripts/batch_ocr/chunking.py`) rewrites the text on the way
 * in, for reasons that are correct for retrieval and must not be reverted:
 *
 * 1. `chunk_page()` builds each chunk as `${section}\n\n${body}` — the section
 *    heading is prepended so it lands in `ts_vector` and the embedding, and so
 *    the LLM can see where a citation came from. On the page, that heading is
 *    usually somewhere else entirely (often several paragraphs earlier).
 * 2. `_segment()` unwraps prose columns with `" ".join(lines)`, so newlines the
 *    page has become single spaces in the chunk.
 * 3. `_merge_tiny()` folds a short chunk into its predecessor with `\n\n`. The
 *    heading that originally separated them is *dropped*, so the chunk reads as
 *    contiguous text while the page still has `### SOLE AGENTS…` in the middle.
 *
 * The viewer used to do a single exact `text.indexOf(chunk)`. Measured against
 * the live corpus (112 chunks sampled by `infra/scripts/audit_metrics.py`) that
 * succeeded on 22% — so on nearly four clicks in five the page opened with
 * nothing highlighted and no scroll, which is indistinguishable from a citation
 * that pointed nowhere. That is the single loudest complaint about the archive.
 *
 * The ladder below climbs from cheapest/strictest to loosest, stopping at the
 * first hit. Measured cumulative match rate on that same 112-chunk sample:
 *
 *     exact                    22%
 *     + section prefix stripped   61%
 *     + whitespace-insensitive    85%
 *     + heading-skipping          92%
 *     + leading anchor           100%
 *
 * Every rung returns offsets into the *raw* string — never into a normalized
 * copy — because `parsePageBlocks` carries `[start, end)` per block and
 * `Highlighted` maps the range onto those blocks. One source of truth is what
 * keeps rendering and highlighting from disagreeing about where a passage is.
 *
 * The rung that matched is returned too, so the viewer can be honest: an
 * approximate match should not be presented with the same confidence as an
 * exact one.
 */

/** Which rung of the ladder produced a match. `exact` through `anchor`. */
export type MatchKind = "exact" | "prefix" | "whitespace" | "heading" | "anchor";

export type PassageMatch = {
  /** Inclusive start offset into the raw page text. */
  start: number;
  /** Exclusive end offset into the raw page text. */
  end: number;
  /** How it was found — `exact` is verbatim, `anchor` is approximate. */
  kind: MatchKind;
};

/**
 * How many non-whitespace characters the anchor rung matches on.
 *
 * Long enough that a run of common words cannot collide by accident on a dense
 * newspaper page, short enough to sit before the first dropped heading in the
 * observed failures (which diverged after 15–153 words). 80 chars is roughly a
 * dozen words of period prose.
 */
const ANCHOR_CHARS = 80;

/**
 * A page this long is not worth running the regex rungs against.
 *
 * The whitespace and heading rungs build a pattern with one alternation per
 * word, so cost is O(pattern × page). Real pages here run ~2–20 KB; the cap is
 * far above that and exists only so a pathological future page degrades to "no
 * highlight" rather than blocking the main thread.
 */
const MAX_REGEX_PAGE_CHARS = 400_000;

/** Escape a literal for use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find the cited passage in the page text, climbing the ladder until one hits.
 *
 * @param text Raw `pages.raw_text` exactly as stored — not normalized.
 * @param passage The chunk `content` as stored, including its section prefix.
 * @returns The matched range in `text` plus the rung that found it, or `null`
 *   when every rung fails.
 */
export function findPassage(
  text: string | null | undefined,
  passage: string | null | undefined,
): PassageMatch | null {
  if (!text || !passage) return null;

  const needle = passage.trim();
  if (!needle) return null;

  // Rung 1 — exact. The cheap common case; keep it first so the majority of
  // clicks never build a regex at all.
  const exact = text.indexOf(needle);
  if (exact !== -1) {
    return { start: exact, end: exact + needle.length, kind: "exact" };
  }

  // Rung 2 — drop the section heading the chunker prepends. This is the single
  // highest-value step (22% -> 61% on its own). The heading is everything
  // before the first blank line; `_merge_tiny` can leave more than one such
  // break, so only the first is removed.
  const split = needle.indexOf("\n\n");
  const body = split === -1 ? needle : needle.slice(split + 2).trim();

  if (body && body !== needle) {
    const prefixStripped = text.indexOf(body);
    if (prefixStripped !== -1) {
      return {
        start: prefixStripped,
        end: prefixStripped + body.length,
        kind: "prefix",
      };
    }
  }

  const candidate = body || needle;
  const words = candidate.split(/\s+/).filter(Boolean);
  if (words.length === 0 || text.length > MAX_REGEX_PAGE_CHARS) return null;

  // Rung 3 — whitespace-insensitive. Recovers the prose blocks `_segment()`
  // re-joined: the page has a newline where the chunk has a space, and the
  // chunk's own paragraph breaks are `\n\n` against the page's single `\n`.
  const whitespace = searchWords(text, words, "\\s+");
  if (whitespace) return { ...whitespace, kind: "whitespace" };

  // Rung 4 — additionally step over markdown heading markers. `_merge_tiny`
  // joins across a heading and drops it, so the page carries a `###` the chunk
  // never had. Allowing `#` inside the gap re-bridges those.
  const heading = searchWords(text, words, "[\\s#]+");
  if (heading) return { ...heading, kind: "heading" };

  // Rung 5 — anchor on the opening words only, and highlight to the end of the
  // paragraph they start. The remaining failures drop whole heading *lines*
  // from the page's middle (e.g. `### SOLE AGENTS FOR THE FAMOUS WHISKY`), so
  // no gap pattern can bridge them. Highlighting approximately and scrolling to
  // the right place beats highlighting nothing — and the caller marks it as
  // approximate rather than passing it off as verbatim.
  const anchorWords: string[] = [];
  let anchorLength = 0;
  for (const word of words) {
    anchorWords.push(word);
    anchorLength += word.length;
    if (anchorLength >= ANCHOR_CHARS) break;
  }

  // Too short to be distinctive: a handful of common words would land on an
  // arbitrary paragraph and highlight the wrong item, which is worse than an
  // honest miss.
  if (anchorLength < ANCHOR_CHARS) return null;

  const anchor = searchWords(text, anchorWords, "[\\s#]+");
  if (!anchor) return null;

  // Extend to the end of the block the anchor started in, so the highlight
  // covers a readable unit instead of stopping mid-sentence.
  const paragraphEnd = text.indexOf("\n\n", anchor.end);
  return {
    start: anchor.start,
    end: paragraphEnd === -1 ? text.length : paragraphEnd,
    kind: "anchor",
  };
}

/**
 * Match a word sequence against the raw text, allowing `gap` between words.
 *
 * Returns offsets into `text` itself (via `match.index` and the matched
 * length), never into a normalized intermediate — that is what keeps the result
 * usable by `parsePageBlocks`' block ranges.
 */
function searchWords(
  text: string,
  words: string[],
  gap: string,
): { start: number; end: number } | null {
  const pattern = new RegExp(words.map(escapeRegExp).join(gap));
  const match = pattern.exec(text);
  if (!match) return null;
  return { start: match.index, end: match.index + match[0].length };
}
