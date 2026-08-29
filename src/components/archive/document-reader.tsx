"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { SourceViewerBody } from "@/components/archive/source-viewer-body";
import {
  useDocumentReader,
  usePagePrefetch,
} from "@/hooks/use-document-reader";
import { useSourcePage } from "@/hooks/use-source-page";
import type { DocumentPageSummary, ViewerSource } from "@/lib/api/types";
import { formatIssueDate } from "@/lib/citations";
import { cn } from "@/lib/utils";

/**
 * The document reader — read one issue end to end, page by page.
 *
 * This is the container the archive was missing. Every page-level piece it
 * needs already existed and is reused verbatim: `SourceViewerBody` renders the
 * text, the inline figures, the scan and its figure overlay, and the honest
 * empty note for a blank page; `useSourcePage` fetches the page. Neither was
 * forked or modified. What is new here is only the *chrome around them* —
 * knowing an issue has 16 pages, which one is open, and how to reach the next.
 *
 * Composition rather than a second viewer is the point. Before this, the
 * viewer rendered "Page 5 of 8" and offered no way to reach page 6, so the
 * count was an advertisement for a capability the product did not have. The
 * fix is a page strip, not a new renderer.
 *
 * The URL is the state. `?page=N` is written on every turn with `replace`, so
 * a reader can share exactly what they are looking at, a citation can deep-link
 * into an issue, and the back button leaves the reader rather than walking back
 * through every page they turned.
 */
export function DocumentReader({
  documentId,
  initialPage,
}: {
  documentId: string;
  /** From `?page=`; already parsed. Null when absent or unparseable. */
  initialPage: number | null;
}) {
  const router = useRouter();
  const { document, status, pages, current, previous, next, position, goTo } =
    useDocumentReader(documentId, initialPage);

  // Warm the neighbours. Both directions, because a reader who has just gone
  // forward may well go back, and the page they came from is the single most
  // likely next request after the one ahead.
  usePagePrefetch([next?.page_id ?? null, previous?.page_id ?? null]);

  /**
   * What `SourceViewerBody` consumes, assembled from the page strip.
   *
   * `page_number` is passed through so the header reads correctly during the
   * fetch — the strip already knows which page is opening, and waiting for the
   * page body to arrive before naming it would flicker the number on every
   * turn. `chunk_id` is the page id, matching the catalogue's browse path:
   * nothing on this route resolves it back to a chunk.
   */
  const source: ViewerSource | null = current
    ? {
        chunk_id: current.page_id,
        page_id: current.page_id,
        document_id: documentId,
        page_number: current.page_number,
        publication: document?.publication ?? null,
        issue_date: document?.issue_date ?? null,
      }
    : null;

  const { page, status: pageStatus, tab, setTab } = useSourcePage(source);

  // Keep the URL in step with the page. `replace`, not `push`: a 16-page issue
  // would otherwise leave 16 history entries between the reader and wherever
  // they came from, so Back would mean "previous page" instead of "leave".
  const lastWritten = useRef<number | null>(null);
  useEffect(() => {
    if (current === null) return;
    if (lastWritten.current === current.page_number) return;
    lastWritten.current = current.page_number;
    router.replace(`/document/${documentId}?page=${current.page_number}`, {
      scroll: false,
    });
  }, [current, documentId, router]);

  const goPrevious = useCallback(() => {
    if (previous) goTo(previous.page_number);
  }, [previous, goTo]);

  const goNext = useCallback(() => {
    if (next) goTo(next.page_number);
  }, [next, goTo]);

  // Keyboard paging, desktop's natural affordance for a reader. Skipped while
  // the reader is typing (the page jump is a real input) and while a modifier
  // is held, so browser and OS shortcuts keep working.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrevious();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goPrevious, goNext]);

  if (status === "loading") return <ReaderLoading />;
  if (status === "missing") return <ReaderMissing />;
  if (status === "error") return <ReaderError />;
  if (document === null) return <ReaderError />;

  const dateline = formatIssueDate(document.issue_date);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ReaderHeader
        publication={document.publication ?? document.title}
        dateline={dateline}
        pageNumber={current?.page_number ?? null}
        pageCount={document.page_count}
      />

      {document.pages.length === 0 ? (
        <ReaderNoPages />
      ) : (
        <>
          {/* The scroll container is this element, not the page. The shell is
              `h-dvh` + `overflow-hidden`, which is what keeps the paging bar
              fixed at the bottom on mobile instead of scrolling away with the
              text — the same reason the composer stays put for the keyboard. */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
              <SourceViewerBody
                status={pageStatus}
                page={page}
                tab={tab}
                onTabChange={setTab}
                // Nothing was cited on this route, so nothing is highlighted.
                // Passing a passage here would invent an emphasis the reader
                // never asked for — the same reasoning as the catalogue path.
                passage={null}
              />
            </div>
          </div>

          <PageNavigation
            pages={pages}
            current={current}
            previous={previous}
            next={next}
            position={position}
            onGoTo={goTo}
          />
        </>
      )}
    </div>
  );
}

/**
 * The issue's masthead line, and the way back out.
 *
 * Named as a publication and a date rather than as a document id, because that
 * is what a reader is holding — one issue of one newspaper, on one day.
 */
function ReaderHeader({
  publication,
  dateline,
  pageNumber,
  pageCount,
}: {
  publication: string;
  dateline: string | null;
  pageNumber: number | null;
  pageCount: number;
}) {
  return (
    <div className="rule-b shrink-0 px-4 py-3 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/archive"
          className={cn(
            "-ml-1 inline-flex min-h-[44px] items-center gap-1 pr-2 pl-1",
            "text-[0.75rem] text-muted-foreground",
            "transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
            "hover:text-foreground",
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          Archive
        </Link>
        <h1 className="font-heading text-[1.125rem] leading-snug text-foreground sm:text-[1.375rem]">
          {publication}
        </h1>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8125rem] text-muted-foreground">
          {dateline && <time className="numeric">{dateline}</time>}
          {dateline && <span aria-hidden>·</span>}
          <span className="numeric">
            {pageNumber === null
              ? `${pageCount} ${pageCount === 1 ? "page" : "pages"}`
              : `Page ${pageNumber} of ${pageCount}`}
          </span>
        </p>
      </div>
    </div>
  );
}

/**
 * Prev / next and the page jump.
 *
 * The thing the product did not have. It sits below the page rather than above
 * it so it stays under the thumb on a phone, and it is outside the scroll
 * container so it does not scroll away mid-issue.
 *
 * Every control is ≥44px (hard rule). The jump is a `<select>` on purpose: it
 * is the one control the platform already renders as a thumb-friendly native
 * picker on iOS and Android, and a hand-built popover would be a worse version
 * of that on the surface most likely to be used on a phone.
 */
function PageNavigation({
  pages,
  current,
  previous,
  next,
  position,
  onGoTo,
}: {
  pages: DocumentPageSummary[];
  current: DocumentPageSummary | null;
  previous: DocumentPageSummary | null;
  next: DocumentPageSummary | null;
  position: number;
  onGoTo: (pageNumber: number) => void;
}) {
  return (
    <nav
      aria-label="Page navigation"
      className="rule-t bg-background/95 pb-safe shrink-0 px-4 py-2 sm:px-6 supports-[backdrop-filter]:backdrop-blur-sm"
    >
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
        <PageStepButton
          direction="previous"
          target={previous}
          onGoTo={onGoTo}
        />

        <label className="min-w-0 flex-1">
          <span className="sr-only">Jump to a page</span>
          <select
            value={current?.page_number ?? ""}
            onChange={(event) => onGoTo(Number(event.target.value))}
            className={cn(
              "min-h-[44px] w-full rounded-md border bg-card px-2 text-center",
              // 16px on mobile avoids iOS zooming the whole page on focus.
              "text-base sm:text-[0.8125rem]",
              "transition-[border-color] duration-[120ms] ease-[var(--ease-crisp)]",
              "focus-visible:border-[var(--accent)] focus-visible:outline-none",
            )}
          >
            {pages.map((page) => (
              <option key={page.page_id} value={page.page_number}>
                {pageJumpLabel(page)}
              </option>
            ))}
          </select>
        </label>

        <PageStepButton direction="next" target={next} onGoTo={onGoTo} />
      </div>

      {/* Position in the list, which is not always the printed page number —
          an issue whose ingested pages start at 3 would otherwise look like it
          was missing its beginning with no explanation. */}
      {pages.length > 0 && (
        <p className="mx-auto mt-1 w-full max-w-3xl text-center text-[0.6875rem] text-muted-foreground">
          <span className="numeric">
            {position} of {pages.length}
          </span>
          {current && !current.has_text && " · blank page"}
        </p>
      )}
    </nav>
  );
}

/**
 * How a page is described in the jump control.
 *
 * The blank marker is the load-bearing part: 9 of the 71 live pages are
 * genuinely blank scans — binding boards and endpapers — and a reader who
 * lands on one with no warning reads it as a broken page rather than as an
 * accurate transcription of a blank sheet. Saying so in the picker means they
 * arrive expecting it.
 *
 * The figure marker is the same idea pointed the other way: it tells a reader
 * looking for the pictures where they are, without opening every page.
 */
function pageJumpLabel(page: DocumentPageSummary): string {
  const marks: string[] = [];
  if (!page.has_text) marks.push("blank");
  if (page.figure_count > 0) {
    marks.push(
      page.figure_count === 1 ? "1 figure" : `${page.figure_count} figures`,
    );
  }
  return marks.length > 0
    ? `Page ${page.page_number} — ${marks.join(", ")}`
    : `Page ${page.page_number}`;
}

/**
 * One step control.
 *
 * Rendered disabled rather than hidden at the ends of an issue: a control that
 * vanishes shifts the two beside it, and the jump would jump sideways every
 * time the reader reached the first or last page.
 */
function PageStepButton({
  direction,
  target,
  onGoTo,
}: {
  direction: "previous" | "next";
  target: DocumentPageSummary | null;
  onGoTo: (pageNumber: number) => void;
}) {
  const isPrevious = direction === "previous";
  const Icon = isPrevious ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={() => target && onGoTo(target.page_number)}
      disabled={target === null}
      aria-label={
        target === null
          ? isPrevious
            ? "This is the first page"
            : "This is the last page"
          : `${isPrevious ? "Previous" : "Next"} page, page ${target.page_number}`
      }
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border",
        "bg-card text-foreground",
        "transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
        "hover:enabled:border-[var(--accent)]/60 hover:enabled:bg-secondary",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        "focus-visible:outline-[var(--accent)]",
        "disabled:opacity-40",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

function ReaderLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 items-start px-4 py-8 sm:px-6">
      <p className="flex items-center gap-2 text-[0.875rem] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Opening the issue…
      </p>
    </div>
  );
}

function ReaderMissing() {
  return (
    <ReaderNote
      title="That issue is not in the archive"
      body="The link may be old, or the issue may not have been ingested. Browse the archive to find what is there."
    />
  );
}

function ReaderError() {
  return (
    <ReaderNote
      title="This issue could not be opened"
      body="The archive service did not respond. Try again in a moment."
    />
  );
}

function ReaderNoPages() {
  return (
    <ReaderNote
      title="No pages have been ingested for this issue"
      body="The issue is listed in the archive, but its scanned pages have not been added yet."
    />
  );
}

function ReaderNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <div className="measure">
        <h1 className="font-heading text-[1.125rem] text-foreground">{title}</h1>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
          {body}
        </p>
        <Link
          href="/archive"
          className={cn(
            "mt-4 inline-flex min-h-[44px] items-center gap-1 text-[0.8125rem]",
            "text-[var(--accent)] transition-colors duration-[120ms]",
            "ease-[var(--ease-crisp)] hover:text-foreground",
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          Back to the archive
        </Link>
      </div>
    </div>
  );
}
