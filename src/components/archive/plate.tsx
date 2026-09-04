"use client";

import type { PageFigure } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * A figure as a newspaper prints one: a centred cut with a rule and a caption
 * set beneath it.
 *
 * **What was wrong.** Every figure in the reader was a bare `<button>` wrapping
 * an `<img>` and a `<span>`. Measured live 2026-09-04 on *The Star of Chile*
 * 1905-01-14 p3: **zero `<figure>` elements and zero `<figcaption>` elements on
 * the page**, and each crop was pinned hard left in the column — 0px of gap on
 * the left against 249px on the right in a 633px measure. A 19th-century
 * newspaper centres its cuts in the column and sets a caption under them; this
 * looked like an image dumped into a chat log.
 *
 * **On caption text, and the line this component will not cross.** The API
 * carries no caption for a figure — `PageFigure` has `figure_index`,
 * `block_type`, `bbox` and `text_anchor`, and nothing else. Image extraction
 * and captions are *deliberately disabled* on the OCR call, because model-
 * invented caption text stored next to a scan would put fabricated words where
 * a reader expects a transcription. So this component styles the caption slot
 * like a newspaper cut line but fills it only with what the archive genuinely
 * knows: which plate it is, and where on the sheet it sits. It never writes a
 * description of the picture. The typography is editorial; the words stay
 * honest.
 *
 * "Plate" rather than "Figure" is the period-correct term for an engraving in
 * a newspaper of this era, and it distinguishes the archive's own numbering
 * from anything the paper itself printed.
 */
export function Plate({
  figure,
  onSelect,
  /** Where the crop sits, when the caller knows it and the reader does not. */
  pageNumber,
  label,
  className,
  onError,
  onLoad,
}: {
  figure: PageFigure;
  onSelect: (figure: PageFigure) => void;
  pageNumber?: number;
  /**
   * Overrides the plate's own label.
   *
   * `figure_index` is numbered *within its page*, so an issue-wide gallery
   * shows "Plate 1 · Page 2" directly beside "Plate 1 · Page 3" — two things
   * called Plate 1, which reads as a bug rather than as per-page numbering.
   * The issue gallery passes a running number instead; a single page's own
   * figures keep the page-relative index, which is correct in that context.
   */
  label?: string;
  className?: string;
  onError?: () => void;
  onLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
}) {
  const caption = label ?? plateLabel(figure);
  return (
    <figure className={cn("my-6 flex flex-col items-center", className)}>
      <button
        type="button"
        onClick={() => onSelect(figure)}
        aria-label={`${caption} — open full size`}
        className={cn(
          "group block max-w-full cursor-zoom-in overflow-hidden rounded-[0.2rem]",
          "border bg-card",
          // Transform, not colour: the card lifts a hair on hover, 120ms,
          // which is the design language's "confirms an action, never performs".
          "transition-[border-color,transform] duration-[120ms] ease-[var(--ease-crisp)]",
          "hover:-translate-y-px hover:border-[var(--accent)]/60",
          "focus-visible:outline-2 focus-visible:outline-offset-2",
          "focus-visible:outline-[var(--accent)]",
          "motion-reduce:hover:translate-y-0",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/figures/${figure.figure_id}/image`}
          alt={caption}
          className="block h-auto w-full bg-background"
          loading="lazy"
          decoding="async"
          onLoad={onLoad}
          onError={onError}
        />
      </button>

      {/* The cut line. A hairline rule above it and letter-spaced small caps
          under the image is how these papers set their captions, and it is
          what makes the block read as *part of the page* rather than as a UI
          card that happens to contain an engraving. */}
      <figcaption
        className={cn(
          "mt-2 max-w-[min(28rem,100%)] border-t border-[var(--rule)] pt-1.5",
          "text-center font-sans text-[0.6875rem] leading-snug text-muted-foreground",
        )}
      >
        <span className="tracking-[0.08em] uppercase text-foreground/80">
          {caption}
        </span>
        {pageNumber !== undefined && (
          <span className="numeric"> · Page {pageNumber}</span>
        )}
        {/* Only said when true: a loose bbox means the crop is the region the
            engraving sits in, not the engraving's own edges. Saying so is the
            difference between a caption and a claim. */}
        {!isTightBox(figure) && (
          <span className="mt-0.5 block text-[0.625rem] normal-case">
            Region of the sheet, not the cut’s exact edges
          </span>
        )}
      </figcaption>
    </figure>
  );
}

/** The archive's own name for a plate — 1-based, as a reader counts. */
export function plateLabel(figure: PageFigure): string {
  return `Plate ${figure.figure_index + 1}`;
}

/** Block types whose bbox bounds the image itself rather than a wider region. */
const IMAGE_TIGHT_TYPES = new Set(["Picture", "Figure"]);

/**
 * Whether this figure's bbox can be trusted as the crop's frame.
 *
 * On `Picture`/`Figure` (56 of 66 live figures) the box agrees with the crop's
 * aspect ratio to a median 0.6%. On `Text`/`ComplexRegion`/`Table` it bounds
 * the enclosing region — a whole advertisement, an engraving plus its ad copy
 * — and diverges by a median ~56%. Drawing a crop stretched into a region box
 * would misrepresent the scan, so those are marked as a region instead.
 */
export function isTightBox(figure: PageFigure): boolean {
  return figure.block_type !== null && IMAGE_TIGHT_TYPES.has(figure.block_type);
}
