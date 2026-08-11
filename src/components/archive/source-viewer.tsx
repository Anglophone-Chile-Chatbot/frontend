"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSourcePage } from "@/hooks/use-source-page";
import type { ChatSource } from "@/lib/api/types";
import { formatIssueDate } from "@/lib/citations";
import { cn } from "@/lib/utils";

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
  onOpenChange,
}: {
  /** The page to show; `null` closes the viewer. */
  source: ChatSource | null;
  /** Cited chunk text, highlighted within the page when found. */
  passage?: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { page, status, tab, setTab } = useSourcePage(source);

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
          "h-[85dvh] rounded-t-xl p-0",
          // From sm up it becomes a right-hand reading panel.
          "sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:w-[min(30rem,90vw)]",
          "sm:max-w-none sm:rounded-none sm:border-l",
        )}
      >
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
        </SheetHeader>

        <SourceViewerBody
          status={status}
          page={page}
          tab={tab}
          onTabChange={setTab}
          passage={passage ?? null}
        />
      </SheetContent>
    </Sheet>
  );
}
