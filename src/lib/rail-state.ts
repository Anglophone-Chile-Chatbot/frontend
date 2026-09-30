/**
 * Where the left rail's open/collapsed choice lives, shared by the layout's
 * pre-paint script and `use-rail-collapsed.ts` so the two cannot drift.
 *
 * The choice is written to `<html data-rail="collapsed">` *before first paint*
 * and the column widths are CSS variables keyed off that attribute
 * (`globals.css`). That is what stops a reader who collapsed the rail from
 * seeing it snap open, then animate shut, on every load.
 */
export const RAIL_STORAGE_KEY = "anglophone-chile:rail";
export const RAIL_EVENT = "anglophone-chile:rail-change";

/** Runs in `<head>` before paint. Storage may be blocked, so it is wrapped. */
export const RAIL_BOOT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(
  RAIL_STORAGE_KEY,
)})==="collapsed")document.documentElement.dataset.rail="collapsed"}catch(e){}`;
