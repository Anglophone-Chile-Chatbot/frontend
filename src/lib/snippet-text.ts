/**
 * Flattens stored chunk markdown into plain prose *for display only*.
 *
 * `chunks.content` is the OCR pipeline's markdown: ATX headings carry the
 * section prefix that retrieval keys off (A1), and shipping registers, railway
 * timetables and tonnage returns are stored as real markdown tables. Rendered
 * raw in a search result the reader sees literal syntax —
 * `| Lydgate, | 2350 |` and a `| --- | --- |` separator row — which was filed
 * as CHUNK 11 and carried unscheduled since 2026-08-15.
 *
 * Scope, deliberately narrow
 * --------------------------
 * This is a **rendering** concern. CLAUDE.md's ban on rewriting OCR text is
 * about *storage*; nothing here touches the database, the ingest payloads, or
 * what retrieval matches against. The stored string is passed in and a
 * different string comes back for the reader's eyes only.
 *
 * The transform is kept conservative on purpose, because this corpus is full
 * of text that *looks* like markup but is data:
 *
 * * **Every cell value survives.** Tables become middot-joined lines rather
 *   than being stripped, so `| Aconcagua | 4112 |` reads as
 *   `Aconcagua · 4112` — the tonnage is the answer to a real question a reader
 *   asks, and dropping it to tidy the punctuation would be a data loss the
 *   reader never sees happen.
 * * **Only genuine separator rows are deleted** (`| --- | --- |`), matched as
 *   *nothing but* pipes, dashes, colons and spaces. Those carry no content by
 *   definition.
 * * **`#` is only stripped at the start of a line**, and only when followed by
 *   a space — the ATX heading form the pipeline emits. A `#` inside a line
 *   (`No. #5`, a price, a printer's mark) is left alone.
 * * **Bare pipe lines are left as-is.** A railway timetable stores runs of
 *   times as `1 05 | 3 10 | 5 55 |` with no surrounding table; those pipes are
 *   the paper's own column rule, not markdown, and are not ours to reformat.
 *
 * What is NOT handled, and why that is fine: emphasis (`*`, `_`), links and
 * code fences. The pipeline does not emit them for this corpus — headings and
 * tables are the only markdown constructs in `chunks.content` — so a rule for
 * them would be untested code guarding against a case that does not occur.
 */

/** A table separator row: only pipes, dashes, colons and whitespace. */
const SEPARATOR_ROW = /^\s*\|[\s|:-]*\|\s*$/;

/** A markdown table row: starts and ends with a pipe. */
const TABLE_ROW = /^\s*\|.*\|\s*$/;

/** An ATX heading marker at the start of a line, e.g. `## `. */
const ATX_HEADING = /^\s{0,3}#{1,6}\s+/;

/**
 * Convert one markdown table row into a readable middot-joined line.
 *
 * Splits on the pipes, drops the empty first/last fragments the leading and
 * trailing pipe produce, and discards cells that are empty *after* trimming —
 * the OCR emits padding cells (`| Aconagua |  | Tonnage. |  |`) to keep column
 * counts square, and rendering those as `Aconagua ·  · Tonnage.` would read
 * worse than the raw markdown it replaced.
 *
 * @param row One line known to match {@link TABLE_ROW}.
 * @returns The row's non-empty cell values joined by a middot.
 */
function flattenTableRow(row: string): string {
  return row
    .trim()
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0)
    .join(" · ");
}

/**
 * Flatten stored chunk markdown for display in a snippet or result list.
 *
 * @param content Raw `chunks.content` as returned by the API.
 * @returns The same text with heading markers and table syntax rendered as
 *   prose. Cell values and all other characters are preserved. Returns an
 *   empty string for empty input.
 */
export function flattenSnippetMarkdown(content: string): string {
  if (!content) return "";

  const lines = content.split("\n");
  const out: string[] = [];

  for (const line of lines) {
    if (SEPARATOR_ROW.test(line)) {
      // Pure formatting, no content — drop it entirely.
      continue;
    }
    if (TABLE_ROW.test(line)) {
      const flattened = flattenTableRow(line);
      // A row of nothing but padding cells flattens to "" — skip rather than
      // emit a blank line where the reader expects data.
      if (flattened) out.push(flattened);
      continue;
    }
    out.push(line.replace(ATX_HEADING, ""));
  }

  // Collapse the runs of blank lines that dropped separator rows can leave
  // behind, so a snippet does not open with a gap.
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
