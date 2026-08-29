"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { SearchResponse, SearchResult } from "@/lib/api/types";

/**
 * Search within the one issue the reader has open.
 *
 * The archival move this exists for is "where in this issue does cholera
 * appear?" — a question the corpus-wide search box could never answer, because
 * it throws the reader at one page of one issue and abandons them there. The
 * research loop is *search → read → search again from where I am*, and this is
 * the third step.
 *
 * **No endpoint was added, deliberately.** `GET /api/v1/search` has accepted a
 * repeatable `document_id` since CHUNK 1 and routes it through the same
 * `search_chunks(..., document_ids=...)` call chat uses — a narrower `WHERE`,
 * not a second retrieval path. A `/documents/{id}/search` route would have been
 * a second way to do a thing that already works, and the two would drift the
 * moment ranking changed on one side. The only plumbing this needed was the
 * Next Route Handler forwarding the param it used to drop.
 *
 * Results are folded into *pages* rather than kept as a flat list of chunks.
 * A reader asking where a word appears in an issue is asking for page numbers;
 * "9 passages" is a fact about the chunker, and "5 pages" is a fact about the
 * newspaper. The chunk text is still carried per page so the reader can be
 * dropped onto the page with the matched passage highlighted by the existing
 * `passage-match` ladder.
 */

/**
 * How many chunks to pull for one within-issue search.
 *
 * The backend caps `limit` at 50, and an issue's whole matching set is what
 * makes the page map honest — a partial fetch would mark some pages and
 * silently miss others, which is worse than not marking them at all. 50 is
 * therefore both the cap and the request. Measured on the live corpus: the
 * densest real case is "Valparaiso" in *The Star of Chile* 1904-12-03 at
 * exactly 50 matching chunks across 10 of its 16 pages, so a common word in a
 * long issue can genuinely reach the ceiling. `total` is a true count from a
 * separate `count(*)`, not the length of this page of results, so the hook can
 * tell the reader when it is showing a subset instead of pretending otherwise.
 */
const SEARCH_LIMIT = 50;

/** Debounce before a keystroke becomes a request. */
const DEBOUNCE_MS = 250;

/**
 * Shortest query worth sending.
 *
 * One- and two-character strings are almost always mid-word, and each costs a
 * round trip against nginx's 60r/m general zone — the same limiter a fast
 * reader already trips by paging (see `usePagePrefetch`).
 */
const MIN_QUERY_CHARS = 2;

/** One page of the open issue that matched, with its best passage. */
export interface DocumentSearchHit {
  pageNumber: number;
  pageId: string;
  /** Matching chunks on this page. */
  count: number;
  /**
   * The highest-ranked chunk's text, for the highlight ladder.
   *
   * Results arrive rank-ordered, so the first chunk seen for a page is its
   * best — which is the passage a reader jumping to that page should land on.
   */
  passage: string;
}

export type DocumentSearchStatus = "idle" | "searching" | "loaded" | "error";

export function useDocumentSearch(documentId: string) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<DocumentSearchHit[]>([]);
  /** True match count from the backend's own `count(*)`, not `hits.length`. */
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<DocumentSearchStatus>("idle");
  /** The term the current `hits` describe — not the term being typed. */
  const [matched, setMatched] = useState("");
  const controllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setHits([]);
    setTotal(0);
    setMatched("");
    setStatus("idle");
  }, []);

  const term = query.trim();
  const isSearchable = term.length >= MIN_QUERY_CHARS;

  /**
   * Drop stale results the moment the box falls below the searchable length.
   *
   * Done during render rather than in an effect — the pattern `use-source-page`
   * established for the same problem. A reader clearing the box is not waiting
   * for anything: the previous term's hits are wrong from that keystroke on,
   * and resetting in an effect would paint one frame of them under an empty
   * field, with the matched pages still marked in the page jump.
   */
  const [searchableFor, setSearchableFor] = useState(isSearchable);
  if (isSearchable !== searchableFor) {
    setSearchableFor(isSearchable);
    if (!isSearchable) {
      // State only — the in-flight request is *not* aborted here. A ref cannot
      // be touched during render (React would not re-run this if it discarded
      // the render), and it does not need to be: the debounce means a
      // superseded request has usually never been sent, and the effect's own
      // cleanup aborts whatever was. The stale response can still land, which
      // is why `status` is checked before it is allowed to publish below.
      setHits([]);
      setTotal(0);
      setMatched("");
      setStatus("idle");
    }
  }

  useEffect(() => {
    if (!isSearchable) return;

    const timer = window.setTimeout(() => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setStatus("searching");

      const params = new URLSearchParams({
        q: term,
        limit: String(SEARCH_LIMIT),
        document_id: documentId,
      });

      fetch(`/api/search?${params}`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(String(response.status));
          return response.json() as Promise<SearchResponse>;
        })
        .then((body) => {
          setHits(foldToPages(body.results));
          setTotal(body.total);
          setMatched(term);
          setStatus("loaded");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setStatus("error");
        });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [term, documentId, isSearchable]);

  // Abort on unmount only. The in-flight request is deliberately *not*
  // cancelled when `term` changes — the debounce timer means a superseded
  // request has usually not been sent at all, and the next send aborts the
  // previous one itself, so a stale response can never overwrite a newer one.
  useEffect(() => () => controllerRef.current?.abort(), []);

  /** Page numbers that matched, for marking the page-jump control. */
  const matchedPages = useMemo(
    () => new Set(hits.map((hit) => hit.pageNumber)),
    [hits],
  );

  return {
    query,
    setQuery,
    reset,
    hits,
    matchedPages,
    total,
    /** True when `total` exceeds what one request could return. */
    isPartial: total > SEARCH_LIMIT,
    status,
    matched,
    /** The passage to highlight on a given page, or null if it did not match. */
    passageFor: useCallback(
      (pageNumber: number | null) =>
        pageNumber === null
          ? null
          : (hits.find((hit) => hit.pageNumber === pageNumber)?.passage ?? null),
      [hits],
    ),
  };
}

/**
 * Collapse rank-ordered chunk results into one entry per page.
 *
 * Order is preserved as *rank* order, not page order: the first page listed is
 * the one whose best passage ranked highest, which is where a reader following
 * a hunch wants to be sent first. Sorting by page number instead would bury the
 * strongest match behind whatever happened to be printed earlier in the issue.
 */
function foldToPages(results: SearchResult[]): DocumentSearchHit[] {
  const byPage = new Map<number, DocumentSearchHit>();

  for (const result of results) {
    const existing = byPage.get(result.page_number);
    if (existing) {
      existing.count += 1;
      continue;
    }
    byPage.set(result.page_number, {
      pageNumber: result.page_number,
      pageId: result.page_id,
      count: 1,
      passage: result.content,
    });
  }

  return [...byPage.values()];
}
