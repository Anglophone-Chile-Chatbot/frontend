"use client";

import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Images,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { DocumentFigures } from "@/components/archive/document-figures";
import { DocumentScans } from "@/components/archive/document-scans";
import {
  DocumentSearchField,
  DocumentSearchResults,
} from "@/components/archive/document-search";
import { SourceViewerBody } from "@/components/archive/source-viewer-body";
import { TabRail } from "@/components/archive/tab-rail";
import { useDocumentFigures } from "@/hooks/use-document-figures";
import {
  useDocumentReader,
  usePagePrefetch,
} from "@/hooks/use-document-reader";
import {
  useDocumentSearch,
  type DocumentSearchStatus,
} from "@/hooks/use-document-search";
import { useSourcePage } from "@/hooks/use-source-page";
import type { DocumentPageSummary, ViewerSource } from "@/lib/api/types";
import { formatIssueDate } from "@/lib/citations";
import { cn } from "@/lib/utils";

/**
 * The document reader — read one issue end to end, see all of it, search it.
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
 * **CHUNK 3 gave the issue two more ways to be looked at and one way to be
 * questioned.** A newspaper is not only a sequence of pages to be read in
 * order: a historian scanning for engravings, or for how an issue was laid
 * out, wants to *see* the whole thing at once, and one who already knows what
 * they are looking for wants to ask where it is. So the reader now has three
 * views of the same issue —
 *
 * - **Read** — one page at a time, unchanged, still `SourceViewerBody`.
 * - **Scans** — every sheet as a grid (`DocumentScans`).
 * - **Figures** — every crop in the issue (`DocumentFigures`).
 *
 * — over a search box scoped to this issue alone (`DocumentSearch`), whose
 * hits mark pages in all three.
 *
 * The URL is the state. `?page=N&q=term` is written on every turn with
 * `replace`, so a reader can share exactly what they are looking at, a citation
 * can deep-link into an issue, the search term survives navigation and refresh,
 * and the back button leaves the reader rather than walking back through every
 * page they turned.
 */

/**
 * The one thing the reader is looking at.
 *
 * **This used to be two independent states and that was the "UI/UX massive
 * confusion" Shakib reported (2026-09-04).** There was a `view` of
 * `read | scans | figures` in one tab row, and a *separate* `tab` of
 * `text | image` in a second row stacked directly beneath it — five controls
 * across two rows for what are really three destinations.
 *
 * The collision was concrete, not stylistic: row 1 offered **"Scans"** and row
 * 2 offered **"Scan"**, one word apart, ~100px vertically apart, and they
 * served *the identical image URL* — verified live, `/pages/c9420422…/image`
 * came back from both the grid's third tile and the Scan tab. No reader can be
 * expected to distinguish those by name.
 *
 * So the two axes are now one. `text | scan | plates` are the three ways to
 * look at the page you are on; the all-sheets grid is *navigation*, not a
 * view, and moved to an "All sheets" link in the header where it belongs.
 */
type ReaderView = "text" | "scan" | "plates";

export function DocumentReader({
  documentId,
  initialPage,
  initialQuery,
}: {
  documentId: string;
  /** From `?page=`; already parsed. Null when absent or unparseable. */
  initialPage: number | null;
  /** From `?q=`; already parsed. Empty when absent. */
  initialQuery: string;
}) {
  const router = useRouter();
  const { document, status, pages, current, previous, next, position, goTo } =
    useDocumentReader(documentId, initialPage);

  const [view, setView] = useState<ReaderView>("text");
  /** The all-sheets grid, now an overlay off the header rather than a tab. */
  const [sheetsOpen, setSheetsOpen] = useState(false);

  const search = useDocumentSearch(documentId);
  const { setQuery } = search;

  // Seed the box from the URL exactly once per issue, so a reader arriving
  // from a search or a shared link finds their term already there and the
  // matching pages already marked. Not a controlled mirror of the prop: the
  // reader types into this box, and re-seeding on every render would fight
  // them for the caret.
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (seededFor.current === documentId) return;
    seededFor.current = documentId;
    if (initialQuery.length > 0) setQuery(initialQuery);
  }, [documentId, initialQuery, setQuery]);

  // Figures are only gathered once the reader asks for them — the sweep is one
  // request per page carrying figures, and firing it on every issue that is
  // merely opened would spend the rate limit on a tab nobody looked at.
  const figures = useDocumentFigures(pages, view === "plates");

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

  const { page, status: pageStatus, setTab } = useSourcePage(source);

  // `SourceViewerBody` still takes a text/image tab, because the mobile sheet
  // and the docked desktop panel share it and are not part of this change. The
  // reader drives it from the merged view instead of owning a second state, so
  // there is exactly one source of truth for what is on screen.
  useEffect(() => {
    if (view === "text") setTab("text");
    if (view === "scan") setTab("image");
  }, [view, setTab]);

  /**
   * The passage to highlight on the open page, when the reader's own search
   * put them there.
   *
   * This is 3e-3's second half, and it deliberately reuses the existing
   * `passage-match` ladder rather than introducing a term matcher of its own.
   * `SourceViewerBody` already takes a `passage` and locates it through
   * `findPassage`, which climbs from exact substring down to an approximate
   * leading anchor because the stored chunk is not a copy of the page. Feeding
   * the matched chunk's text through that same path means a search highlight
   * and a citation highlight are literally the same mechanism — a second
   * matcher is how the two drift and one silently gets weaker.
   *
   * Null when the current page did not match, so a reader paging away from a
   * hit sees the highlight disappear rather than a stale mark on a page that
   * has nothing to do with their term.
   */
  const passage = search.passageFor(current?.page_number ?? null);

  /** True on the two views that show one page — where paging makes sense. */
  const isPageView = view === "text" || view === "scan";

  // Keep the URL in step with the page and the query. `replace`, not `push`: a
  // 16-page issue would otherwise leave 16 history entries between the reader
  // and wherever they came from, so Back would mean "previous page" instead of
  // "leave" — and a search box would add one entry per keystroke.
  const lastWritten = useRef<string | null>(null);
  useEffect(() => {
    if (current === null) return;

    const params = new URLSearchParams({ page: String(current.page_number) });
    // The *matched* term, not the one being typed: writing every keystroke
    // would put half-words in the address bar and in anything shared from it.
    if (search.matched.length > 0) params.set("q", search.matched);

    const url = `/document/${documentId}?${params}`;
    if (lastWritten.current === url) return;
    lastWritten.current = url;
    router.replace(url, { scroll: false });
  }, [current, documentId, router, search.matched]);

  const goPrevious = useCallback(() => {
    if (previous) goTo(previous.page_number);
  }, [previous, goTo]);

  const goNext = useCallback(() => {
    if (next) goTo(next.page_number);
  }, [next, goTo]);

  /**
   * Open a page from the scan grid, the figure gallery or a search hit.
   *
   * All three are "take me to this sheet", so all three land on the Read view
   * — leaving the reader in a grid after they asked for a page would be a
   * control that appears to do nothing.
   */
  const openPage = useCallback(
    (pageNumber: number) => {
      goTo(pageNumber);
      setView("text");
      setSheetsOpen(false);
    },
    [goTo],
  );

  // Keyboard paging, desktop's natural affordance for a reader. Skipped while
  // the reader is typing (the page jump and the search box are real inputs)
  // and while a modifier is held, so browser and OS shortcuts keep working.
  // Only on the Read view: in a grid the arrow keys are the browser's own
  // scroll, and stealing them would trap the reader mid-page.
  useEffect(() => {
    if (!isPageView) return;

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
  }, [goPrevious, goNext, isPageView]);

  if (status === "loading") return <ReaderLoading />;
  if (status === "missing") return <ReaderMissing />;
  if (status === "error") return <ReaderError />;
  if (document === null) return <ReaderError />;

  const dateline = formatIssueDate(document.issue_date);
  const figureTotal = pages.reduce((sum, entry) => sum + entry.figure_count, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ReaderHeader
        publication={document.publication ?? document.title}
        dateline={dateline}
        editionLabel={document.edition_label}
        pageNumber={isPageView ? (current?.page_number ?? null) : null}
        pageCount={document.page_count}
        query={search.query}
        onQueryChange={search.setQuery}
        onClearQuery={search.reset}
        searchStatus={search.status}
        onOpenSheets={() => setSheetsOpen(true)}
      />

      {document.pages.length === 0 ? (
        <ReaderNoPages />
      ) : (
        <>
          <ViewSwitch view={view} onChange={setView} figureTotal={figureTotal} />

          {/* Results only occupy space once there is something to report. The
              box itself lives in the header and collapses when unused. */}
          <SearchResultsBar
            search={search}
            currentPageNumber={isPageView ? (current?.page_number ?? null) : null}
            onGoTo={openPage}
          />

          {/* The scroll container is this element, not the page. The shell is
              `h-dvh` + `overflow-hidden`, which is what keeps the paging bar
              fixed at the bottom on mobile instead of scrolling away with the
              text — the same reason the composer stays put for the keyboard.
              `relative` is load-bearing: `FigureLightbox` and the sheets
              overlay are `absolute inset-0` and need a positioned ancestor, or
              they would escape to the viewport and cover the header. */}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            {isPageView && (
              <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
                <SourceViewerBody
                  status={pageStatus}
                  page={page}
                  // The tab row above is now the only view control, so the
                  // body's own Text/Scan switch is suppressed — showing it
                  // again here is precisely the duplicated row this change
                  // exists to remove.
                  showTabs={false}
                  tab={view === "scan" ? "image" : "text"}
                  onTabChange={setTab}
                  passage={passage}
                />
              </div>
            )}

            {view === "plates" && (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="mx-auto w-full max-w-3xl">
                  <DocumentFigures
                    figures={figures.figures}
                    status={figures.status}
                    onOpenPage={openPage}
                  />
                </div>
              </div>
            )}

            {/* Every sheet in the issue, as an overlay off the header link.
                A grid of all 15 sheets is how a reader *gets to* a page — it
                is navigation, and giving it a permanent tab beside "Scan" is
                what made the two collide. */}
            {sheetsOpen && (
              <AllSheets
                pages={pages}
                currentPageNumber={current?.page_number ?? null}
                matchedPages={search.matchedPages}
                onOpen={openPage}
                onClose={() => setSheetsOpen(false)}
              />
            )}
          </div>

          {/* Paging belongs to the single-page views only. In the plate
              gallery every crop is already on screen and "next page" would
              move something the reader cannot see. */}
          {isPageView && (
            <PageNavigation
              pages={pages}
              current={current}
              previous={previous}
              next={next}
              position={position}
              matchedPages={search.matchedPages}
              onGoTo={goTo}
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Every sheet in the issue, over the reader.
 *
 * Was a tab called "Scans", one row above a tab called "Scan" that served the
 * identical image — verified live, both returned `/pages/c9420422…/image`.
 * Reframed as an overlay reached from the header, because picking which sheet
 * to read is navigation rather than a third way of viewing the page you are
 * already on.
 */
function AllSheets({
  pages,
  currentPageNumber,
  matchedPages,
  onOpen,
  onClose,
}: {
  pages: DocumentPageSummary[];
  currentPageNumber: number | null;
  matchedPages: Set<number>;
  onOpen: (pageNumber: number) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = window.document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    window.document.addEventListener("keydown", onKeyDown);
    return () => {
      window.document.removeEventListener("keydown", onKeyDown);
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="animate-fade absolute inset-0 z-30 flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Every sheet in this issue"
    >
      <div className="rule-b flex shrink-0 items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <p className="font-sans text-[0.75rem] tracking-[0.08em] uppercase text-muted-foreground">
          All sheets
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className={cn(
            "min-h-[44px] min-w-[44px] rounded-md px-3 font-sans text-[0.8125rem]",
            "text-foreground transition-colors duration-[120ms]",
            "ease-[var(--ease-crisp)] hover:bg-secondary",
            "focus-visible:outline-2 focus-visible:outline-offset-2",
            "focus-visible:outline-[var(--accent)]",
          )}
        >
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-3xl">
          <DocumentScans
            pages={pages}
            currentPageNumber={currentPageNumber}
            matchedPages={matchedPages}
            onOpen={onOpen}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * The search result summary and page chips.
 *
 * Split out of `DocumentSearch` so the *input* can live in the header while
 * the *results* stay in the flow beneath the tabs. Renders nothing at all
 * when idle, which is what turns a permanent 46px band into zero.
 */
function SearchResultsBar({
  search,
  currentPageNumber,
  onGoTo,
}: {
  search: ReturnType<typeof useDocumentSearch>;
  currentPageNumber: number | null;
  onGoTo: (pageNumber: number) => void;
}) {
  if (search.status === "idle") return null;

  return (
    <div className="rule-b shrink-0 px-4 py-1.5 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <DocumentSearchResults
          hits={search.hits}
          total={search.total}
          isPartial={search.isPartial}
          status={search.status}
          matched={search.matched}
          currentPageNumber={currentPageNumber}
          onGoTo={onGoTo}
        />
      </div>
    </div>
  );
}

/**
 * The issue's masthead line, the way back out, search, and the sheets link.
 *
 * Named as a publication and a date rather than as a document id, because that
 * is what a reader is holding — one issue of one newspaper, on one day.
 *
 * Which is exactly why `editionLabel` has to be here. The corpus holds two
 * documents that are both *The Chilian Times*, both 14 March 1891, both four
 * pages: for that pair the header alone is not an identity, and a reader who
 * followed a link had no way to know which of the two they were reading. The
 * backend sends the label only when a sibling exists, so this stays absent on
 * every unambiguous issue.
 *
 * **Compacted 2026-09-04.** It was 115px — the single largest band in a reader
 * that spent 49% of a 375x812 phone screen on chrome before printing a word of
 * newspaper. The back link had a 44px line to itself above the title, and the
 * metadata ran on a third line. Now the back control is an arrow inline with
 * the title, and search and the sheets link share the metadata row. Nothing was
 * dropped — every fact that was here is still here, on fewer lines.
 */
function ReaderHeader({
  publication,
  dateline,
  editionLabel,
  pageNumber,
  pageCount,
  query,
  onQueryChange,
  onClearQuery,
  searchStatus,
  onOpenSheets,
}: {
  publication: string;
  dateline: string | null;
  /** Non-null only when another issue shares this publication and date. */
  editionLabel: string | null;
  /** Null in the plate gallery, where no single page is open. */
  pageNumber: number | null;
  pageCount: number;
  query: string;
  onQueryChange: (value: string) => void;
  onClearQuery: () => void;
  searchStatus: DocumentSearchStatus;
  onOpenSheets: () => void;
}) {
  return (
    <div className="rule-b shrink-0 px-4 py-2 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center gap-1">
          {/* The arrow carries the whole 44px target, so "Browse" no longer
              needs a line of its own. `sr-only` text keeps it named for a
              screen reader rather than shipping an unlabelled arrow. */}
          <Link
            href="/archive"
            className={cn(
              // 44x44, not 36 wide: compacting the header is never a licence
              // to go under the tap-target floor, and this is the only way out
              // of the reader on a phone.
              "-ml-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-md",
              "text-muted-foreground transition-colors duration-[120ms]",
              "ease-[var(--ease-crisp)] hover:bg-secondary hover:text-foreground",
              "focus-visible:outline-2 focus-visible:outline-offset-2",
              "focus-visible:outline-[var(--accent)]",
            )}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            <span className="sr-only">Back to browse the archive</span>
          </Link>

          <h1 className="font-heading min-w-0 flex-1 truncate text-[1.0625rem] leading-snug text-foreground sm:text-[1.25rem]">
            {publication}
          </h1>

          <DocumentSearchField
            query={query}
            onQueryChange={onQueryChange}
            onClear={onClearQuery}
            status={searchStatus}
          />
        </div>

        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-7 text-[0.8125rem] text-muted-foreground">
          {dateline && <time className="numeric">{dateline}</time>}
          {dateline && <span aria-hidden>·</span>}
          <span className="numeric">
            {pageNumber === null
              ? `${pageCount} ${pageCount === 1 ? "page" : "pages"}`
              : `Page ${pageNumber} of ${pageCount}`}
          </span>
          <span aria-hidden>·</span>
          {/* The way to every sheet at once. A link rather than a tab, because
              choosing which sheet to read is navigation — as a tab it sat
              beside "Scan", one word and one row apart, serving the identical
              image. */}
          <button
            type="button"
            onClick={onOpenSheets}
            className={cn(
              "-my-1 inline-flex min-h-[44px] items-center rounded-md px-1 py-1",
              "text-[var(--accent)] transition-colors duration-[120ms]",
              "ease-[var(--ease-crisp)] hover:text-foreground",
              "focus-visible:outline-2 focus-visible:outline-offset-2",
              "focus-visible:outline-[var(--accent)]",
            )}
          >
            All {pageCount} sheets
          </button>
          {/* The plate count deliberately is *not* repeated here — it is
              already on the Plates tab a few pixels below, and carrying it in
              both places is what pushed this line to wrap on a 375px screen,
              spending back the vertical space this compaction just recovered. */}
        </p>

        {/* Its own line rather than another `·`-separated item: this is the
            only thing on the header that distinguishes this issue from another
            one that is otherwise identical, and burying it in a run of page and
            plate counts would hide the one fact the reader came for. Labelled
            `Source` because it names the file the text was OCR'd from — the
            archive does not know which of the pair the paper itself called a
            second edition, and it will not guess one. */}
        {editionLabel && (
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 pl-7 text-[0.75rem]">
            <span className="eyebrow shrink-0">Source</span>
            <span className="numeric break-all text-muted-foreground">
              {editionLabel}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Text / Scan / Plates — the one and only view control.
 *
 * **This replaces two stacked tab rows.** There was an issue-level row
 * (`Read / Scans / Figures`) sitting directly above a page-level row
 * (`Text / Scan`), which put five controls on screen for three destinations
 * and produced the "Scans" vs "Scan" collision documented on `ReaderView`.
 *
 * These three are genuinely parallel — they are three ways of looking at the
 * sheet the reader is on — so they belong on one row, and the all-sheets grid
 * (navigation, not a view) moved to the header.
 *
 * The Plates tab is never hidden or disabled when an issue has none: *The
 * Valparaiso English Mercury* of 1844-01-27 genuinely ran no engravings, and a
 * missing tab would read as a broken feature rather than as an empty issue.
 */
function ViewSwitch({
  view,
  onChange,
  figureTotal,
}: {
  view: ReaderView;
  onChange: (view: ReaderView) => void;
  figureTotal: number;
}) {
  return (
    <div className="rule-b shrink-0 px-4 sm:px-6">
      <TabRail
        className="mx-auto w-full max-w-3xl"
        ariaLabel="How to view this page"
        value={view}
        onChange={onChange}
        items={[
          { id: "text" as const, label: "Text", icon: FileText },
          { id: "scan" as const, label: "Scan", icon: ImageIcon },
          { id: "plates" as const, label: "Plates", icon: Images, count: figureTotal },
        ]}
      />
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
  matchedPages,
  onGoTo,
}: {
  pages: DocumentPageSummary[];
  current: DocumentPageSummary | null;
  previous: DocumentPageSummary | null;
  next: DocumentPageSummary | null;
  position: number;
  /** Pages matching the within-issue search, marked in the jump list. */
  matchedPages: Set<number>;
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
                {pageJumpLabel(page, matchedPages.has(page.page_number))}
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
 *
 * The search marker leads, because when a reader has a term in the box it is
 * the only thing they are steering by — a `<select>` cannot be styled per
 * option across platforms, so the mark has to be in the text itself.
 */
function pageJumpLabel(page: DocumentPageSummary, isMatch: boolean): string {
  const marks: string[] = [];
  if (isMatch) marks.push("match");
  if (!page.has_text) marks.push("blank");
  if (page.figure_count > 0) {
    // "Plates", matching the tab and the captions. The reader should meet one
    // word for one thing; "figures" here against "Plates" above is the kind of
    // small inconsistency that makes an interface feel unconsidered.
    marks.push(
      page.figure_count === 1 ? "1 plate" : `${page.figure_count} plates`,
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
