"use client";

import { useCallback, useSyncExternalStore } from "react";

import { RAIL_EVENT, RAIL_STORAGE_KEY } from "@/lib/rail-state";

function subscribe(onChange: () => void) {
  window.addEventListener(RAIL_EVENT, onChange);
  return () => window.removeEventListener(RAIL_EVENT, onChange);
}

const read = () => document.documentElement.dataset.rail === "collapsed";

/**
 * Whether the left rail is collapsed, remembered across visits.
 *
 * The visible width is driven by CSS off `<html data-rail>` (set before paint
 * by the layout's boot script), so this hook only has to keep React's own bits
 * — icons, `inert`, labels — in step with it. Server snapshot is `false`
 * (expanded); on hydration React re-renders with the real value.
 */
export function useRailCollapsed(): readonly [boolean, (next: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);

  const set = useCallback((next: boolean) => {
    const root = document.documentElement;
    if (next) root.dataset.rail = "collapsed";
    else delete root.dataset.rail;
    try {
      window.localStorage.setItem(RAIL_STORAGE_KEY, next ? "collapsed" : "open");
    } catch {
      // Blocked storage: the rail still collapses, it just isn't remembered.
    }
    window.dispatchEvent(new Event(RAIL_EVENT));
  }, []);

  return [collapsed, set] as const;
}
