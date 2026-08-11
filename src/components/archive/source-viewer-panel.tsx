"use client";

import { BookOpen, X } from "lucide-react";

import { useSourcePage } from "@/hooks/use-source-page";
import type { ChatSource } from "@/lib/api/types";
import { formatIssueDate } from "@/lib/citations";
import { cn } from "@/lib/utils";

import { SourceViewerBody } from "./source-viewer-body";

/**
 * The desktop docked document panel — Kotaemon's structure: a standing
 * third column that shows whichever page a citation was last opened for,
 * rather than a sheet that covers the transcript.
 *
 * `lg`-and-up only. `SourceViewer` (the mobile sheet) keeps the sub-`lg`
 * behaviour unchanged and hides itself once this panel takes over, so only
 * one is ever visible. Both share `useSourcePage` + `SourceViewerBody`, so
 * there is exactly one fetch/render path, not two implementations to drift.
 */
export function SourceViewerPanel({
  source,
  passage,
  onClose,
}: {
  /** The page to show; `null` renders the panel's empty state. */
  source: ChatSource | null;
  passage?: string | null;
  onClose: () => void;
}) {
  const { page, status, tab, setTab } = useSourcePage(source);

  const dateline = page ? formatIssueDate(page.issue_date) : null;
  const publication = page?.publication ?? source?.publication ?? null;

  return (
    <aside className="rule-l bg-card-answer hidden w-[min(26rem,32vw)] shrink-0 flex-col lg:flex">
      {source === null ? (
        <PanelEmptyState />
      ) : (
        <>
          <div className="rule-b flex items-start justify-between gap-2 px-5 pt-4 pb-3">
            <div className="min-w-0">
              <p className="font-heading truncate text-[1.0625rem] leading-snug text-foreground">
                {publication ?? "Unidentified publication"}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8125rem] text-muted-foreground">
                {dateline && <time className="numeric">{dateline}</time>}
                {dateline && <span aria-hidden>·</span>}
                <span className="numeric">
                  Page {source.page_number ?? page?.page_number}
                  {page ? ` of ${page.document_page_count}` : ""}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close the document panel"
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                "text-muted-foreground transition-colors duration-[120ms]",
                "ease-[var(--ease-crisp)] hover:bg-secondary hover:text-foreground",
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <SourceViewerBody
            status={status}
            page={page}
            tab={tab}
            onTabChange={setTab}
            passage={passage ?? null}
          />
        </>
      )}
    </aside>
  );
}

function PanelEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-6 text-center">
      <BookOpen className="h-5 w-5 text-muted-foreground/60" aria-hidden />
      <p className="measure text-[0.8125rem] leading-relaxed text-muted-foreground">
        Tap a citation number to read the original page here.
      </p>
    </div>
  );
}
