/**
 * Wire types mirroring the FastAPI backend's Pydantic schemas.
 *
 * These are the contract with `backend/app/schemas/`. Keep them in sync by
 * hand — a mismatch here surfaces as a runtime shape error, not a type error,
 * because the data crosses the network boundary untyped.
 */

/** Mirrors `SearchResult` in `backend/app/schemas/search.py`. */
export interface SearchResult {
  chunk_id: string;
  page_id: string;
  document_id: string;
  page_number: number;
  /** Null when the masthead was unreadable and no manifest override exists. */
  publication: string | null;
  /** ISO date (YYYY-MM-DD), or null when the issue date could not be read. */
  issue_date: string | null;
  content: string;
  rank: number;
}

/** Mirrors `SearchResponse` in `backend/app/schemas/search.py`. */
export interface SearchResponse {
  query: string;
  total: number;
  limit: number;
  offset: number;
  results: SearchResult[];
}

/**
 * A retrieved chunk as sent on the chat stream's `sources` event.
 *
 * This is `SearchResult` minus `rank` — see `_event_stream` in
 * `backend/app/api/v1/chat.py`, which projects the citation fields plus the
 * chunk text.
 *
 * `content` was added 2026-08-13 (B5/A4). Without it a chat citation opened
 * the correct page and highlighted nothing, because the match ladder had no
 * passage to match — and the honest-miss note is gated on a non-null passage,
 * so the reader was not even told. It is the same text `/search` returns,
 * which is why highlighting worked in the archive browser and only there.
 */
export interface ChatSource {
  chunk_id: string;
  page_id: string;
  document_id: string;
  page_number: number;
  publication: string | null;
  issue_date: string | null;
  /** Full chunk text — the passage to highlight when this citation is opened. */
  content: string;
}

/**
 * What the document viewer needs to open a page.
 *
 * A superset of the viewer's real requirement, and deliberately *not*
 * `ChatSource` itself: the viewer opens from three places, and only two of
 * them come from the chat wire. A citation chip and a search hit both carry a
 * real `page_number`; a catalogue row does not — it knows which page id to
 * open but not what that page is numbered, because `/documents` returns issue
 * metadata rather than page metadata.
 *
 * `page_number` is therefore nullable here while staying required on
 * `ChatSource`, which keeps the wire type an honest mirror of the backend
 * schema. The viewers render `source.page_number ?? page.page_number`, so null
 * means "use the number from the page you fetched" rather than a missing
 * value they have to defend against.
 *
 * `content` is dropped for the same reason. The viewers take the text to
 * highlight as a separate `passage` prop and never read it off the source —
 * which is what lets the catalogue open a page with no passage at all. Keeping
 * it required here would force the browse path to invent chunk text it does
 * not have, exactly the fake-data shape this split exists to prevent.
 */
export type ViewerSource = Omit<ChatSource, "page_number" | "content"> & {
  page_number: number | null;
};

/**
 * Server-Sent Event frames emitted by `POST /api/v1/chat`.
 *
 * Order is: one `sources`, then zero or more `delta`, then exactly one
 * terminator (`done`, or `error` if generation failed mid-stream).
 */
export type ChatStreamEvent =
  | { type: "sources"; sources: ChatSource[] }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

/** Mirrors `DocumentSummary` in `backend/app/schemas/documents.py`. */
export interface DocumentSummary {
  document_id: string;
  title: string;
  /** Null when the masthead was unreadable and no manifest override exists. */
  publication: string | null;
  /** ISO date (YYYY-MM-DD), or null when the issue date could not be read. */
  issue_date: string | null;
  language: string;
  /**
   * Pages ingested for this document. Can legitimately be 0 — a document row
   * may exist before its pages land, in which case scoping a chat to it
   * retrieves nothing.
   */
  page_count: number;
  /**
   * The document's lowest-numbered page, for opening it in the viewer.
   *
   * The viewer is keyed on a page id (`GET /api/pages/{id}` takes a page UUID,
   * not a document UUID), so this is what makes a catalogue row openable.
   * Null exactly when `page_count` is 0 — the backend derives both from the
   * same join, so they cannot disagree. Treat null as "not openable" rather
   * than assuming a page 1 exists.
   */
  first_page_id: string | null;
}

/** Mirrors `DocumentListResponse` in `backend/app/schemas/documents.py`. */
export interface DocumentListResponse {
  total: number;
  limit: number;
  offset: number;
  results: DocumentSummary[];
}

/**
 * Body of `POST /api/v1/chat` — mirrors `ChatRequest` in
 * `backend/app/schemas/chat.py`.
 *
 * `document_ids` omitted means corpus-wide retrieval, which is the default
 * mode. When present, retrieval is constrained to those documents.
 */
export interface ChatRequestBody {
  message: string;
  document_ids?: string[];
}

/** Mirrors `MAX_SCOPE_DOCUMENTS` in `backend/app/schemas/chat.py`. */
export const MAX_SCOPE_DOCUMENTS = 50;

/**
 * One cropped image on a page — mirrors `PageFigure` in
 * `backend/app/schemas/pages.py`.
 *
 * `bbox` is `[x1, y1, x2, y2]` as page-relative fractions (0–1), which is what
 * lets it map straight onto a CSS percentage overlay at any render width. It is
 * deliberately not OCR pixels: the served scan is rescaled to 1630px, so pixels
 * would address an image nobody looks at.
 *
 * **Read `block_type` before sizing anything.** The bbox means two different
 * things depending on it, and the difference is large enough to look like a bug:
 *
 * - `Picture` / `Figure` (56 of 66 live figures) — the box bounds the *image*.
 *   Measured against the actual crops, its aspect ratio agrees to a median 0.6%,
 *   so drawing the crop into the box is faithful.
 * - `Text` / `ComplexRegion` / `Table` (the other 10) — the box bounds the
 *   enclosing *region*: a whole advertisement, an engraving plus its ad copy.
 *   Aspect ratio diverges by a median ~56%, and one `Text` box is 1.5% of the
 *   page tall while its crop is a multi-line advertiser nameplate. These are
 *   "where this belongs on the page", not the image's frame.
 *
 * So a region-typed box is honest as a *position* and misleading as a *frame*,
 * which is why the overlay marks those without stretching a crop into them.
 */
export interface PageFigure {
  figure_id: string;
  /** Reading-order position within the page, 0-based. */
  figure_index: number;
  /** `[x1, y1, x2, y2]` as fractions of page width/height. */
  bbox: number[];
  /** OCR block type this crop came from — see the caveat above. Null if unknown. */
  block_type: string | null;
}

/** Mirrors `PageDetail` in `backend/app/schemas/pages.py`. */
export interface PageDetail {
  page_id: string;
  document_id: string;
  page_number: number;
  title: string;
  publication: string | null;
  issue_date: string | null;
  language: string;
  /** Full OCR text of the page; null if extraction produced nothing. */
  raw_text: string | null;
  /** True when a scan image exists on disk for this page. */
  has_image: boolean;
  document_page_count: number;
  /**
   * Cropped figures on this page, in reading order.
   *
   * Optional on this type rather than required: the backend defaults it to `[]`,
   * but a page ingested before the figure contract landed carries none, and the
   * viewer must not assume the array exists.
   */
  figures?: PageFigure[];
}

/** Standard backend error body: `{ "error": "...", "code": "..." }`. */
export interface ApiError {
  error: string;
  code: string;
}
