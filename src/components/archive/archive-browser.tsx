"use client";

import { Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  DocumentSummary,
  SearchResponse,
  SearchResult,
  ViewerSource,
} from "@/lib/api/types";
import { formatIssueDateShort } from "@/lib/citations";
import { cn } from "@/lib/utils";

import { DocumentCatalogue } from "./document-catalogue";
import { DocumentRail } from "./document-rail";
import { SourceViewer } from "./source-viewer";
import { SourceViewerPanel } from "./source-viewer-panel";

/**
 * Full-text search over the archive.
 *
 * Distinct from the assistant: this returns the pages themselves, ranked, with
 * the matching passage shown as a snippet. Results open in the same viewer the
 * citations use, with the matched passage highlighted.
 */

const PAGE_SIZE = 20;

type Status = "idle" | "searching" | "loaded" | "error";

export function ArchiveBrowser() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  /**
   * The page open in the viewer, and the passage to highlight within it.
   *
   * Held as `{ source, passage }` rather than as a `SearchResult` because the
   * viewer now opens from two places with different amounts of information: a
   * search hit knows the matched chunk text and wants it highlighted, while a
   * catalogue row is just "open this issue at page 1" and has no cited passage
   * at all. Passing the whole result and deriving the passage from it would
   * have forced a fake chunk for the browse case.
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
      setStatus("loaded");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("error");
    } finally {
      setIsLoadingMore(false);
      controllerRef.current = null;
    }
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  /**
   * Open a search hit at its matched page, highlighting the matched passage.
   *
   * `SearchResult` is a superset of what the viewer needs, so the citation
   * fields are projected and `content` becomes the passage to highlight —
   * unchanged behaviour, just expressed as one of two entry points now.
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

  /**
   * Open a browsed document at its first page.
   *
   * The catalogue has no chunk and no matched text, so `passage` is null and
   * the viewer shows the page unhighlighted — which is honest: nothing was
   * cited here, so marking a passage would invent an emphasis the reader never
   * asked for. `chunk_id` is the page id because the viewer only uses it as a
   * React key; nothing resolves it back to a chunk on this path.
   *
   * `page_number` is deliberately null rather than 1. Both viewers render
   * `source.page_number ?? page.page_number`, preferring what the caller
   * passed — so hardcoding 1 here would print "Page 1" even for an issue whose
   * lowest ingested page is 3, and it would print it *confidently*, overriding
   * the fetched page's own number. Null makes the viewer fall through to the
   * page it actually loaded, which is the only value known to be true.
   */
  const openDocument = useCallback(
    (document: DocumentSummary, pageId: string) => {
      setActive({
        source: {
          chunk_id: pageId,
          page_id: pageId,
          document_id: document.document_id,
          page_number: null,
          publication: document.publication,
          issue_date: document.issue_date,
        },
        passage: null,
      });
    },
    [],
  );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (term.length === 0) return;
    setSubmitted(term);
    setResults([]);
    void runSearch(term, 0);
  }

  const hasMore = results.length < total;

  return (
    <div className="flex min-h-0 flex-1">
      <DocumentRail />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 pb-12 sm:px-6 sm:py-7">
          <p className="eyebrow">Archive</p>
          <h1 className="mt-2.5 font-heading text-[1.5rem] leading-tight text-foreground sm:text-[1.875rem]">
            Search the pages directly
          </h1>
          <p className="measure mt-2.5 text-[0.875rem] leading-relaxed text-muted-foreground">
            Full-text search across every scanned page. Results are ranked by
            relevance and open in the original.
          </p>

          <form onSubmit={submit} className="mt-5">
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border bg-card px-3",
                "transition-[border-color] duration-[120ms] ease-[var(--ease-crisp)]",
                "focus-within:border-[var(--accent)]",
              )}
            >
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                type="search"
                inputMode="search"
                enterKeyHint="search"
                placeholder="Search words or phrases…"
                aria-label="Search the archive"
                className={cn(
                  "min-h-[44px] flex-1 bg-transparent outline-none",
                  // 16px avoids iOS zoom-on-focus.
                  "text-base sm:text-[0.9375rem]",
                  "placeholder:text-muted-foreground",
                )}
              />
            </div>
          </form>

          <div className="mt-6">
            {status === "searching" && <SearchingNote />}
            {status === "error" && <ErrorNote />}
            {/* Before any search, the archive lists itself. This is the only
                path into the viewer that does not require guessing a search
                term first, and it is the whole point of the catalogue. */}
            {status === "idle" && (
              <>
                <IdleNote />
                <div className="mt-6">
                  <DocumentCatalogue onOpen={openDocument} />
                </div>
              </>
            )}
            {status === "loaded" && results.length === 0 && (
              <NoResultsNote term={submitted} />
            )}

            {status === "loaded" && results.length > 0 && (
              <>
                <p className="eyebrow mb-3">
                  {total} {total === 1 ? "passage" : "passages"} found
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
                    {isLoadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {isLoadingMore ? "Loading…" : "Load more"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <SourceViewer
        source={active?.source ?? null}
        passage={active?.passage ?? null}
        onOpenChange={(open) => {
          if (!open) setActive(null);
        }}
      />
      <SourceViewerPanel
        source={active?.source ?? null}
        passage={active?.passage ?? null}
        onClose={() => setActive(null)}
      />
    </div>
  );
}

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
  const terms = query
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2);

  if (terms.length === 0) return <>{text}</>;

  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // The capture group makes split() interleave matches at odd indices, so
  // parity alone identifies them — no stateful .test() calls needed.
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");

  return (
    <>
      {text.split(pattern).map((part, index) =>
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

function IdleNote() {
  return (
    <p className="measure text-[0.875rem] leading-relaxed text-muted-foreground">
      Search for a place, a ship, a merchant house, or a phrase as it would have
      been printed. Accents are optional — “Valparaiso” finds “Valparaíso”.
    </p>
  );
}

function SearchingNote() {
  return (
    <p className="flex items-center gap-2 text-[0.875rem] text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      Searching…
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
