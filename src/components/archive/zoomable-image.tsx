"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A scan that can actually be read: pinch, double-tap, drag and discrete
 * controls over a page image.
 *
 * **Why this exists.** The scans are rendered at 192 DPI and stored at
 * 1630×2225 (`render.py`), but the viewer painted them into whatever width the
 * column happened to be — measured live 2026-09-04: 728px on a 1440px desktop
 * and 343px at 375px. That is **2.24× and 4.75× of real, already-downloaded
 * detail thrown away**, with no control anywhere on the page to get it back.
 * A reader looking at 19th-century newsprint could see that text existed and
 * could not read it. For an archive whose entire purpose is reading the
 * primary source, that was the product's central failure, not a polish item.
 *
 * **Why a hand-rolled transform rather than a library.** The interaction is
 * one `transform: translate() scale()` on a single `<img>` inside an
 * `overflow-hidden` frame. A pan/zoom dependency would add a bundle and an
 * abstraction to own eight lines of matrix arithmetic, and none of the
 * candidates honour `prefers-reduced-motion` or the 44px tap floor without
 * configuration anyway. `motion` is already in `package.json` and imported
 * nowhere; adding a *second* unused animation dependency to this problem
 * would be the wrong direction.
 *
 * **The zoom ceiling is derived, never a round number.** Zooming past an
 * image's own pixels magnifies the JPEG's artefacts and invites a reader to
 * mistake compression noise for something the paper printed. So the maximum is
 * whatever puts one image pixel on one CSS pixel (`naturalWidth / fittedWidth`)
 * — 2.24× on desktop, 4.75× on a phone, computed per image from the file that
 * actually loaded. The old lightbox did the opposite: `w-full max-w-3xl`
 * *upscaled* a 306px crop to 736px, 2.41× past native, and presented the blur
 * as "full size".
 *
 * Gestures are handled with Pointer Events, so one code path serves mouse,
 * touch and pen. `touch-action: none` is set only while zoomed in — at fit
 * scale the browser keeps its native vertical scroll, so a reader flicking
 * down a long page is never fighting a pan handler for the gesture.
 */
export function ZoomableImage({
  src,
  alt,
  /** Rendered over the image at fit scale — the figure boxes on a scan. */
  overlay,
  className,
  imageClassName,
  onLoad,
  onError,
}: {
  src: string;
  alt: string;
  overlay?: React.ReactNode;
  className?: string;
  imageClassName?: string;
  onLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
  onError?: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  /** 1:1 pixel ceiling, derived once the image's natural size is known. */
  const [maxScale, setMaxScale] = useState(1);

  // Live pointers, keyed by id, so a two-finger pinch and a one-finger drag
  // are the same bookkeeping rather than two separate gesture systems.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const lastTap = useRef(0);
  /**
   * Whether a pinch is in flight, as state rather than a ref.
   *
   * This drives the transform's `transition`, which is read during render — so
   * a ref would be both a lint error and an actual bug: mutating a ref does not
   * re-render, so the image could keep its 160ms transition through a whole
   * pinch and lag behind the fingers.
   */
  const [isPinching, setIsPinching] = useState(false);

  const isZoomed = scale > 1.01;

  /** Clamp the pan so the image can never be dragged off its own frame. */
  const clamp = useCallback((next: { x: number; y: number }, atScale: number) => {
    const frame = frameRef.current;
    if (!frame) return next;
    const { width, height } = frame.getBoundingClientRect();
    // At scale s the image overhangs the frame by (s-1)/2 on each side.
    const slackX = Math.max(0, (width * atScale - width) / 2);
    const slackY = Math.max(0, (height * atScale - height) / 2);
    return {
      x: Math.min(slackX, Math.max(-slackX, next.x)),
      y: Math.min(slackY, Math.max(-slackY, next.y)),
    };
  }, []);

  const applyScale = useCallback(
    (next: number, origin?: { x: number; y: number }) => {
      const target = Math.min(maxScale, Math.max(1, next));

      setScale((current) => {
        if (target <= 1.001) {
          setOffset({ x: 0, y: 0 });
          return 1;
        }

        // Keep the point under the fingers (or the frame's centre) fixed, so
        // zooming feels like moving a loupe over the sheet rather than the
        // sheet jumping out from under the reader.
        const frame = frameRef.current;
        if (frame && origin) {
          const rect = frame.getBoundingClientRect();
          const fromCentreX = origin.x - (rect.left + rect.width / 2);
          const fromCentreY = origin.y - (rect.top + rect.height / 2);
          const ratio = target / current;
          setOffset((previous) =>
            clamp(
              {
                x: fromCentreX - (fromCentreX - previous.x) * ratio,
                y: fromCentreY - (fromCentreY - previous.y) * ratio,
              },
              target,
            ),
          );
        } else {
          setOffset((previous) => clamp(previous, target));
        }

        return target;
      });
    },
    [clamp, maxScale],
  );

  /** Fit ⇄ native, the gesture every photo viewer has trained readers to expect. */
  const toggleZoom = useCallback(
    (origin?: { x: number; y: number }) => {
      applyScale(isZoomed ? 1 : maxScale, origin);
    },
    [applyScale, isZoomed, maxScale],
  );

  const handleLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const image = event.currentTarget;
      const rendered = image.getBoundingClientRect().width;
      // The ceiling is how much real detail the file is holding back. An image
      // already displayed at or above its native width gets no zoom at all,
      // rather than a control that magnifies nothing.
      const ceiling = rendered > 0 ? image.naturalWidth / rendered : 1;
      setMaxScale(Math.max(1, Math.min(8, ceiling)));
      onLoad?.(event);
    },
    [onLoad],
  );

  // Recompute the ceiling when the column resizes — the same scan is 4.75x
  // held back at 375px and 2.24x at desktop, so a rotation or a window drag
  // changes how much zoom is honest.
  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;

    const observer = new ResizeObserver(() => {
      const rendered = image.getBoundingClientRect().width;
      if (rendered > 0 && image.naturalWidth > 0) {
        setMaxScale(Math.max(1, Math.min(8, image.naturalWidth / rendered)));
      }
    });
    observer.observe(image);
    return () => observer.disconnect();
  }, []);

  const onPointerDown = (event: React.PointerEvent) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        scale,
      };
      setIsPinching(true);
      return;
    }

    // Double-tap / double-click, measured on the pointer itself so it works
    // for touch and mouse alike.
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      toggleZoom({ x: event.clientX, y: event.clientY });
      return;
    }
    lastTap.current = now;

    if (isZoomed) {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    // Pinch: two fingers drive scale from the ratio of their separation.
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const next = (distance / pinchStart.current.distance) * pinchStart.current.scale;
      applyScale(next, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      return;
    }

    // Drag to pan, but only while zoomed: at fit scale there is nothing to pan
    // to, and swallowing the gesture would break scrolling the page.
    if (isZoomed && pointers.current.size === 1) {
      event.preventDefault();
      setOffset((current) =>
        clamp(
          {
            x: current.x + (event.clientX - previous.x),
            y: current.y + (event.clientY - previous.y),
          },
          scale,
        ),
      );
    }
  };

  const endPointer = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) {
      pinchStart.current = null;
      setIsPinching(false);
    }
  };

  // Ctrl/⌘ + wheel is the desktop convention for zooming an image rather than
  // scrolling past it. A bare wheel is left alone so the page still scrolls.
  const onWheel = (event: React.WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    applyScale(scale * (event.deltaY < 0 ? 1.12 : 0.89), {
      x: event.clientX,
      y: event.clientY,
    });
  };

  const canZoom = maxScale > 1.01;

  return (
    <div className={cn("relative", className)}>
      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
        onWheel={onWheel}
        className={cn(
          "relative overflow-hidden rounded-md border bg-card",
          isZoomed ? "cursor-grab touch-none active:cursor-grabbing" : "touch-pan-y",
        )}
      >
        <div
          style={{
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
            // Only the settled state animates. Animating mid-pinch would lag
            // the image behind the fingers, which reads as jank rather than
            // as motion — the design language's "sharp, never slow" applied to
            // a continuous gesture.
            transition: isPinching ? "none" : "transform 160ms var(--ease-crisp)",
          }}
          className="origin-center will-change-transform"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={src}
            alt={alt}
            className={cn("block h-auto w-full select-none", imageClassName)}
            draggable={false}
            loading="lazy"
            decoding="async"
            onLoad={handleLoad}
            onError={onError}
          />
          {/* The figure boxes ride inside the transform, so they stay pinned to
              the parts of the sheet they mark at every zoom level. */}
          {overlay}
        </div>
      </div>

      {canZoom && (
        <div className="mt-2 flex items-center justify-end gap-1">
          <span
            aria-live="polite"
            className="numeric mr-auto font-sans text-[0.6875rem] text-muted-foreground"
          >
            {isZoomed
              ? `${Math.round(scale * 100)}% — drag to move`
              : "Pinch, double-tap or use + to read the print"}
          </span>
          <ZoomButton
            label="Zoom out"
            onClick={() => applyScale(scale - 0.5)}
            disabled={!isZoomed}
          >
            <Minus className="h-4 w-4" aria-hidden />
          </ZoomButton>
          <ZoomButton
            label={isZoomed ? "Fit the page to the screen" : "Zoom to full detail"}
            onClick={() => toggleZoom()}
          >
            <Maximize2 className="h-4 w-4" aria-hidden />
          </ZoomButton>
          <ZoomButton
            label="Zoom in"
            onClick={() => applyScale(scale + 0.5)}
            disabled={scale >= maxScale - 0.01}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </ZoomButton>
        </div>
      )}
    </div>
  );
}

/** A zoom control. 44px square — the hard tap-target floor, no exceptions. */
function ZoomButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-md border bg-card",
        "text-foreground transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
        "hover:enabled:border-[var(--accent)]/60 hover:enabled:bg-secondary",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        "focus-visible:outline-[var(--accent)] disabled:opacity-40",
      )}
    >
      {children}
    </button>
  );
}
