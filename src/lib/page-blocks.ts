/**
 * Parse a page's stored OCR text into renderable blocks.
 *
 * `pages.raw_text` is markdown: the OCR engine returns a structured block tree,
 * and the ingest pipeline flattens it to a string with ATX headings (`## `) and
 * blank-line-separated paragraphs. The viewer used to print that string through
 * `whitespace-pre-wrap`, so readers saw literal `###` characters and every
 * paragraph break as a visible empty line (reported 2026-08-11).
 *
 * Why a parser here rather than a markdown dependency: the input is not general
 * markdown. It is machine-generated from our own pipeline and uses exactly two
 * constructs — ATX headings and blank-line paragraph breaks. There is no
 * emphasis, no links, no lists, no HTML to sanitize. A full markdown renderer
 * would add a dependency and an XSS surface to interpret syntax this text does
 * not contain, and would additionally *mis*-interpret 19th-century newsprint:
 * price lists like `1 case #4 plate` or `$ 15.0 TRY IT` are riddled with
 * characters markdown treats as syntax.
 *
 * Offsets are the load-bearing part. Citation highlighting locates the cited
 * passage by `indexOf` into the raw string, so every block records the range it
 * came from. That lets the viewer highlight across the parsed structure without
 * a second, differently-normalized copy of the text — the highlight and the
 * rendering can never disagree about where a passage is.
 *
 * Structure is preserved rather than flattened into one flowing column, which
 * is deliberate for this corpus: an 1800s newspaper page is frequently parallel
 * boxed advertisements, and the heading breaks are the only thing separating one
 * advertiser from the next. Running them together would produce sentences the
 * paper never printed.
 */

export type PageBlock =
  | { kind: "heading"; level: number; text: string; start: number; end: number }
  | { kind: "paragraph"; text: string; start: number; end: number };

const HEADING_RE = /^(#{1,6})\s+(.*)$/;

/**
 * Split raw page text into heading and paragraph blocks.
 *
 * @param text Raw `pages.raw_text` markdown, or null.
 * @returns Blocks in document order, each carrying its `[start, end)` range in
 *   `text` so callers can map string offsets back onto rendered nodes.
 */
export function parsePageBlocks(text: string | null): PageBlock[] {
  if (!text) return [];

  const blocks: PageBlock[] = [];
  // Track position by consuming the source, so offsets stay exact regardless of
  // how many blank lines separated two blocks. Recomputing with `indexOf` would
  // find the *first* occurrence of a repeated line, not this one.
  let cursor = 0;

  for (const rawLine of text.split("\n")) {
    const lineStart = cursor;
    cursor += rawLine.length + 1; // +1 for the consumed "\n"

    const line = rawLine.trim();
    if (!line) continue;

    const lineEnd = lineStart + rawLine.length;
    const heading = HEADING_RE.exec(line);

    if (heading) {
      const body = heading[2].trim();
      if (!body) continue;
      blocks.push({
        kind: "heading",
        level: heading[1].length,
        text: body,
        // Offsets span the source line including its `#` marker; the marker is
        // never part of a citation passage, so this only ever widens a range
        // slightly rather than dropping matched characters.
        start: lineStart,
        end: lineEnd,
      });
      continue;
    }

    // Consecutive non-blank, non-heading lines belong to one paragraph. Newsprint
    // columns are extracted line-per-line, so joining them is what turns a
    // ragged column back into readable prose — while the blank lines that
    // separate real paragraphs still break them apart.
    const previous = blocks.at(-1);
    if (previous?.kind === "paragraph" && previous.end === lineStart - 1) {
      previous.text = `${previous.text} ${line}`;
      previous.end = lineEnd;
      continue;
    }

    blocks.push({ kind: "paragraph", text: line, start: lineStart, end: lineEnd });
  }

  return blocks;
}
