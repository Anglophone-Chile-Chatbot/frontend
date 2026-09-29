/**
 * Helpers around the `[CITE:chunk_id]` markers the LLM embeds in its answer,
 * and general answer/date formatting.
 *
 * Marker parsing itself lives in `remark-cite.ts` (a remark plugin), so
 * citations compose with real markdown parsing instead of a separate
 * text-splitting pass. This file keeps the ordinal-assignment helper, since
 * both the plugin's output and the ordinal numbering need to agree on "1st
 * distinct chunk seen, in order of first appearance".
 */

/**
 * Assign each distinct chunk id a stable 1-based ordinal, in order of first
 * appearance in `answer`. Repeated citations of the same chunk share a number.
 */
export function assignCitationOrdinals(answer: string): Map<string, number> {
  const ordinals = new Map<string, number>();
  const CITE_PATTERN = /\[CITE:\s*([^\]\s]+)\s*\]/g;
  for (const match of answer.matchAll(CITE_PATTERN)) {
    const chunkId = match[1];
    if (!ordinals.has(chunkId)) {
      ordinals.set(chunkId, ordinals.size + 1);
    }
  }
  return ordinals;
}

/**
 * Hide a partially-streamed citation marker at the very end of the text.
 *
 * While tokens arrive, the tail may read `...treaty [CITE:8f2` — showing that
 * raw fragment then snapping it into a chip is visually noisy. Trimming the
 * incomplete tail keeps streaming text clean; the chip appears once the marker
 * closes.
 */
export function trimPartialMarker(streaming: string): string {
  const open = streaming.lastIndexOf("[");
  if (open === -1) return streaming;

  const tail = streaming.slice(open);
  if (tail.includes("]")) return streaming;

  // Trim only if the tail is still on its way to being a marker: either a
  // prefix of "[CITE:" itself, or a complete "[CITE:" plus a partial id. A
  // stray "[" from the newspaper text is left alone.
  const MARKER_PREFIX = "[CITE:";
  const isBecomingMarker = tail.startsWith(MARKER_PREFIX)
    ? true
    : MARKER_PREFIX.startsWith(tail);

  return isBecomingMarker ? streaming.slice(0, open) : streaming;
}

/** Format an ISO date as an editorial dateline, e.g. "12 March 1853". */
export function formatIssueDate(iso: string | null): string | null {
  if (!iso) return null;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

/** Short form for dense contexts (chips, result rows): "12 Mar 1853". */
export function formatIssueDateShort(iso: string | null): string | null {
  if (!iso) return null;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

/**
 * How a finished answer used its sources, for labelling the source list.
 *
 * - `pending`: still streaming (or failed), so nothing is known yet.
 * - `none`: the answer cited none of them. These were the closest keyword
 *   matches, and the answer found nothing in them that answers the question.
 * - `some`: a mix. The uncited ones matched the search but weren't used.
 * - `all`: every source was cited.
 */
export type SourceUse = "pending" | "none" | "some" | "all";

export function classifySourceUse(
  sourceIds: readonly string[],
  answer: string,
  isComplete: boolean,
): { use: SourceUse; cited: ReadonlySet<string> } {
  if (!isComplete) return { use: "pending", cited: new Set() };
  const ordinals = assignCitationOrdinals(answer);
  const cited = new Set(sourceIds.filter((id) => ordinals.has(id)));
  const use = cited.size === 0 ? "none" : cited.size === sourceIds.length ? "all" : "some";
  return { use, cited };
}
