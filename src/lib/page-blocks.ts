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

/**
 * One body row of a table, carrying its own source range.
 *
 * Per-row offsets exist because a citation rarely covers a whole table: the
 * ingest chunker splits a long table across several chunks, so on the live
 * corpus a 93-row import/export schedule is cited in thirds. Highlighting at
 * block granularity would mark all 93 rows for a citation that covers 12 of
 * them — technically "found", but it would tell the reader the wrong thing
 * about what was cited.
 */
export type TableRow = {
  cells: string[];
  /** Inclusive start offset of this row's source line. */
  start: number;
  /** Exclusive end offset of this row's source line. */
  end: number;
};

export type PageBlock =
  | { kind: "heading"; level: number; text: string; start: number; end: number }
  | { kind: "paragraph"; text: string; start: number; end: number }
  | {
      kind: "table";
      /** Header cells, or null when the table led with its separator row. */
      head: string[] | null;
      /** Body rows, each already padded to the table's column count. */
      rows: TableRow[];
      /** The raw source lines, so a caller can fall back to printing them. */
      text: string;
      start: number;
      end: number;
    };

const HEADING_RE = /^(#{1,6})\s+(.*)$/;

/**
 * A markdown pipe-table row: starts with `|` once trimmed.
 *
 * These reach the page text because the ingest pipeline converts OCR `<table>`
 * blocks to pipe tables rather than flattening them — before that, a shipping
 * manifest collapsed into `barque Artemis312MacdonaldLondon` with every column
 * boundary lost. The conversion is why 1359 pipe rows exist across 24 pages of
 * the live corpus; this parser is what turns them back into a real `<table>`
 * instead of showing the reader raw `|` characters.
 */
const TABLE_ROW_RE = /^\s*\|/;

/**
 * A separator row — `| --- | :--: |`. Alignment markers are tolerated but not
 * honoured: the OCR pipeline emits plain `---` for every column (verified on all
 * 82 table blocks in the corpus), and inventing column alignment the paper never
 * specified would be decoration rather than transcription.
 */
const TABLE_SEPARATOR_RE = /^\s*\|[\s:|-]*\|?\s*$/;

/**
 * Split one pipe row into cells.
 *
 * The leading and trailing pipes are structural delimiters, not empty cells, so
 * they are stripped before splitting. `&#124;` is the escape the ingest table
 * converter emits for a literal `|` inside a cell — unescaping here (after the
 * split, never before) is what keeps such a cell from silently becoming two.
 * Six of these exist in the live corpus.
 */
function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim().replace(/&#124;/g, "|"));
}

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

  const lines = text.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const lineStart = cursor;
    cursor += rawLine.length + 1; // +1 for the consumed "\n"

    const line = rawLine.trim();
    if (!line) continue;

    const lineEnd = lineStart + rawLine.length;

    // Tables are consumed as a run, before the paragraph branch below can join
    // their rows into one line of prose. A run ends at the first line that is
    // not a pipe row — blank line, heading, or ordinary text.
    if (TABLE_ROW_RE.test(rawLine)) {
      const group: string[] = [];
      let scan = index;
      while (scan < lines.length && TABLE_ROW_RE.test(lines[scan])) {
        group.push(lines[scan]);
        scan += 1;
      }

      // The run's end offset is its last row's end, so citation offsets still
      // index the raw string. Rows are separated by the "\n" each one consumed.
      let runEnd = lineStart + group.length - 1;
      for (const row of group) runEnd += row.length;

      cursor = runEnd + 1;
      index = scan - 1;

      blocks.push(buildTable(group, lineStart, runEnd));
      continue;
    }

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

/**
 * Turn a run of pipe rows into a table block.
 *
 * Structure is only claimed where the source actually has it. A run with no
 * separator row, or one that yields no body rows, is returned as a `table` with
 * an empty `rows` array — the caller renders `text` as prose instead. That
 * mirrors the ingest pipeline's own rule, where a table with no parseable rows
 * falls back to text with a warning rather than losing the words: a broken table
 * rendered as a broken table is worse than the honest lines.
 *
 * Short rows are padded to the widest row so later columns keep their index
 * (the OCR converter pads for `colspan` the same way, and a ragged row would
 * otherwise shift every cell after it left). Padding adds empty cells; it never
 * duplicates a value into a cell the paper left blank.
 */
function buildTable(group: string[], start: number, end: number): PageBlock {
  const text = group.join("\n");
  const separatorAt = group.findIndex((line) => TABLE_SEPARATOR_RE.test(line));

  // No separator: not a table this parser will vouch for.
  if (separatorAt === -1) {
    return { kind: "table", head: null, rows: [], text, start, end };
  }

  // Each line's offset in the raw string, walked rather than searched — a
  // repeated row (blank cells are common in these schedules) would otherwise
  // resolve to the first identical line instead of this one.
  const offsets: number[] = [];
  let at = start;
  for (const line of group) {
    offsets.push(at);
    at += line.length + 1;
  }

  // A separator on the first line means the table led straight into its body —
  // real in this corpus, and rendering a body row as a header would misattribute
  // data as a column name.
  const head = separatorAt > 0 ? splitRow(group[separatorAt - 1]) : null;

  const body: TableRow[] = [];
  for (let i = separatorAt + 1; i < group.length; i += 1) {
    if (TABLE_SEPARATOR_RE.test(group[i])) continue;
    body.push({
      cells: splitRow(group[i]),
      start: offsets[i],
      end: offsets[i] + group[i].length,
    });
  }

  if (body.length === 0) {
    return { kind: "table", head: null, rows: [], text, start, end };
  }

  const columns = Math.max(head?.length ?? 0, ...body.map((row) => row.cells.length));

  return {
    kind: "table",
    head: head ? pad(head, columns) : null,
    rows: body.map((row) => ({ ...row, cells: pad(row.cells, columns) })),
    text,
    start,
    end,
  };
}

/** Pad a row to `columns` cells. Never truncates — a wider row keeps its data. */
function pad(row: string[], columns: number): string[] {
  if (row.length >= columns) return row;
  return [...row, ...Array<string>(columns - row.length).fill("")];
}
