"use client";

import { Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useCatalogue } from "@/hooks/use-catalogue";
import type { SearchResponse, SearchResult, ViewerSource } from "@/lib/api/types";
import { formatIssueDateShort } from "@/lib/citations";
import { flattenSnippetMarkdown } from "@/lib/snippet-text";
import { cn } from "@/lib/utils";

import { DocumentCatalogue } from "./document-catalogue";
import { DocumentRail } from "./document-rail";
import { SourceViewer } from "./source-viewer";
import { SourceViewerPanel } from "./source-viewer-panel";

/**
 * Browse — the archive as a collection, with search as a tool inside it.
 *
 * **This page was inverted by CHUNK 3, and the inversion is the point.** It
 * used to be a search box that happened to list the catalogue in its idle
 * state, which made the two surfaces of the site — Ask and Browse — read as
 * the same thing: two text fields over one corpus. The users are academic
 * historians who do not arrive knowing the search term; demanding a query
 * before showing anything inverts how research actually starts. So the
 * catalogue is now the page, and one field filters it.
 *
 * That field does two jobs at once, because a reader typing a word does not
 * care which index answers it:
 *
 * - It **narrows the catalogue** through `GET /documents?q=`, a substring match
 *   over publication and title. Typing "Mercury" should surface the Mercury
 *   *issues*, not only chunks that happen to contain the word.
 * - It **searches the full text** through `GET /search`, ranked, listed below
 *   the catalogue. Typing "cholera" matches no issue *title*, so the catalogue
 *   narrows to nothing while the passages are what the reader wanted.
 *
 * Both run from one box, and both results are shown, labelled for what they
 * are. Splitting them into two fields would make the reader guess which one
 * their word belongs to — which is the same mistake as making them guess a
 * search term in the first place.
 */

const PAGE_SIZE = 20;

/**
 * Shortest query worth sending to the full-text index.
 *
 * Matches the catalogue filter's own threshold so the two halves of the single
 * field switch on together — one of them reacting a keystroke before the other
 * would read as the page changing its mind.
 */
const MIN_QUERY_CHARS = 2;

/** Debounce before a keystroke becomes a request. Matches `useCatalogue`. */
const DEBOUNCE_MS = 250;

type SearchStatus = "idle" | "searching" | "loaded" | "error";

export function ArchiveBrowser() {
  const catalogue = useCatalogue();
  const { filter, setFilter } = catalogue;

  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [submitted, setSubmitted] = useState("");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  /**
   * The page open in the viewer, and the passage to highlight within it.
   *
   * Held as `{ source, passage }` rather than as a `SearchResult` because the
   * viewer's props are the citation shape, not the search shape — the same
   * pair the chat path passes, so both surfaces drive one component.
   */
  const [active, setActive] = useState<{
    source: ViewerSource;
    passage: string | null;
  } | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (term: string, offset: number) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    if (offset === 0) setStatus("searching");
    else setIsLoadingMore(true);

    try {
      const params = new URLSearchParams({
        q: term,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      const response = await fetch(`/api/search?${params}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(String(response.status));

      const body = (await response.json()) as SearchResponse;
      setTotal(body.total);
      setResults((current) =>
        offset === 0 ? body.results : [...current, ...body.results],
      );
      setSubmitted(term);
      setStatus("loaded");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("error");
    } finally {
      setIsLoadingMore(false);
    }
  }, []);

  // The full-text half of the one field, debounced alongside the catalogue's
  // own filter so a single keystroke costs two requests, not fourteen.
  const term = filter.trim();
  const isSearchable = term.length >= MIN_QUERY_CHARS;

  /**
   * Drop stale passages the moment the field falls below the searchable
   * length, during render rather than in an effect — the pattern
   * `use-source-page` established. Resetting in an effect would leave one
   * painted frame of the previous term's results under a cleared field.
   */
  const [searchableFor, setSearchableFor] = useState(isSearchable);
  if (isSearchable !== searchableFor) {
    setSearchableFor(isSearchable);
    if (!isSearchable) {
      // State only — refs are not touchable during render, and the effect's
      // cleanup already aborts any in-flight request. See `use-document-search`
      // for the same reasoning spelled out.
      setResults([]);
      setTotal(0);
      setSubmitted("");
      setStatus("idle");
    }
  }

  useEffect(() => {
    if (!isSearchable) return;
    const timer = window.setTimeout(() => void runSearch(term, 0), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [term, isSearchable, runSearch]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  /**
   * Open a search hit at its matched page, highlighting the matched passage.
   *
   * `SearchResult` is a superset of what the viewer needs, so the citation
   * fields are projected and `content` becomes the passage to highlight.
   */
  const openResult = useCallback((result: SearchResult) => {
    setActive({
      source: {
        chunk_id: result.chunk_id,
        page_id: result.page_id,
        document_id: result.document_id,
        page_number: result.page_number,
        publication: result.publication,
        issue_date: result.issue_date,
      },
      passage: result.content,
    });
  }, []);

  const hasMore = results.length < total;

  return (
    <div className="flex min-h-0 flex-1">
      <DocumentRail />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 pb-12 sm:px-6 sm:py-7">
          <p className="eyebrow">Browse</p>
          <h1 className="mt-2.5 font-heading text-[1.5rem] leading-tight text-foreground sm:text-[1.875rem]">
            The collection
          </h1>
          <p className="measure mt-2.5 text-[0.875rem] leading-relaxed text-muted-foreground">
            Every issue held in the archive, newest first. Open one to read it
            page by page, see its scans, or look through its figures — no search
            term required.
          </p>

          <form
            // Submitting is a no-op: both halves already track the field as it
            // is typed. Prevented so Enter on a phone keyboard does not reload
            // the page and discard everything on screen.
            onSubmit={(event) => event.preventDefault()}
            role="search"
            className="mt-5"
          >
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border bg-card px-3",
                "transition-[border-color] duration-[120ms] ease-[var(--ease-crisp)]",
                "focus-within:border-[var(--accent)]",
              )}
            >
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                type="search"
                inputMode="search"
                enterKeyHint="search"
                placeholder="Filter by publication, or search the pages…"
                aria-label="Filter the catalogue and search the pages"
                className={cn(
                  "min-h-[44px] min-w-0 flex-1 bg-transparent outline-none",
                  // 16px avoids iOS zoom-on-focus.
                  "text-base sm:text-[0.9375rem]",
                  "placeholder:text-muted-foreground",
                )}
              />
            </div>
          </form>

          <div className="mt-7">
            <DocumentCatalogue
              groups={catalogue.groups}
              total={catalogue.total}
              shown={catalogue.documents.length}
              applied={catalogue.applied}
              status={catalogue.status}
              isLoadingMore={catalogue.isLoadingMore}
              hasMore={catalogue.hasMore}
              onLoadMore={catalogue.loadMore}
            />
          </div>

          {/* The full-text half. Below the catalogue, and only once there is
              something to say — an empty section under every idle visit would
              be exactly the blank screen the catalogue exists to prevent. */}
          {status !== "idle" && (
            <div className="mt-9">
              <div className="rule-t pt-5">
                {status === "searching" && <SearchingNote />}
                {status === "error" && <ErrorNote />}

                {status === "loaded" && results.length === 0 && (
                  <NoResultsNote term={submitted} />
                )}

                {status === "loaded" && results.length > 0 && (
                  <>
                    <p className="eyebrow mb-3">
                      {total} {total === 1 ? "passage" : "passages"} inside the
                      pages
                    </p>
                    <ul className="flex flex-col">
                      {results.map((result) => (
                        <ResultRow
                          key={result.chunk_id}
                          result={result}
                          query={submitted}
                          onOpen={openResult}
                        />
                      ))}
                    </ul>

                    {hasMore && (
                      <button
                        type="button"
                        onClick={() => void runSearch(submitted, results.length)}
                        disabled={isLoadingMore}
                        className={cn(
                          "mt-4 flex min-h-[44px] w-full items-center justify-center gap-2",
                          "rounded-md border text-[0.8125rem] text-foreground",
                          "transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
                          "hover:bg-secondary disabled:opacity-60",
                        )}
                      >
                        {isLoadingMore && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                        {isLoadingMore ? "Loading…" : "Load more passages"}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <SourceViewer
        source={active?.source ?? null}
        passage={active?.passage ?? null}
        query={submitted}
        onOpenChange={(open) => {
          if (!open) setActive(null);
        }}
      />
      <SourceViewerPanel
        source={active?.source ?? null}
        passage={active?.passage ?? null}
        query={submitted}
        onClose={() => setActive(null)}
      />
    </div>
  );
}

/**
 * One passage from inside the pages.
 *
 * Kept as a row rather than a card, deliberately unlike the catalogue above
 * it: these are excerpts, and a reader should be able to tell at a glance
 * which half of the page they are looking at without reading the headings.
 */
function ResultRow({
  result,
  query,
  onOpen,
}: {
  result: SearchResult;
  query: string;
  onOpen: (result: SearchResult) => void;
}) {
  const date = formatIssueDateShort(result.issue_date);

  return (
    <li className="animate-rise">
      <button
        type="button"
        onClick={() => onOpen(result)}
        className={cn(
          "rule-t w-full px-2 py-3.5 text-left",
          "transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
          "hover:bg-secondary",
        )}
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-heading text-[0.9375rem] leading-snug text-foreground">
            {result.publication ?? "Unidentified publication"}
          </span>
          {date && (
            <time className="numeric text-[0.75rem] text-muted-foreground">
              {date}
            </time>
          )}
          <span className="numeric text-[0.75rem] text-muted-foreground">
            · p. {result.page_number}
          </span>
        </div>
        <p className="mt-1.5 line-clamp-3 text-[0.8125rem] leading-relaxed text-foreground/75">
          <Snippet text={result.content} query={query} />
        </p>
      </button>
    </li>
  );
}

/**
 * A result snippet with query terms emphasised.
 *
 * Highlighting is client-side and approximate — it marks the query's own words
 * where they appear literally. Postgres ranked the result by stemmed English
 * matching, so a stemmed hit may not be marked; the snippet is still correct,
 * just less decorated.
 */
function Snippet({ text, query }: { text: string; query: string }) {
  // Flatten first, then highlight — the marks are computed by splitting the
  // rendered string, so highlighting the raw markdown and flattening after
  // would mark offsets that no longer line up with what the reader sees.
  const plain = flattenSnippetMarkdown(text);

  const terms = query
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2);

  if (terms.length === 0) return <>{plain}</>;

  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // The capture group makes split() interleave matches at odd indices, so
  // parity alone identifies them — no stateful .test() calls needed.
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");

  return (
    <>
      {plain.split(pattern).map((part, index) =>
        index % 2 === 1 ? (
          <mark
            key={index}
            className="rounded-[0.15rem] bg-[var(--accent-subtle)] px-0.5 text-foreground"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function SearchingNote() {
  return (
    <p className="flex items-center gap-2 text-[0.875rem] text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      Searching the pages…
    </p>
  );
}

function NoResultsNote({ term }: { term: string }) {
  return (
    <div className="measure">
      <h2 className="font-heading text-[0.9375rem] text-foreground">
        No passage matches “{term}”
      </h2>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
        Try a shorter phrase or a period spelling — these pages were set in
        nineteenth-century type, and names were often printed differently.
        Accents are optional: “Valparaiso” finds “Valparaíso”.
      </p>
    </div>
  );
}

function ErrorNote() {
  return (
    <div className="measure">
      <h2 className="font-heading text-[0.9375rem] text-foreground">
        The search could not be completed
      </h2>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
        The archive service did not respond. Try again in a moment.
      </p>
    </div>
  );
}
