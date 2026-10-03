"use client";

import { Minus, Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { cn } from "@/lib/utils";

/**
 * Where a reader left a scan: the zoom, and the pan as a *fraction of the
 * frame* — never pixels, so it survives the pane changing width (the docked
 * panel widens when the left rail collapses) or a phone rotating.
 */
export interface ScanView {
  scale: number;
  nx: number;
  ny: number;
}

/** Button and double-tap zooms glide; continuous gestures never do. */
const GLIDE_MS = 200;
const STEP = 1.5;
const TAP_ZOOM = 2.5;
const MAX_CEILING = 8;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * A scan that can actually be read: it sits *whole* in its pane, and the reader
 * zooms into the print with a pinch, a double-tap, the trackpad, the slider or
 * the buttons, then drags it around.
 *
 * **A fixed viewer, not a tall image in a scrolling column (2026-09-30).** The
 * old frame was the whole 1630×2225 sheet at column width, so at 1× it was
 * taller than the pane: the zoom controls sat below the fold, the page had to
 * be scrolled *and* panned, and "zoom into that corner" meant fighting two
 * scrollers. Now the sheet is fitted inside the pane (both dimensions) and the
 * controls are always in view under it — the way a photo viewer works.
 *
 * **The zoom ceiling is derived, never a round number.** Past the image's own
 * pixels a scan only magnifies JPEG artefacts, and a reader could mistake
 * compression noise for something the paper printed. The ceiling is whatever
 * puts one image pixel on one CSS pixel (`1 / fit`), computed from the file
 * that actually loaded. An image already shown at its native size gets no zoom
 * control at all rather than one that magnifies nothing.
 *
 * **Smoothness.** The transform is written straight to the element from
 * pointer/wheel events — no React state in the gesture path — so the image
 * stays under the fingers. The CSS transition is *off* during any continuous
 * input (drag, pinch, wheel) and *on* only for discrete jumps (buttons,
 * double-tap, fit). The previous version left a 160ms transition running while
 * panning, so the image trailed the cursor, and pushed every wheel tick
 * through `setState`. A released drag carries momentum and decays; the wheel
 * listener is attached natively as non-passive, because React's `onWheel` is
 * passive and its `preventDefault` — which stops the browser zooming the whole
 * page on ⌘/ctrl+wheel — silently did nothing.
 *
 * **Remembered position.** Every change is reported through `onView`, and the
 * parent hands the last one back through `readView` when this mounts again —
 * so flipping to the Text tab and back loses nothing. The parent drops what it
 * kept when a different page or a new citation is opened, which is the only
 * time the position should reset.
 *
 * `src` must be keyed by the caller: a new image needs a new component, so
 * its natural size and position start clean.
 */
export function ZoomableImage({
  src,
  alt,
  overlay,
  className,
  readView,
  onView,
  onLoad,
  onError,
}: {
  src: string;
  alt: string;
  /** Drawn over the image inside the transform — the figure boxes on a scan. */
  overlay?: React.ReactNode;
  className?: string;
  /** The position to come back to, read once the geometry is known. */
  readView?: () => ScanView | null;
  /** Called with every new position, for the parent to keep. */
  onView?: (view: ScanView) => void;
  onLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
  onError?: () => void;
}) {
  /** The last position, for when the parent is not keeping one. */
  const lastView = useRef<ScanView | null>(null);

  const frameRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  /** The zoom as shown in the controls. Everything else reads `view`. */
  const [display, setDisplay] = useState(1);

  // Fit inside the pane, but never upscale past the file's own pixels.
  const fit =
    natural && frame.w > 0 && frame.h > 0
      ? Math.min(1, frame.w / natural.w, frame.h / natural.h)
      : 0;
  const boxW = natural ? natural.w * fit : 0;
  const boxH = natural ? natural.h * fit : 0;
  const maxScale = fit > 0 ? Math.min(MAX_CEILING, 1 / fit) : 1;
  const canZoom = maxScale > 1.02;

  // Live values for the gesture handlers, which must never close over stale ones.
  const view = useRef({ s: 1, x: 0, y: 0 });
  const geo = useRef({ frameW: 0, frameH: 0, boxW: 0, boxH: 0, max: 1 });
  const reduced = useRef(false);
  const raf = useRef<number | null>(null);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{
    t0: number;
    x0: number;
    y0: number;
    lastX: number;
    lastY: number;
    lastT: number;
    vx: number;
    vy: number;
    moved: boolean;
  } | null>(null);
  const pinch = useRef<{
    dist: number;
    s: number;
    x: number;
    y: number;
    midX: number;
    midY: number;
  } | null>(null);
  const lastTap = useRef({ t: 0, x: 0, y: 0 });

  /** Keep the sheet's edges from being dragged past the frame's. */
  const clampPan = useCallback((x: number, y: number, s: number) => {
    const g = geo.current;
    const slackX = Math.max(0, (g.boxW * s - g.frameW) / 2);
    const slackY = Math.max(0, (g.boxH * s - g.frameH) / 2);
    return { x: clamp(x, -slackX, slackX), y: clamp(y, -slackY, slackY) };
  }, []);

  /** Paint the current view, and remember it. */
  const write = useCallback(
    (glide: boolean) => {
      const layer = layerRef.current;
      if (!layer) return;
      const { s, x, y } = view.current;
      layer.style.transition =
        glide && !reduced.current ? `transform ${GLIDE_MS}ms var(--ease-crisp)` : "none";
      layer.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;

      const g = geo.current;
      if (g.frameW > 0 && g.frameH > 0) {
        const remembered = { scale: s, nx: x / g.frameW, ny: y / g.frameH };
        lastView.current = remembered;
        onView?.(remembered);
      }
      setDisplay(Math.round(s * 100) / 100);
    },
    [onView],
  );

  const stopMomentum = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  }, []);

  /** Zoom to `target`, keeping the point under (originX, originY) fixed. */
  const zoomAround = useCallback(
    (target: number, originX: number, originY: number, glide: boolean) => {
      const frameEl = frameRef.current;
      if (!frameEl) return;
      stopMomentum();

      const rect = frameEl.getBoundingClientRect();
      const cx = originX - (rect.left + rect.width / 2);
      const cy = originY - (rect.top + rect.height / 2);

      const from = view.current;
      let next = clamp(target, 1, geo.current.max);
      if (next < 1.001) next = 1;
      const ratio = next / from.s;

      const pan =
        next === 1
          ? { x: 0, y: 0 }
          : clampPan(cx - (cx - from.x) * ratio, cy - (cy - from.y) * ratio, next);
      view.current = { s: next, x: pan.x, y: pan.y };
      write(glide);
    },
    [clampPan, stopMomentum, write],
  );

  const zoomCentre = useCallback(
    (target: number, glide: boolean) => {
      const rect = frameRef.current?.getBoundingClientRect();
      if (!rect) return;
      zoomAround(target, rect.left + rect.width / 2, rect.top + rect.height / 2, glide);
    },
    [zoomAround],
  );

  const panBy = useCallback(
    (dx: number, dy: number, glide: boolean) => {
      stopMomentum();
      const { s, x, y } = view.current;
      if (s <= 1) return;
      const pan = clampPan(x + dx, y + dy, s);
      view.current = { s, x: pan.x, y: pan.y };
      write(glide);
    },
    [clampPan, stopMomentum, write],
  );

  /** Carry a released drag forward and let it settle. */
  const glideOut = useCallback(
    (startVx: number, startVy: number) => {
      if (reduced.current) return;
      let vx = startVx;
      let vy = startVy;
      let last = performance.now();

      const tick = (now: number) => {
        const dt = Math.min(32, now - last);
        last = now;
        const decay = Math.exp(-dt / 240);
        vx *= decay;
        vy *= decay;

        const { s, x, y } = view.current;
        const pan = clampPan(x + vx * dt, y + vy * dt, s);
        // Hitting an edge kills that axis, so the sheet stops instead of
        // sliding along the wall.
        if (pan.x === x) vx = 0;
        if (pan.y === y) vy = 0;
        view.current = { s, x: pan.x, y: pan.y };
        write(false);

        raf.current = Math.hypot(vx, vy) > 0.02 ? requestAnimationFrame(tick) : null;
      };
      raf.current = requestAnimationFrame(tick);
    },
    [clampPan, write],
  );

  const showFit = useCallback(() => zoomCentre(1, true), [zoomCentre]);

  // Track the pane's size — it changes when the left rail collapses, the
  // window is dragged, or a phone rotates.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setFrame({ w: Math.round(width), h: Math.round(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reduced.current = query.matches;
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => stopMomentum, [stopMomentum]);

  // Whenever the geometry settles or changes, re-derive the view from the
  // remembered fractions. This is what restores a position after a tab flip,
  // and keeps it in the same place on the sheet when the pane resizes.
  useLayoutEffect(() => {
    geo.current = { frameW: frame.w, frameH: frame.h, boxW, boxH, max: maxScale };
    if (boxW <= 0) return;
    const saved = readView ? readView() : lastView.current;
    const s = saved ? clamp(saved.scale, 1, maxScale) : 1;
    const pan =
      s <= 1 || !saved
        ? { x: 0, y: 0 }
        : clampPan(saved.nx * frame.w, saved.ny * frame.h, s);
    view.current = { s, x: pan.x, y: pan.y };
    write(false);
  }, [frame.w, frame.h, boxW, boxH, maxScale, readView, clampPan, write]);

  // A cached image can finish loading before React attaches `onLoad`.
  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) {
      setNatural({ w: image.naturalWidth, h: image.naturalHeight });
    }
  }, [src]);

  // ⌘/ctrl + wheel zooms (a trackpad pinch arrives as exactly this); a bare
  // wheel pans once zoomed and is otherwise left alone. Native and
  // non-passive so `preventDefault` really stops the page zooming.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;

    const onWheel = (event: WheelEvent) => {
      const unit = event.deltaMode === 1 ? 16 : 1;
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const notch = Math.abs(event.deltaY * unit) >= 50;
        const factor = Math.exp(-event.deltaY * unit * 0.0025);
        zoomAround(view.current.s * factor, event.clientX, event.clientY, notch);
      } else if (view.current.s > 1) {
        event.preventDefault();
        panBy(-event.deltaX * unit, -event.deltaY * unit, false);
      }
    };

    // Safari sends a trackpad (and iOS two-finger) pinch as its own
    // `gesture*` events, with no ctrl+wheel at all, so the wheel path above
    // never sees it. `scale` is relative to where the gesture began.
    // WebKit only — other browsers never fire these, which is fine.
    type WebKitGesture = Event & { scale: number; clientX: number; clientY: number };
    let gestureStart = 1;
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      stopMomentum();
      gestureStart = view.current.s;
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const g = event as WebKitGesture;
      zoomAround(gestureStart * g.scale, g.clientX, g.clientY, false);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGestureStart);
    el.addEventListener("gesturechange", onGestureChange);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
    };
  }, [zoomAround, panBy, stopMomentum]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    stopMomentum();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        s: view.current.s,
        x: view.current.x,
        y: view.current.y,
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
      };
      drag.current = null;
      return;
    }

    const now = performance.now();
    drag.current = {
      t0: now,
      x0: event.clientX,
      y0: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      lastT: now,
      vx: 0,
      vy: 0,
      moved: false,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    // Two fingers: zoom from their separation and follow their midpoint, so a
    // pinch also pans and the point between the fingers stays put.
    if (pointers.current.size === 2 && pinch.current) {
      const rect = frameRef.current?.getBoundingClientRect();
      if (!rect) return;
      const [a, b] = [...pointers.current.values()];
      const start = pinch.current;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const next = clamp((dist / start.dist) * start.s, 1, geo.current.max);

      const centreX = rect.left + rect.width / 2;
      const centreY = rect.top + rect.height / 2;
      const px = (start.midX - centreX - start.x) / start.s;
      const py = (start.midY - centreY - start.y) / start.s;
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;

      const pan =
        next <= 1.001
          ? { x: 0, y: 0 }
          : clampPan(midX - centreX - px * next, midY - centreY - py * next, next);
      view.current = { s: next <= 1.001 ? 1 : next, x: pan.x, y: pan.y };
      write(false);
      return;
    }

    const g = drag.current;
    if (!g) return;

    const now = performance.now();
    const dx = event.clientX - g.lastX;
    const dy = event.clientY - g.lastY;

    if (!g.moved && Math.hypot(event.clientX - g.x0, event.clientY - g.y0) > 6) {
      g.moved = true;
      // Capture only once it is really a drag, so a plain tap still reaches a
      // figure box underneath instead of being swallowed by the frame.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // The pointer may already be gone; the drag simply ends.
      }
    }

    if (g.moved && view.current.s > 1) {
      panBy(dx, dy, false);
      const dt = Math.max(1, now - g.lastT);
      g.vx = g.vx * 0.5 + (dx / dt) * 0.5;
      g.vy = g.vy * 0.5 + (dy / dt) * 0.5;
    }
    g.lastX = event.clientX;
    g.lastY = event.clientY;
    g.lastT = now;
  };

  const endPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);

    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null;
      // One finger lifted from a pinch: the other is not a tap or a fling.
      drag.current = null;
      return;
    }

    const g = drag.current;
    drag.current = null;
    if (!g || event.type === "pointercancel") return;

    const now = performance.now();

    if (g.moved) {
      // Only carry momentum if the finger was still moving as it lifted.
      if (view.current.s > 1 && now - g.lastT < 80) glideOut(g.vx, g.vy);
      return;
    }

    if (now - g.t0 > 350) return;

    // A tap. Two close together is a double-tap: in on the point, or back out.
    const prev = lastTap.current;
    const near = Math.hypot(event.clientX - prev.x, event.clientY - prev.y) < 30;
    if (now - prev.t < 300 && near) {
      lastTap.current = { t: 0, x: 0, y: 0 };
      if (canZoom) {
        zoomAround(
          view.current.s > 1.05 ? 1 : Math.min(geo.current.max, TAP_ZOOM),
          event.clientX,
          event.clientY,
          true,
        );
      }
    } else {
      lastTap.current = { t: now, x: event.clientX, y: event.clientY };
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!canZoom) return;
    switch (event.key) {
      case "+":
      case "=":
        event.preventDefault();
        zoomCentre(view.current.s * 1.25, true);
        break;
      case "-":
      case "_":
        event.preventDefault();
        zoomCentre(view.current.s / 1.25, true);
        break;
      case "0":
        event.preventDefault();
        showFit();
        break;
      case "ArrowLeft":
      case "ArrowRight":
      case "ArrowUp":
      case "ArrowDown": {
        if (view.current.s <= 1) return;
        event.preventDefault();
        const step = 80;
        panBy(
          event.key === "ArrowLeft" ? step : event.key === "ArrowRight" ? -step : 0,
          event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0,
          true,
        );
        break;
      }
    }
  };

  const isZoomed = display > 1.01;

  return (
    <div className={cn("flex h-full min-h-0 w-full flex-col", className)}>
      <div
        ref={frameRef}
        tabIndex={canZoom ? 0 : undefined}
        role={canZoom ? "group" : undefined}
        aria-label={canZoom ? `${alt}. Pinch, or use plus and minus, to zoom.` : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={(event) => {
          // A mouse that leaves before a drag has begun is never captured, so
          // its pointer-up would go unseen and the pointer would stay
          // registered — and the next click would then read as a two-finger
          // pinch. Touch pointers are captured implicitly and never leave.
          if (event.pointerType === "mouse" && !event.currentTarget.hasPointerCapture(event.pointerId)) {
            pointers.current.delete(event.pointerId);
            drag.current = null;
          }
        }}
        onKeyDown={onKeyDown}
        className={cn(
          "relative grid min-h-0 flex-1 place-items-center overflow-hidden rounded-md border bg-card",
          // The frame owns every gesture: there is no page scroll to fight, and
          // `none` is what stops the browser pinch-zooming the whole app.
          "touch-none select-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
          canZoom && (isZoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"),
        )}
      >
        {!natural && (
          <span className="absolute inset-0 flex animate-pulse items-center justify-center bg-secondary/60 text-[0.75rem] text-muted-foreground">
            Loading the scan…
          </span>
        )}

        <div
          ref={layerRef}
          // Sized to the fitted sheet, so the figure overlay (page-relative
          // fractions) lines up with the print at every zoom.
          style={
            natural
              ? { width: boxW, height: boxH }
              : { width: "100%", height: "100%", visibility: "hidden" }
          }
          className="relative will-change-transform"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={src}
            alt={alt}
            className="block h-full w-full object-contain select-none"
            draggable={false}
            decoding="async"
            onLoad={(event) => {
              const image = event.currentTarget;
              setNatural({ w: image.naturalWidth, h: image.naturalHeight });
              onLoad?.(event);
            }}
            onError={onError}
          />
          {natural && overlay}
        </div>
      </div>

      {canZoom && (
        <ZoomBar
          scale={display}
          max={maxScale}
          onScale={(next) => zoomCentre(next, false)}
          onStep={(direction) => zoomCentre(view.current.s * (direction > 0 ? STEP : 1 / STEP), true)}
          onFit={showFit}
        />
      )}
    </div>
  );
}

/**
 * Zoom controls, always under the sheet: − · slider · + · current zoom.
 *
 * The slider is logarithmic (`t = ln(scale) / ln(max)`), so equal drags feel
 * like equal magnification changes — a linear one spends its whole first half
 * on a barely visible 1×→2×. The percentage doubles as the way back: tapping it
 * fits the page. Every target is 44px, no exceptions, and the bar clears the
 * phone's home indicator.
 */
function ZoomBar({
  scale,
  max,
  onScale,
  onStep,
  onFit,
}: {
  scale: number;
  max: number;
  onScale: (scale: number) => void;
  onStep: (direction: 1 | -1) => void;
  onFit: () => void;
}) {
  const span = Math.log(max);
  const t = span > 0 ? clamp(Math.log(scale) / span, 0, 1) : 0;
  const percent = Math.round(scale * 100);
  const isZoomed = scale > 1.01;

  return (
    <div className="pb-safe flex items-center gap-1 pt-1.5">
      <BarButton label="Zoom out" onClick={() => onStep(-1)} disabled={!isZoomed}>
        <Minus className="h-4 w-4" aria-hidden />
      </BarButton>
      <input
        type="range"
        min={0}
        max={1}
        step="any"
        value={t}
        onChange={(event) => onScale(Math.exp(Number(event.target.value) * span))}
        aria-label="Zoom"
        aria-valuetext={`${percent} percent`}
        className="zoom-range min-w-0 flex-1"
        style={{ "--pos": `${t * 100}%` } as CSSProperties}
      />
      <BarButton label="Zoom in" onClick={() => onStep(1)} disabled={scale >= max - 0.01}>
        <Plus className="h-4 w-4" aria-hidden />
      </BarButton>
      <button
        type="button"
        onClick={onFit}
        disabled={!isZoomed}
        aria-label={isZoomed ? `Zoom ${percent} percent. Fit the whole page` : "Page fits the screen"}
        className={cn(
          "numeric h-11 min-w-[3.5rem] shrink-0 rounded-md px-2 text-[0.75rem] tabular-nums",
          "transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
          isZoomed
            ? "text-[var(--accent)] hover:bg-secondary active:bg-secondary"
            : "text-muted-foreground",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
        )}
      >
        {isZoomed ? `${percent}%` : "Fit"}
      </button>
    </div>
  );
}

/** A zoom control. 44px square — the hard tap-target floor, no exceptions. */
function BarButton({
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
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-card",
        "text-foreground transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
        "hover:enabled:border-[var(--accent)]/60 hover:enabled:bg-secondary",
        "active:enabled:bg-secondary",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        "focus-visible:outline-[var(--accent)] disabled:opacity-40",
      )}
    >
      {children}
    </button>
  );
}
