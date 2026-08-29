"use client";

import { useEffect, useMemo, useState } from "react";

import type { DocumentPageSummary, PageDetail, PageFigure } from "@/lib/api/types";

/**
 * Every figure in an issue, gathered for the gallery.
 *
 * **No new endpoint, on purpose.** There is no per-document figures route, and
 * `backend/plans.md` asks that one be added only after confirming that
 * `GET /pages/{id}` — which already carries `figures` on `PageDetail` — is
 * genuinely insufficient. It is sufficient here, because of what the page list
 * already tells us: `figure_count` is on every `DocumentPageSummary`, so the
 * pages holding figures are known *before* anything is fetched, and only those
 * are requested. On the live corpus that is 3 requests for the Mercury
 * 1843-12-16 rather than 8, and **zero** for the Mercury 1844-01-27, which has
 * no figures at all. A dedicated route would save round trips on a
 * figure-dense issue and nothing else; it is not worth a second contract to
 * keep in sync, and this one cannot go stale relative to what the reader sees,
 * since it is the same fetch the reader's own page view performs.
 *
 * Requests go out sequentially rather than all at once. nginx applies
 * `api_general` at 60r/m with burst 30 to every `/api/` call (CHUNK 0), and a
 * 16-page issue with figures on 12 of them would fire 12 parallel requests the
 * moment a tab is opened — on top of whatever paging the reader has already
 * done. `usePagePrefetch` learned this the expensive way: a 16-page sweep with
 * an eager prefetch produced 9 × 502, all of them the limiter. Sequential
 * fetching also lets the gallery fill in progressively, which is the better
 * experience anyway.
 */

/** A figure plus the page it belongs to, which the gallery needs to link. */
export interface DocumentFigure {
  figure: PageFigure;
  pageId: string;
  pageNumber: number;
  /**
   * Character offset of the figure in its page's text, when known.
   *
   * Carried so the gallery can say whether opening it will land the reader at
   * the right place in the transcription. 57 of the 66 live figures have one.
   */
  textAnchor: number | null;
}

export function useDocumentFigures(
  pages: DocumentPageSummary[],
  /** False until the reader opens the gallery — nothing is fetched before. */
  enabled: boolean,
) {
  const [figures, setFigures] = useState<DocumentFigure[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">(
    "idle",
  );

  /**
   * The pages worth fetching, as a stable primitive.
   *
   * Joined into a string so the effect depends on the ids themselves rather
   * than on a fresh array identity each render, which would restart the whole
   * sweep on every parent re-render — and the parent re-renders on every
   * keystroke in the search box.
   */
  const key = useMemo(
    () =>
      pages
        .filter((page) => page.figure_count > 0)
        .map((page) => `${page.page_id}:${page.page_number}`)
        .join(","),
    [pages],
  );

  // An issue with no figures needs no fetch and no effect: the page list has
  // already proved the answer, so the result is derived rather than stored.
  // *The Valparaiso English Mercury* of 1844-01-27 is exactly this case — 4
  // pages, 0 figures — and it is the empty state the gallery must show
  // honestly rather than hide.
  const isEmpty = key.length === 0;

  /**
   * Clear the previous issue's figures before gathering this one's.
   *
   * During render, not in the effect — the pattern `use-source-page`
   * established. Clearing inside the effect would paint one frame of the
   * previous issue's crops under the new issue's heading, and the sweep is
   * slow enough (one request per page carrying figures) for that frame to be
   * seen rather than merely theoretical.
   */
  const [gatheredFor, setGatheredFor] = useState<string | null>(null);
  if (enabled && !isEmpty && key !== gatheredFor) {
    setGatheredFor(key);
    setFigures([]);
    setStatus("loading");
  }

  useEffect(() => {
    if (!enabled || isEmpty) return;

    const controller = new AbortController();
    const targets = key.split(",").map((entry) => {
      const [pageId, pageNumber] = entry.split(":");
      return { pageId, pageNumber: Number(pageNumber) };
    });

    void (async () => {
      const collected: DocumentFigure[] = [];
      let reached = 0;

      for (const target of targets) {
        try {
          const response = await fetch(`/api/pages/${target.pageId}`, {
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(String(response.status));
          const detail = (await response.json()) as PageDetail;
          reached += 1;

          for (const figure of detail.figures ?? []) {
            collected.push({
              figure,
              pageId: target.pageId,
              pageNumber: target.pageNumber,
              textAnchor: figure.text_anchor,
            });
          }
          // Published after each page so the grid fills in as it goes rather
          // than staying empty until the last request lands.
          if (!controller.signal.aborted) setFigures([...collected]);
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          // One unreachable page must not blank a gallery that has already
          // gathered figures from the others — the reader would be told the
          // issue has no pictures when most of them loaded fine. The sweep
          // carries on and the count simply reflects what was reached.
          continue;
        }
      }

      // `error` means *nothing was reached*, not "nothing was found". A page
      // list that promised figures and a sweep that returned none is a
      // contradiction worth reporting; a sweep that reached its pages and
      // found fewer figures than advertised is not this hook's to judge, and
      // the gallery renders honestly either way.
      if (!controller.signal.aborted) {
        setStatus(reached === 0 ? "error" : "loaded");
      }
    })();

    return () => controller.abort();
  }, [key, enabled, isEmpty]);

  // `loaded` with nothing in it — a fact from the page list, not a fetch that
  // came back empty, and the gallery renders the same honest note either way.
  if (isEmpty) return { figures: [] as DocumentFigure[], status: "loaded" as const };

  return { figures, status };
}
