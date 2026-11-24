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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CitationNumbering<T> {
  ordinals: Map<string, number>;
  cited: T[];
  unused: T[];
}

/**
 * Rewrite malformed multi-id citation markers into individual `[CITE:id]`
 * markers and strip any leftover brackets that contain only bare UUIDs.
 * Non-citation brackets such as `[sic]`, `[illegible]`, or `[1]` stay intact.
 */
export function normalizeCitations(text: string): string {
  const expanded = text.replace(/\[CITE:\s*([^\]]*)\]/gi, (_full, inner: string) => {
    const cleaned = inner.replace(/\bCITE:\s*/gi, " ");
    const ids = cleaned
      .split(/[,;\s]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0 && token.toLowerCase() !== "and");
    return ids.map((id) => `[CITE:${id}]`).join("");
  });

  return expanded.replace(
    /([ \t]*)\[([^\]]+)\]/g,
    (full, ws: string, inner: string, offset: number, str: string) => {
      if (/^CITE:/i.test(inner)) return full;
      const tokens = inner
        .split(/[,;\s]+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 0 && token.toLowerCase() !== "and");
      if (tokens.length > 0 && tokens.every((token) => UUID_RE.test(token))) {
        const next = str[offset + full.length] ?? "";
        if (next === "" || /[\s.,;:!?)\]]/.test(next)) {
          return "";
        }
        return ws;
      }
      return full;
    },
  );
}

/**
 * Compute one shared citation numbering for both inline chips and the Sources
 * list from a normalized answer. Unknown chunk ids not present in `sources`
 * never claim an ordinal or leave a numbering gap.
 */
export function numberCitations<T extends { chunk_id: string }>(
  answer: string,
  sources: readonly T[],
): CitationNumbering<T> {
  const byId = new Map<string, T>();
  for (const source of sources) {
    if (!byId.has(source.chunk_id)) {
      byId.set(source.chunk_id, source);
    }
  }

  const ordinals = new Map<string, number>();
  const cited: T[] = [];
  const CITE_PATTERN = /\[CITE:\s*([^\]\s]+)\s*\]/g;
  for (const match of answer.matchAll(CITE_PATTERN)) {
    const chunkId = match[1];
    const source = byId.get(chunkId);
    if (!source || ordinals.has(chunkId)) continue;
    ordinals.set(chunkId, ordinals.size + 1);
    cited.push(source);
  }

  const unused = sources.filter((source) => !ordinals.has(source.chunk_id));
  return { ordinals, cited, unused };
}

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
 * While tokens arrive, the tail may read `...treaty [CITE:8f2` or an unclosed
 * multi-id marker `[CITE:abc, de` - trimming the incomplete tail keeps
 * streaming text clean until the marker closes.
 */
export function trimPartialMarker(streaming: string): string {
  const open = streaming.lastIndexOf("[");
  if (open === -1) return streaming;

  const tail = streaming.slice(open);
  if (tail.includes("]") || tail.includes("\n")) return streaming;

  // Trim only if the tail is still on its way to being a marker: either a
  // prefix of "[CITE:" itself, or a complete "[CITE:" plus a partial id/list. A
  // stray "[" from the newspaper text is left alone.
  const MARKER_PREFIX = "[CITE:";
  const upperTail = tail.toUpperCase();
  const isBecomingMarker = upperTail.startsWith(MARKER_PREFIX)
    ? true
    : MARKER_PREFIX.startsWith(upperTail);

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
