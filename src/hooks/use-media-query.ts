"use client";

import { useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query from React state.
 *
 * Exists because a few behaviours cannot be expressed as a `lg:hidden` class:
 * the document viewer renders a `Sheet` below `lg` and a docked panel above it,
 * and the sheet's backdrop is portalled outside the element a responsive class
 * would hide. Hiding content while leaving the backdrop mounted blurred the
 * entire page behind a sharp panel (fixed 2026-08-11) — so the breakpoint has
 * to gate *mounting*, which means it has to be a value, not a class.
 *
 * `useSyncExternalStore` rather than `useEffect` + `useState`: it is the API
 * built for external mutable sources, it subscribes before paint (so there is
 * no flash of the wrong branch), and it takes an explicit server snapshot.
 * That server value is `false`, i.e. SSR always renders the mobile branch —
 * correct by default here, since the mobile sheet is closed at rest and the
 * desktop panel is what a hydration mismatch would visibly tear.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    // No `window` during SSR or static prerender.
    () => false,
  );
}
