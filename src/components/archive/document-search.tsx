"use client";

import { Loader2, Search, X } from "lucide-react";

import type { DocumentSearchHit, DocumentSearchStatus } from "@/hooks/use-document-search";
import { cn } from "@/lib/utils";

/**
 * Search inside the issue the reader has open.
 *
 * The loop this completes is *search → read → search again from where I am*.
 * A corpus-wide search throws a reader at one page of one issue and abandons
 * them; this is how they keep working once they are there — "where in this
 * issue does cholera appear?" is the question, and page numbers are the answer.
 *
 * Results are pages, not passages, and that is the whole design. The chunker's
 * boundaries are an implementation detail of retrieval; a reader wants to know
 * which *sheets* of the newspaper to turn to. The count of matching passages is
 * still shown, because "9 passages across 5 pages" tells a historian something
 * "5 pages" does not — how heavily the issue dwells on it.
 */
export function DocumentSearch({
  query,
  onQueryChange,
  onClear,
  hits,
  total,
  isPartial,
  status,
  matched,
  currentPageNumber,
  onGoTo,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onClear: () => void;
  hits: DocumentSearchHit[];
  total: number;
  isPartial: boolean;
  status: DocumentSearchStatus;
  /** The term `hits` describe — not what is being typed. */
  matched: string;
  currentPageNumber: number | null;
  onGoTo: (pageNumber: number) => void;
}) {
  return (
    <div className="rule-b shrink-0 px-4 py-2 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <form
          role="search"
          // Submitting is a no-op — results already track the box as it is
          // typed. Prevented so Enter on a phone keyboard does not reload the
          // route and throw away the reader's position in the issue.
          onSubmit={(event) => event.preventDefault()}
          className={cn(
            "flex items-center gap-2 rounded-lg border bg-card px-3",
            "transition-[border-color] duration-[120ms] ease-[var(--ease-crisp)]",
            "focus-within:border-[var(--accent)]",
          )}
        >
          {status === "searching" ? (
            <Loader2
              className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
              aria-hidden
            />
          ) : (
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            placeholder="Search inside this issue…"
            aria-label="Search inside this issue"
            className={cn(
              "min-h-[44px] min-w-0 flex-1 bg-transparent outline-none",
              // 16px avoids iOS zoom-on-focus.
              "text-base sm:text-[0.875rem]",
              "placeholder:text-muted-foreground",
              // The native clear affordance is a ~14px target and sits at a
              // different place per browser; the explicit button below is the
              // one that meets the 44px rule.
              "[&::-webkit-search-cancel-button]:hidden",
            )}
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear the search"
              className={cn(
                "-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md",
                "text-muted-foreground transition-colors duration-[120ms]",
                "ease-[var(--ease-crisp)] hover:text-foreground",
              )}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </form>

        <Results
          hits={hits}
          total={total}
          isPartial={isPartial}
          status={status}
          matched={matched}
          currentPageNumber={currentPageNumber}
          onGoTo={onGoTo}
        />
      </div>
    </div>
  );
}

/**
 * The matching pages, as jump targets.
 *
 * Rendered as a wrapping row of page chips rather than a list of snippets: the
 * reader is already looking at the issue, so the useful output is a set of
 * destinations, not a second reading surface competing with the page below.
 */
function Results({
  hits,
  total,
  isPartial,
  status,
  matched,
  currentPageNumber,
  onGoTo,
}: {
  hits: DocumentSearchHit[];
  total: number;
  isPartial: boolean;
  status: DocumentSearchStatus;
  matched: string;
  currentPageNumber: number | null;
  onGoTo: (pageNumber: number) => void;
}) {
  if (status === "idle") return null;

  if (status === "error") {
    return (
      <p className="mt-1.5 text-[0.75rem] text-muted-foreground">
        The search could not be completed. Try again in a moment.
      </p>
    );
  }

  // Keep the previous results on screen while a new term is in flight rather
  // than blanking to a spinner on every keystroke — the row would flicker on
  // and off as the reader types, and the spinner in the field already says a
  // request is running.
  if (status === "searching" && hits.length === 0) return null;

  if (status === "loaded" && hits.length === 0) {
    return (
      <p className="mt-1.5 text-[0.75rem] leading-relaxed text-muted-foreground">
        No passage in this issue matches “{matched}”. It may appear elsewhere in
        the archive — search from the Browse page to look across every issue.
      </p>
    );
  }

  return (
    <div className="mt-1.5 pb-1">
      <p className="text-[0.75rem] text-muted-foreground">
        <span className="numeric">{total}</span>
        {total === 1 ? " passage on " : " passages on "}
        <span className="numeric">{hits.length}</span>
        {hits.length === 1 ? " page" : " pages"}
        {/* Said plainly rather than quietly truncating: the backend caps a
            single request at 50 chunks, and a common word in a long issue can
            genuinely exceed that (measured: "Valparaiso" matches exactly 50
            chunks in The Star of Chile 1904-12-03). The page list below is then
            the pages among the 50 best-ranked passages, not every page in the
            issue that contains the word. */}
        {isPartial && " — showing the strongest 50"}
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {hits.map((hit) => {
          const isCurrent = hit.pageNumber === currentPageNumber;
          return (
            <li key={hit.pageId}>
              <button
                type="button"
                onClick={() => onGoTo(hit.pageNumber)}
                aria-current={isCurrent ? "page" : undefined}
                aria-label={`Go to page ${hit.pageNumber}, ${hit.count} ${hit.count === 1 ? "match" : "matches"}`}
                className={cn(
                  "relative flex min-h-[32px] items-center gap-1 rounded-md border px-2",
                  "font-sans text-[0.75rem] transition-colors duration-[120ms]",
                  "ease-[var(--ease-crisp)]",
                  // A 32px chip in a wrapping row of many would need 44px of
                  // height to meet the rule and would push the page itself off
                  // a small screen, so the target is extended past the visible
                  // box instead — the same technique the citation chip uses.
                  "after:absolute after:inset-x-0 after:top-1/2 after:h-[44px]",
                  "after:-translate-y-1/2 after:content-['']",
                  "focus-visible:outline-2 focus-visible:outline-offset-2",
                  "focus-visible:outline-[var(--accent)]",
                  isCurrent
                    ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-foreground"
                    : "bg-card text-foreground hover:border-[var(--accent)]/60 hover:bg-secondary",
                )}
              >
                <span className="numeric">p. {hit.pageNumber}</span>
                <span className="numeric text-muted-foreground">{hit.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
