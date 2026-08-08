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
 * This is `SearchResult` minus `content` and `rank` — see `_event_stream` in
 * `backend/app/api/v1/chat.py`, which projects only the citation fields.
 */
export interface ChatSource {
  chunk_id: string;
  page_id: string;
  document_id: string;
  page_number: number;
  publication: string | null;
  issue_date: string | null;
}

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
}

/** Standard backend error body: `{ "error": "...", "code": "..." }`. */
export interface ApiError {
  error: string;
  code: string;
}
