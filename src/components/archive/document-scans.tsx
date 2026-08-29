"use client";

import { useState } from "react";

import type { DocumentPageSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * Every scan in an issue, as a grid, so the pictures can be reached without
 * reading through the pages one at a time.
 *
 * This answers the "no way to click and see all the images" half of the
 * complaint at issue level. A reader who wants to *look* at a newspaper — at
 * its layout, its engravings, the shape of its advertising — was previously
 * forced to page through the reader one sheet at a time, which is a reading
 * affordance being used as a browsing one.
 *
 * **These tiles are the full 1630px WebP scans, not thumbnails, and that is a
 * stated cost rather than an oversight.** Nothing in the pipeline emits a
 * smaller variant: `render.py` produces exactly one size, and no backend route
 * resizes anything (`pages.py` serves the file off disk with `FileResponse`).
 * Building a thumbnail path is real backend work — a route, a resize, a cache
 * directory, and a re-render pass over the archive — and is explicitly out of
 * this chunk's frontend-only scope.
 *
 * What that costs, measured live 2026-08-29 on the ingested corpus: a scan is
 * ~496-552KB, so the largest issue here (16 pages) is ~8.5MB if every tile is
 * fetched. Two things keep that from being what a reader actually pays:
 * `loading="lazy"` means only the tiles scrolled into view are ever requested,
 * and the scans are served `immutable` with a one-year max-age, so a page
 * already read costs nothing to see again. At *issue* scale that is merely
 * wasteful. At *catalogue* scale the same arithmetic is fatal — 600 issues of
 * covers would be ~330MB on one page — which is precisely why the catalogue
 * carries no cover images at all. See `document-catalogue.tsx`.
 */
export function DocumentScans({
  pages,
  currentPageNumber,
  matchedPages,
  onOpen,
}: {
  pages: DocumentPageSummary[];
  /** The page the reader is on, marked so the grid shows where they are. */
  currentPageNumber: number | null;
  /** Pages matching the within-issue search, marked in the grid. */
  matchedPages: Set<number>;
  onOpen: (pageNumber: number) => void;
}) {
  if (pages.length === 0) return null;

  return (
    <div className="px-4 pt-4 pb-6 sm:px-5">
      <p className="text-[0.75rem] leading-relaxed text-muted-foreground">
        Every scanned sheet in this issue. Tap one to read it.
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {pages.map((page) => (
          <ScanTile
            key={page.page_id}
            page={page}
            isCurrent={page.page_number === currentPageNumber}
            isMatch={matchedPages.has(page.page_number)}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </div>
  );
}

/**
 * One sheet in the grid.
 *
 * The tile keeps a newspaper's portrait proportion whether or not the scan has
 * loaded, so the grid does not reflow as images arrive — a wall of tiles
 * jumping under the thumb while scrolling is the worst version of this surface.
 * 1:1.4 is close to the corpus's real sheets (10.9in and 14.0in wide stock,
 * per `render.py`) without pretending to be exact for any one of them.
 */
function ScanTile({
  page,
  isCurrent,
  isMatch,
  onOpen,
}: {
  page: DocumentPageSummary;
  isCurrent: boolean;
  isMatch: boolean;
  onOpen: (pageNumber: number) => void;
}) {
  const [failed, setFailed] = useState(false);

  const marks: string[] = [];
  if (!page.has_text) marks.push("blank");
  if (page.figure_count > 0) {
    marks.push(page.figure_count === 1 ? "1 figure" : `${page.figure_count} figures`);
  }

  return (
    <li className="animate-rise">
      <button
        type="button"
        onClick={() => onOpen(page.page_number)}
        aria-label={`Open page ${page.page_number}${marks.length > 0 ? ` — ${marks.join(", ")}` : ""}`}
        aria-current={isCurrent ? "true" : undefined}
        className={cn(
          "group block w-full overflow-hidden rounded-md border bg-card text-left",
          "transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
          "hover:border-[var(--accent)]/60",
          "focus-visible:outline-2 focus-visible:outline-offset-2",
          "focus-visible:outline-[var(--accent)]",
          isCurrent && "border-[var(--accent)]",
        )}
      >
        <div className="relative aspect-[1/1.4] w-full overflow-hidden bg-background">
          {page.has_image && !failed ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`/api/pages/${page.page_id}/image`}
              alt={`Scan of page ${page.page_number}`}
              /* `object-top`, not centred: a newspaper's masthead is the one
                 part of the sheet that identifies it at thumbnail size, and
                 centring a tall sheet in a shorter box crops exactly that. */
              className="h-full w-full object-cover object-top"
              loading="lazy"
              decoding="async"
              onError={() => setFailed(true)}
            />
          ) : (
            /* An honest gap rather than a broken image icon. A page with no
               scan is a fact about the ingest, not a failed request. */
            <div className="flex h-full w-full items-center justify-center px-2">
              <span className="text-center text-[0.6875rem] leading-snug text-muted-foreground">
                No scan
              </span>
            </div>
          )}

          {isMatch && (
            <span className="absolute top-1 right-1 rounded-[0.2rem] bg-[var(--accent)] px-1.5 py-px text-[0.625rem] leading-tight font-medium text-[var(--accent-foreground)]">
              Match
            </span>
          )}
        </div>

        <span className="block px-2 py-1.5 font-sans text-[0.6875rem] leading-snug text-muted-foreground">
          <span className="numeric text-foreground">Page {page.page_number}</span>
          {marks.length > 0 && <span className="block">{marks.join(" · ")}</span>}
        </span>
      </button>
    </li>
  );
}
