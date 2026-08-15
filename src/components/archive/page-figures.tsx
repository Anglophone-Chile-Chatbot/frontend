"use client";

import { useState } from "react";

import type { PageFigure } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * Figures on a page: boxes over the scan, and a gallery under the text.
 *
 * Why both surfaces, rather than interleaving crops into the transcription:
 * `pages.raw_text` carries **no image anchors at all** — verified across all 71
 * pages of the live corpus, zero contain a markdown image reference or an
 * `<img>`. The ingest normaliser strips them. So there is no recorded point in
 * the text where a figure belongs, and inserting one at a position inferred
 * from the bbox's y-coordinate would be inventing placement the paper never
 * specified — on a multi-column sheet, reading order and vertical position are
 * different things. The bbox is trustworthy as a *position on the sheet*, which
 * is exactly what the scan overlay uses it for.
 *
 * The gallery exists because the Text tab is the viewer's default, and on
 * mobile especially a figure that only appears under the Scan tab is a figure
 * most readers never learn is there.
 */

/**
 * Crops smaller than this many pixels of area are artefacts, not content.
 *
 * Two figures in the live corpus are 65×30px slivers of a blank horizontal rule
 * (Star of Chile p13, both typed `Table`) whose bboxes claim a 863×563px railway
 * timetable. The timetable itself is captured correctly in the page text and
 * renders as a real 18-column table, so nothing is lost by omitting the empty
 * crop — while showing it puts two blank grey boxes on the page and implies the
 * archive found an image it did not.
 *
 * The value sits in a real, wide gap in the measured distribution rather than
 * being a guessed round number. Across all 66 live crops: the two slivers are
 * 1,885 and 1,950 px², and **the next smallest crop is 7,009 px²** — a 163×43
 * advertiser nameplate that is genuine content. A 3.6× gap separates artefact
 * from content, so 4,000 discriminates cleanly with room either side. The
 * largest crops are ~6M px², so this is four orders of magnitude below typical.
 *
 * Measured against the natural size of the loaded image rather than the bbox,
 * because the bbox is precisely what is wrong for these two figures. The API
 * carries no crop dimensions, so the browser's own decode is the only source.
 */
const MIN_CROP_AREA_PX = 4_000;

/** Block types whose bbox bounds the image itself rather than a wider region. */
const IMAGE_TIGHT_TYPES = new Set(["Picture", "Figure"]);

/**
 * Whether this figure's bbox can be trusted as the crop's frame.
 *
 * On `Picture`/`Figure` (56 of 66 live figures) the box agrees with the crop's
 * aspect ratio to a median 0.6%. On `Text`/`ComplexRegion`/`Table` it bounds the
 * enclosing region — a whole advertisement, an engraving plus its ad copy — and
 * diverges by a median ~56%. Drawing a crop stretched into a region box would
 * misrepresent the scan, so those are marked as a region instead.
 */
export function isTightBox(figure: PageFigure): boolean {
  return figure.block_type !== null && IMAGE_TIGHT_TYPES.has(figure.block_type);
}

function boxStyle(figure: PageFigure): React.CSSProperties {
  const [x1, y1, x2, y2] = figure.bbox;
  return {
    left: `${x1 * 100}%`,
    top: `${y1 * 100}%`,
    width: `${(x2 - x1) * 100}%`,
    height: `${(y2 - y1) * 100}%`,
  };
}

/** A figure's human label — "Figure 3", 1-based for the reader. */
function figureLabel(figure: PageFigure): string {
  return `Figure ${figure.figure_index + 1}`;
}

/**
 * Boxes drawn over the page scan at each figure's recorded position.
 *
 * Positions are page-relative fractions, so this is a percentage overlay on a
 * wrapper that shares the image's box — it stays correct at any render width
 * and needs no measurement of the loaded image.
 */
export function FigureOverlay({
  figures,
  onSelect,
}: {
  figures: PageFigure[];
  onSelect: (figure: PageFigure) => void;
}) {
  // A box with no area cannot be tapped and would paint as a hairline, so it is
  // dropped here on the bbox alone. Unlike the gallery, the overlay cannot wait
  // for the crop to decode — it draws from the bbox — so the two surfaces filter
  // on different evidence for the same reason.
  const drawable = figures.filter((figure) => {
    const [x1, y1, x2, y2] = figure.bbox;
    return x2 - x1 > 0 && y2 - y1 > 0;
  });

  if (drawable.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      {drawable.map((figure) => (
        <button
          key={figure.figure_id}
          type="button"
          onClick={() => onSelect(figure)}
          style={boxStyle(figure)}
          // The box is the tap target and is as large as the figure itself, so
          // it clears the 44px minimum wherever the figure is big enough to be
          // worth tapping in the first place.
          className={cn(
            "pointer-events-auto absolute rounded-[0.15rem] transition-colors duration-[120ms]",
            "ease-[var(--ease-crisp)] focus-visible:outline-2 focus-visible:outline-offset-2",
            "focus-visible:outline-[var(--accent)]",
            isTightBox(figure)
              ? "border-2 border-[var(--accent)]/70 hover:bg-[var(--accent)]/15"
              : "border-2 border-dashed border-[var(--accent)]/50 hover:bg-[var(--accent)]/10",
          )}
          aria-label={`${figureLabel(figure)} — open full size`}
        >
          <span className="absolute -top-px left-0 -translate-y-full bg-[var(--accent)] px-1 py-px text-[0.625rem] leading-tight font-medium text-white">
            {figure.figure_index + 1}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * The figures on this page, shown under the transcription.
 *
 * Each crop is loaded at its natural size and dropped if it turns out to be a
 * blank sliver (see `MIN_AREA_FRACTION`) — the check has to happen after load
 * because the API carries no crop dimensions, only the bbox, and the bbox is
 * the unreliable half for exactly these figures.
 */
export function FigureGallery({
  figures,
  onSelect,
}: {
  figures: PageFigure[];
  onSelect: (figure: PageFigure) => void;
}) {
  const [dropped, setDropped] = useState<Set<string>>(new Set());

  const drop = (figureId: string) =>
    setDropped((current) => {
      if (current.has(figureId)) return current;
      const next = new Set(current);
      next.add(figureId);
      return next;
    });

  const shown = figures.filter((figure) => !dropped.has(figure.figure_id));
  if (figures.length === 0) return null;

  return (
    <section className={cn("mt-8", shown.length === 0 && "hidden")}>
      <h4 className="rule-b font-sans text-[0.6875rem] tracking-[0.08em] text-muted-foreground uppercase pb-1.5">
        {shown.length === 1 ? "Figure on this page" : "Figures on this page"}
      </h4>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map((figure) => (
          <li key={figure.figure_id}>
            <button
              type="button"
              onClick={() => onSelect(figure)}
              className={cn(
                "group block w-full overflow-hidden rounded-md border bg-card text-left",
                "transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
                "hover:border-[var(--accent)]/60 focus-visible:outline-2",
                "focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/figures/${figure.figure_id}/image`}
                alt={`${figureLabel(figure)} from this page`}
                className="h-auto w-full bg-background"
                loading="lazy"
                onLoad={(event) => {
                  const image = event.currentTarget;
                  const area = image.naturalWidth * image.naturalHeight;
                  if (area > 0 && area < MIN_CROP_AREA_PX) drop(figure.figure_id);
                }}
                // A crop whose file is missing is dropped rather than left as a
                // broken image: the row would otherwise claim a figure exists
                // and show nothing.
                onError={() => drop(figure.figure_id)}
              />
              <span className="block px-2 py-1.5 font-sans text-[0.6875rem] text-muted-foreground">
                {figureLabel(figure)}
                {!isTightBox(figure) && (
                  <span className="block text-[0.625rem]">region on the page</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * One figure at full size, over the viewer.
 *
 * Deliberately a plain overlay rather than the shadcn `Dialog`: the viewer is
 * already a sheet on mobile, and nesting a dialog inside a sheet fights over
 * focus trapping and body scroll lock. This needs neither — it is a single
 * image with a close control.
 */
export function FigureLightbox({
  figure,
  onClose,
}: {
  figure: PageFigure;
  onClose: () => void;
}) {
  return (
    <div
      // Fully opaque, not a translucent scrim: the page behind is dense
      // newsprint, and at 97% the transcription still read through the image —
      // a 19th-century halftone needs a clean ground to be legible at all.
      className="animate-fade absolute inset-0 z-30 flex flex-col bg-background p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${figureLabel(figure)}, full size`}
    >
      <div className="flex items-center justify-between gap-3 pb-3">
        <p className="font-sans text-[0.75rem] text-muted-foreground">
          {figureLabel(figure)}
          {!isTightBox(figure) && " · region on the page"}
        </p>
        <button
          type="button"
          onClick={onClose}
          // 44px minimum: this is the only way out of the overlay on a phone.
          className="min-h-[44px] min-w-[44px] px-2 font-sans text-[0.8125rem] text-foreground underline-offset-4 hover:underline"
        >
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/figures/${figure.figure_id}/image`}
          alt={`${figureLabel(figure)}, full size`}
          className="mx-auto h-auto w-full max-w-3xl rounded-md border bg-card"
        />
      </div>
    </div>
  );
}
