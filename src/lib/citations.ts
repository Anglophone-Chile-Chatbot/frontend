import type { ChatSource } from "./api/types";

/**
 * Parsing of the `[CITE:chunk_id]` markers the LLM embeds in its answer.
 *
 * The backend instructs the model to cite retrieved chunks inline. Rendering
 * splits the answer into text runs and citation runs so each marker can become
 * a tappable chip that opens the source page in the viewer.
 */

/** Matches `[CITE:<uuid-ish token>]`, tolerating whitespace around the id. */
const CITE_PATTERN = /\[CITE:\s*([^\]\s]+)\s*\]/g;

export type AnswerSegment =
  | { kind: "text"; text: string }
  | { kind: "citation"; chunkId: string; source: ChatSource; ordinal: number };

/**
 * Split an answer into renderable segments, resolving markers against sources.
 *
 * A marker whose id is not among the retrieved sources is dropped rather than
 * rendered as a dead chip — the model occasionally invents an id, and a chip
 * that opens nothing is worse than no chip.
 *
 * `ordinal` is the citation's 1-based display number, assigned per distinct
 * chunk in order of first appearance, so repeated citations share a number.
 */
export function parseAnswer(
  answer: string,
  sources: ChatSource[],
): AnswerSegment[] {
  const byId = new Map(sources.map((source) => [source.chunk_id, source]));
  const ordinals = new Map<string, number>();
  const segments: AnswerSegment[] = [];

  let cursor = 0;
  for (const match of answer.matchAll(CITE_PATTERN)) {
    const index = match.index;
    const chunkId = match[1];
    const source = byId.get(chunkId);

    // Emit the text preceding this marker.
    if (index > cursor) {
      segments.push({ kind: "text", text: answer.slice(cursor, index) });
    }
    cursor = index + match[0].length;

    if (!source) continue;

    let ordinal = ordinals.get(chunkId);
    if (ordinal === undefined) {
      ordinal = ordinals.size + 1;
      ordinals.set(chunkId, ordinal);
    }
    segments.push({ kind: "citation", chunkId, source, ordinal });
  }

  if (cursor < answer.length) {
    segments.push({ kind: "text", text: answer.slice(cursor) });
  }
  return segments;
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
