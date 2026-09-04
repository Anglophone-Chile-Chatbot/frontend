"use client";

import { useEffect, useRef, useState } from "react";

import type { PageFigure } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { isTightBox, Plate, plateLabel } from "./plate";
import { ZoomableImage } from "./zoomable-image";

/**
 * Figures on a page: boxes over the scan, an inline crop in the transcription,
 * and a gallery fallback for the figures that have neither.
 *
 * This component still owns the scan overlay (`FigureOverlay`, unchanged by
 * D5 — it is the Scan tab's only figure treatment) and the gallery
 * (`FigureGallery`). What changed 2026-08-16 (D5): `pages.raw_text` now
 * carries a real anchor for most figures (`text_anchor`, C6, 2026-08-15) — a
 * character offset marking where each figure follows in reading order,
 * computed by text-matching each figure's preceding block, never guessed
 * from the bbox's y-coordinate. 57 of 66 live figures have one. Those are
 * spliced into the Text tab's block list at their anchor
 * (`splicePageFigures` in `lib/page-blocks.ts`) and rendered inline by
 * `source-viewer-body.tsx`'s `InlineFigure` — genuinely at their place in the
 * text, not inferred from vertical position. The 9 without an anchor keep
 * being shown by `FigureGallery` below, exactly as every figure was before
 * this changed. The Scan tab's overlay uses the bbox for position on the
 * sheet regardless of anchor status — that was never in question.
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

/**
 * `isTightBox` and the plate label now live in `plate.tsx`, beside the
 * `<figure>`/`<figcaption>` markup that is their main consumer. Re-exported
 * here so the many existing importers of this module keep working — one
 * definition, not two that can drift.
 */
export { isTightBox, plateLabel } from "./plate";

function boxStyle(figure: PageFigure): React.CSSProperties {
  const [x1, y1, x2, y2] = figure.bbox;
  return {
    left: `${x1 * 100}%`,
    top: `${y1 * 100}%`,
    width: `${(x2 - x1) * 100}%`,
    height: `${(y2 - y1) * 100}%`,
  };
}

/** A figure's human label — "Plate 3", 1-based for the reader. */
function figureLabel(figure: PageFigure): string {
  return plateLabel(figure);
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
        {shown.length === 1 ? "Plate on this page" : "Plates on this page"}
      </h4>
      {/* One centred column rather than a tile grid: these are the figures the
          pipeline could not anchor into the text, so they are being presented
          as plates in their own right, and a newspaper sets a plate centred
          under a rule — not as a row of thumbnails. */}
      <div className="mt-1">
        {shown.map((figure) => (
          <Plate
            key={figure.figure_id}
            figure={figure}
            onSelect={onSelect}
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
        ))}
      </div>
    </section>
  );
}

/**
 * One figure at full size, over the viewer — now actually readable.
 *
 * Deliberately a plain overlay rather than the shadcn `Dialog`: the viewer is
 * already a sheet on mobile, and nesting a dialog inside a sheet fights over
 * focus trapping and body scroll lock.
 *
 * **Three real bugs fixed here, all verified live 2026-09-04.**
 *
 * 1. **Escape did nothing.** The overlay declared `role="dialog"` and
 *    `aria-modal="true"` with no key handler at all, so the one gesture every
 *    reader tries first left them stuck behind a picture with only a small
 *    "Close" link out. Confirmed by dispatching a real `keydown` at the live
 *    page: the dialog stayed mounted.
 * 2. **Focus was neither taken nor returned.** An `aria-modal` overlay that
 *    never moves focus is a broken contract for a keyboard or screen-reader
 *    user — tab order stayed behind it, on the page they could not see. Focus
 *    now moves to the close control on open and returns to whatever opened the
 *    overlay on close.
 * 3. **"Full size" was an upscale.** `w-full max-w-3xl` stretched a 306×286
 *    crop to 736px — **2.41× past its own pixels** — and called the blur full
 *    size. `ZoomableImage` caps zoom at 1:1 with the file and starts fitted,
 *    so "full size" now means what it says.
 */
export function FigureLightbox({
  figure,
  onClose,
}: {
  figure: PageFigure;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Remember who opened this, so focus can go home afterwards.
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus?.();
    };
  }, [onClose]);

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
      <div className="rule-b flex items-center justify-between gap-3 pb-3">
        <p className="font-sans text-[0.75rem] tracking-[0.08em] uppercase text-muted-foreground">
          {figureLabel(figure)}
          {!isTightBox(figure) && " · region on the page"}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          // 44px minimum: this is the only way out of the overlay on a phone.
          className={cn(
            "min-h-[44px] min-w-[44px] rounded-md px-3 font-sans text-[0.8125rem]",
            "text-foreground transition-colors duration-[120ms]",
            "ease-[var(--ease-crisp)] hover:bg-secondary",
            "focus-visible:outline-2 focus-visible:outline-offset-2",
            "focus-visible:outline-[var(--accent)]",
          )}
        >
          Close
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto py-3">
        <ZoomableImage
          src={`/api/figures/${figure.figure_id}/image`}
          alt={`${figureLabel(figure)}, full size`}
          className="w-full max-w-3xl"
        />
      </div>
    </div>
  );
}
