"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A tab row whose active rule slides between tabs instead of snapping.
 *
 * **Why this exists.** An audit of the live reader on 2026-09-04 found that of
 * 155 elements on the page, 17 carried any CSS transition at all — and *every
 * one of them was a colour or border-colour hover*. There was not one
 * transform, opacity or layout transition in the entire reader. Switching Read
 * → Scans, or Text → Scan, repainted the underline in a different place
 * between two frames with nothing connecting them, which is exactly the "no
 * animation smoothness at all" complaint.
 *
 * Both tab rows in the reader (`Read/Scans/Figures` and `Text/Scan`) hard-coded
 * `border-b-2` per button, so the rule was a property of whichever button
 * happened to be selected and could not animate between them. Here the rule is
 * **one absolutely-positioned element** owned by the rail, moved by
 * `transform` — so there is a single thing travelling between two positions,
 * which is the only way this transition can exist at all.
 *
 * Motion budget, per the design language: 160ms on `--ease-crisp`, transform
 * and opacity only, and `prefers-reduced-motion` collapses it to an instant
 * move via the global reduce rule in `globals.css`.
 */
export function TabRail<T extends string>({
  items,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  items: {
    id: T;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    /** Shown after the label — a page or plate count. */
    count?: number | null;
    /** Dims the tab without disabling it (a scan-less page). */
    muted?: boolean;
  }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<T, HTMLButtonElement>());
  const [rule, setRule] = useState<{ left: number; width: number } | null>(null);

  // Measure in a layout effect so the rule is never painted at a stale
  // position for a frame after the tabs reflow.
  useLayoutEffect(() => {
    const rail = railRef.current;
    const tab = tabRefs.current.get(value);
    if (!rail || !tab) return;
    const railBox = rail.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    setRule({ left: tabBox.left - railBox.left, width: tabBox.width });
  }, [value, items]);

  // Tabs are flex-1, so their widths change with the container. Without this
  // the rule keeps a stale width after a rotation or a window drag.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const observer = new ResizeObserver(() => {
      const tab = tabRefs.current.get(value);
      if (!tab) return;
      const railBox = rail.getBoundingClientRect();
      const tabBox = tab.getBoundingClientRect();
      setRule({ left: tabBox.left - railBox.left, width: tabBox.width });
    });
    observer.observe(rail);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div
      ref={railRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn("relative flex", className)}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = value === item.id;
        return (
          <button
            key={item.id}
            ref={(node) => {
              if (node) tabRefs.current.set(item.id, node);
              else tabRefs.current.delete(item.id);
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={cn(
              // 44px — the hard tap-target floor.
              "flex min-h-[44px] flex-1 items-center justify-center gap-1.5",
              "text-[0.8125rem] font-medium",
              "transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
              "focus-visible:outline-2 focus-visible:-outline-offset-2",
              "focus-visible:outline-[var(--accent)]",
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              item.muted && "opacity-55",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
            {item.label}
            {item.count !== null && item.count !== undefined && (
              <span className="numeric text-[0.6875rem] text-muted-foreground">
                {item.count}
              </span>
            )}
          </button>
        );
      })}

      {/* The travelling rule. `width` is animated alongside the transform
          because the tabs are not equal widths — a transform-only version
          would need a scale, which would visibly stretch the rule's ends. */}
      {rule && (
        <span
          aria-hidden
          className="absolute bottom-0 h-[2px] bg-[var(--accent)]"
          style={{
            transform: `translate3d(${rule.left}px, 0, 0)`,
            width: rule.width,
            transition:
              "transform 160ms var(--ease-crisp), width 160ms var(--ease-crisp)",
          }}
        />
      )}
    </div>
  );
}
