"use client";

import { useRef } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSourcePage } from "@/hooks/use-source-page";
import type { ViewerSource } from "@/lib/api/types";
import { formatIssueDate } from "@/lib/citations";
import { cn } from "@/lib/utils";

import { ReadIssueLink } from "./read-issue-link";
import { SourceViewerBody } from "./source-viewer-body";

/**
 * The mobile/tablet document viewer.
 *
 * Opens when a citation chip or search result is tapped, showing the cited
 * page's extracted text with the cited passage highlighted and scrolled into
 * view. Per CLAUDE.md, text is the default view on mobile and the scan image
 * is one tap away.
 *
 * A bottom sheet below `sm`, a right-hand overlay panel from `sm` to `lg`.
 * From `lg` up, `SourceViewerPanel` takes over as a permanently docked
 * column instead — this component hides itself there so the two never show
 * at once. Both render the same `SourceViewerBody` from the same
 * `useSourcePage` fetch, so behaviour can't drift between breakpoints.
 */
export function SourceViewer({
  source,
  passage,
  query,
  terms,
  openNonce,
  onOpenChange,
}: {
  /** The page to show; `null` closes the viewer. */
  source: ViewerSource | null;
  /** Cited chunk text, highlighted within the page when found. */
  passage?: string | null;
  /** The reader's search term, carried into the issue by `ReadIssueLink`. */
  query?: string;
  /** Active search terms to highlight within the passage. */
  terms?: string[];
  /** Changes on every citation open; resets the remembered zoom and scroll. */
  openNonce?: number;
  onOpenChange: (open: boolean) => void;
}) {
  const { page, status, tab, setTab } = useSourcePage(source, openNonce);

  const dateline = page ? formatIssueDate(page.issue_date) : null;
  const publication = page?.publication ?? source?.publication ?? null;

  // Below `lg` only. `SourceViewerPanel` owns the docked column from `lg` up,
  // and both are rendered by the same parent off the same `active` state.
  //
  // This gate is on `open`, not on a `lg:hidden` class, and that distinction is
  // load-bearing: the class hides the sheet's *content*, but its backdrop is a
  // separate portalled element with no such class. Left open on desktop it sat
  // full-screen at z-50 applying `backdrop-blur-xs` over the whole app — the
  // page appeared permanently blurred behind a perfectly sharp panel, which
  // reads as a broken browser rather than a stuck overlay (reported 2026-08-11).
  const isDesktop = useMediaQuery("(min-width: 64rem)");

  return (
    <Sheet open={source !== null && !isDesktop} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          // The `data-[side=bottom]:` prefix is load-bearing: the sheet's own
          // `data-[side=bottom]:h-auto` outranks a plain `h-[85dvh]`, so
          // without it the phone sheet grew to the height of its content
          // (measured 8,804px on a long page) and ran off the top of the
          // screen with the tabs and header out of reach.
          "data-[side=bottom]:h-[85dvh] gap-0 rounded-t-xl p-0",
          "sm:data-[side=bottom]:h-auto",
          // From sm up it becomes a right-hand reading panel.
          "sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:w-[min(30rem,90vw)]",
          "sm:max-w-none sm:rounded-none sm:border-l",
        )}
      >
        <SheetGrip onDismiss={() => onOpenChange(false)} />
        <SheetHeader className="rule-b gap-1 px-4 pt-4 pb-3 sm:px-5">
          <SheetTitle className="text-[1.0625rem] leading-snug">
            {publication ?? "Unidentified publication"}
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8125rem]">
            {dateline && <time className="numeric">{dateline}</time>}
            {dateline && <span aria-hidden>·</span>}
            <span className="numeric">
              Page {source?.page_number ?? page?.page_number}
              {page ? ` of ${page.document_page_count}` : ""}
            </span>
          </SheetDescription>
          {/* Rendered off the fetched page rather than off `source`, so the
              link cannot appear before the issue it points at is known. */}
          {page && (
            <ReadIssueLink
              documentId={page.document_id}
              pageNumber={page.page_number}
              query={query}
              className="-mt-1"
            />
          )}
        </SheetHeader>

        <SourceViewerBody
          status={status}
          page={page}
          tab={tab}
          onTabChange={setTab}
          passage={passage ?? null}
          terms={terms}
          openNonce={openNonce}
        />
      </SheetContent>
    </Sheet>
  );
}

/**
 * The bottom sheet's grab bar: drag it down to dismiss, the way every phone
 * sheet works. The sheet follows the finger 1:1 (no transition while dragging),
 * then either flies off or springs back depending on distance and speed.
 * Below `sm` only — from `sm` the viewer is a right-hand panel with nothing to
 * drag. The strip is 28px tall and sits over the header's top padding, so it
 * costs no layout.
 */
function SheetGrip({ onDismiss }: { onDismiss: () => void }) {
  const start = useRef<{ y: number; t: number } | null>(null);

  const popupOf = (element: HTMLElement) =>
    element.closest<HTMLElement>('[data-slot="sheet-content"]');

  return (
    <div
      aria-hidden
      className="absolute inset-x-0 top-0 z-10 flex h-7 cursor-grab touch-none justify-center pt-2 sm:hidden"
      onPointerDown={(event) => {
        start.current = { y: event.clientY, t: performance.now() };
        event.currentTarget.setPointerCapture(event.pointerId);
        const popup = popupOf(event.currentTarget);
        if (popup) popup.style.transition = "none";
      }}
      onPointerMove={(event) => {
        if (!start.current) return;
        const popup = popupOf(event.currentTarget);
        const drop = Math.max(0, event.clientY - start.current.y);
        if (popup) popup.style.transform = `translate3d(0, ${drop}px, 0)`;
      }}
      onPointerUp={(event) => {
        const origin = start.current;
        start.current = null;
        const popup = popupOf(event.currentTarget);
        if (!origin || !popup) return;

        const drop = Math.max(0, event.clientY - origin.y);
        const speed = drop / Math.max(1, performance.now() - origin.t);
        if (drop > 120 || (drop > 40 && speed > 0.6)) {
          popup.style.transition = "transform 160ms var(--ease-exit)";
          popup.style.transform = "translate3d(0, 100%, 0)";
          window.setTimeout(onDismiss, 150);
        } else {
          popup.style.transition = "transform 180ms var(--ease-crisp)";
          popup.style.transform = "";
        }
      }}
      onPointerCancel={(event) => {
        start.current = null;
        const popup = popupOf(event.currentTarget);
        if (popup) {
          popup.style.transition = "transform 180ms var(--ease-crisp)";
          popup.style.transform = "";
        }
      }}
    >
      <span className="h-1 w-10 rounded-full bg-[var(--rule-strong)]/40" />
    </div>
  );
}
