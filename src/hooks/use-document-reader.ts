"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DocumentPagesResponse, DocumentPageSummary } from "@/lib/api/types";

/**
 * Loads a document's page list and tracks which page the reader is on.
 *
 * Deliberately separate from `useSourcePage`, which fetches one page's
 * *content*. This hook owns the issue-level shape — how many pages there are,
 * which are blank, which carry figures — and the current position within it.
 * The reader composes the two: this decides *which* page, `useSourcePage`
 * fetches *what is on it*.
 *
 * Keeping them apart is what lets the reader reuse `SourceViewerBody`
 * unchanged. That component takes a page and renders it; it neither knows nor
 * needs to know that a page strip exists around it.
 */
export function useDocumentReader(documentId: string, initialPage: number | null) {
  const [document, setDocument] = useState<DocumentPagesResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "error" | "missing">(
    "loading",
  );

  /**
   * The page *number* the reader is on, not an index.
   *
   * Page numbers are what the URL carries and what the paper itself prints, and
   * they are not guaranteed to start at 1 — a partially ingested issue can
   * legitimately begin at 3. Storing the number and resolving it to a position
   * on demand keeps the URL meaningful and avoids an index that silently means
   * a different page if the list ever changes beneath it.
   *
   * Null until the list arrives: the requested page cannot be validated
   * against a list that has not loaded, and guessing 1 would flash the wrong
   * page for one render on a `?page=9` deep link.
   */
  const [pageNumber, setPageNumber] = useState<number | null>(null);

  // The deep-linked page, captured once. Held in a ref rather than read from
  // the prop inside the fetch effect: `?page=` changes as the reader pages
  // through (the URL is kept in sync), and re-reading it there would make the
  // effect re-run and refetch the whole issue on every page turn.
  const requestedRef = useRef(initialPage);

  // Reset when the reader moves to a different issue, during render rather
  // than in an effect — the same pattern `use-source-page` uses, and for the
  // same reason: an effect would paint one frame of the previous issue's page
  // strip under the new issue's id. Today only a full remount can change
  // `documentId`, but the reset keeps that an implementation detail rather
  // than a load-bearing assumption.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (documentId !== loadedFor) {
    setLoadedFor(documentId);
    setDocument(null);
    setStatus("loading");
    setPageNumber(null);
  }

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/documents/${documentId}/pages`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) return "missing" as const;
        if (!response.ok) throw new Error(String(response.status));
        return (await response.json()) as DocumentPagesResponse;
      })
      .then((body) => {
        if (body === "missing") {
          setStatus("missing");
          return;
        }
        setDocument(body);
        setStatus("loaded");

        // Resolve the requested page against what actually exists. An
        // out-of-range or unparseable `?page=` falls back to the first real
        // page rather than erroring: a stale shared link should still open the
        // issue, not a dead end. `?page=1` on an issue starting at 3 lands on
        // 3 for the same reason.
        const requested = requestedRef.current;
        const exists =
          requested !== null &&
          body.pages.some((page) => page.page_number === requested);
        setPageNumber(exists ? requested : (body.pages[0]?.page_number ?? null));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      });

    return () => controller.abort();
  }, [documentId]);

  const pages = useMemo(() => document?.pages ?? [], [document]);

  const index = useMemo(
    () =>
      pageNumber === null
        ? -1
        : pages.findIndex((page) => page.page_number === pageNumber),
    [pages, pageNumber],
  );

  const current: DocumentPageSummary | null = index >= 0 ? pages[index] : null;
  const previous = index > 0 ? pages[index - 1] : null;
  const next = index >= 0 && index < pages.length - 1 ? pages[index + 1] : null;

  const goTo = useCallback(
    (target: number) => {
      setPageNumber((currentNumber) =>
        pages.some((page) => page.page_number === target) ? target : currentNumber,
      );
    },
    [pages],
  );

  return {
    document,
    status,
    pages,
    current,
    previous,
    next,
    /** Position in the list, 1-based, for "N of M" where N is not the page number. */
    position: index >= 0 ? index + 1 : 0,
    goTo,
  };
}

/**
 * Warms the browser cache for a page the reader is likely to open next.
 *
 * A page turn otherwise pays the full Oracle round trip — 0.3-0.9s measured
 * (B2) — every single time, which is the difference between reading an issue
 * and waiting through one. The neighbours are fetched during idle time so the
 * fetch never competes with the page the reader is actually looking at.
 *
 * `fetch` alone is the whole mechanism: the Route Handler's response lands in
 * the HTTP cache, and `useSourcePage`'s later request for the same URL is
 * served from it. Nothing is stored here, so there is no second copy of the
 * page data to keep in sync with the one the viewer renders.
 *
 * **The settle delay is not a nicety — it is what keeps a fast reader under
 * the rate limit.** nginx applies `api_general` at 60r/m with burst 30 to
 * every `/api/` call (CHUNK 0), and a prefetch multiplies each page turn by
 * three: the page itself plus both neighbours. Paging quickly — a held arrow
 * key, repeated taps, or the jump control — therefore trips the limiter and
 * the reader gets 502s on pages that are perfectly fine, which is exactly what
 * a 16-page sweep produced when this fired immediately (measured 2026-08-29:
 * 9 × 502, all `limiting requests ... zone "api_general"` in the nginx log).
 * Waiting for the reader to settle means the pages they *skipped past* are
 * never fetched at all, so the request rate tracks pages actually read rather
 * than buttons actually pressed.
 *
 * A prefetch for a page the reader has already left is also worthless by
 * definition, so cancelling it on the way past costs nothing and is the whole
 * mechanism: the cleanup aborts any in-flight speculative fetch.
 *
 * Failures are swallowed on purpose. A prefetch is a guess about what the
 * reader will do next; if it fails, the real fetch will fail visibly and say
 * so, and surfacing a speculative error would report a problem the reader does
 * not have.
 */
export function usePagePrefetch(pageIds: (string | null)[]) {
  // Reset on every page change, so only a reader who has actually stopped on a
  // page pays for its neighbours.
  const SETTLE_MS = 400;

  // Joined into a primitive so the effect depends on the *contents* rather
  // than on a fresh array identity every render, which would re-run it
  // constantly and defeat the point.
  const key = pageIds.filter((id): id is string => id !== null).join(",");

  useEffect(() => {
    if (key.length === 0) return;

    const ids = key.split(",");
    const controller = new AbortController();

    // Long enough that pages turned through in a hurry are never fetched, short
    // enough to still be warm by the time a reader who stopped turns the page.
    const settle = window.setTimeout(() => {
      for (const id of ids) {
        void fetch(`/api/pages/${id}`, { signal: controller.signal }).catch(
          () => undefined,
        );
      }
    }, SETTLE_MS);

    return () => {
      window.clearTimeout(settle);
      controller.abort();
    };
  }, [key]);
}
