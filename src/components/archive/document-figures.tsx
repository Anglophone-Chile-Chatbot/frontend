"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { FigureLightbox } from "@/components/archive/page-figures";
import { Plate } from "@/components/archive/plate";
import type { DocumentFigure } from "@/hooks/use-document-figures";
import { cn } from "@/lib/utils";

/**
 * Every figure in an issue, in one place.
 *
 * The other half of "no way to click and see all the images". Until this
 * existed, a figure could only be found by opening the page that happened to
 * carry it — the pictures in a newspaper were reachable only by reading past
 * them, which for a historian scanning an issue for its engravings is exactly
 * backwards.
 *
 * **Crops, not scans, and that distinction is what makes this surface cheap.**
 * A figure crop is ~33KB measured live, against ~496-552KB for a full sheet, so
 * the densest issue in the corpus (20 figures) is well under a megabyte — no
 * thumbnail path is needed here, and none is faked. Contrast the scan grid,
 * which has no such luxury and says so.
 *
 * Each figure links back to its page, so the gallery is a way *into* the issue
 * rather than a dead end: a reader who finds the engraving they wanted lands on
 * the page it was printed on, at the point in the transcription where it sits.
 */
export function DocumentFigures({
  figures,
  status,
  onOpenPage,
}: {
  figures: DocumentFigure[];
  status: "idle" | "loading" | "loaded" | "error";
  onOpenPage: (pageNumber: number) => void;
}) {
  const [zoomed, setZoomed] = useState<DocumentFigure | null>(null);
  const [dropped, setDropped] = useState<Set<string>>(new Set());

  const drop = (figureId: string) =>
    setDropped((current) => {
      if (current.has(figureId)) return current;
      const next = new Set(current);
      next.add(figureId);
      return next;
    });

  const shown = figures.filter((entry) => !dropped.has(entry.figure.figure_id));

  if (status === "error") {
    return (
      <GalleryNote
        title="The figures could not be loaded"
        body="The archive service did not respond. The issue itself is still readable — try the Read tab."
      />
    );
  }

  // The empty case is real and must stay honest: *The Valparaiso English
  // Mercury* of 1844-01-27 has no figures at all. Hiding the tab or showing a
  // placeholder would both be lies about the paper — a four-page issue that ran
  // no engravings is a fact worth stating plainly.
  if (status === "loaded" && shown.length === 0) {
    return (
      <GalleryNote
        title="No figures were found in this issue"
        body="Nothing on these pages was detected as an engraving, illustration or advertising cut. The pages themselves are still here — read them, or look through the scans."
      />
    );
  }

  return (
    <div className="px-4 pt-4 pb-6 sm:px-5">
      {shown.length > 0 && (
        <p className="text-[0.75rem] leading-relaxed text-muted-foreground">
          {shown.length === 1
            ? "One plate was found in this issue."
            : `${shown.length} plates were found across this issue.`}{" "}
          Tap one to see it full size, or open the page it was printed on.
        </p>
      )}

      {shown.length > 0 && (
        /* Plates, one per row and centred, rather than a four-up thumbnail
           grid. This is a gallery *of a newspaper's engravings*, and each one
           gets the ruled cut line the paper would have set beneath it — the
           grid rendered them as UI cards with a counter, with no `<figure>` or
           `<figcaption>` element on the page at all (measured 2026-09-04).
           `sm:grid-cols-2` keeps a wide screen from running one narrow column
           down an enormous page. */
        <div className="mt-1 sm:grid sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
          {shown.map((entry, index) => (
            <div key={entry.figure.figure_id} className="animate-rise">
              <Plate
                figure={entry.figure}
                pageNumber={entry.pageNumber}
                // Numbered across the whole issue. `figure_index` is
                // page-relative, so using it here would print "Plate 1" twice
                // in one gallery — once for page 2 and again for page 3.
                label={`Plate ${index + 1}`}
                onSelect={() => setZoomed(entry)}
                onError={() => drop(entry.figure.figure_id)}
              />
              {/* The way back into the issue. Separate from the plate's own
                  zoom control, not nested inside it — a button within a button
                  is invalid and the inner one is unreachable by keyboard. */}
              <div className="-mt-3 mb-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => onOpenPage(entry.pageNumber)}
                  className={cn(
                    "inline-flex min-h-[44px] items-center gap-1 px-3",
                    "font-sans text-[0.75rem] text-[var(--accent)]",
                    "transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
                    "hover:text-foreground focus-visible:outline-2",
                    "focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
                  )}
                >
                  Read page {entry.pageNumber}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {status === "loading" && (
        <p className="mt-4 flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Gathering the figures…
        </p>
      )}

      {zoomed && (
        <FigureLightbox figure={zoomed.figure} onClose={() => setZoomed(null)} />
      )}
    </div>
  );
}

function GalleryNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="measure px-4 pt-8 pb-6 sm:px-5">
      <h3 className="font-heading text-[0.9375rem] text-foreground">{title}</h3>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}
