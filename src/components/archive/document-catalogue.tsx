"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { DocumentListResponse, DocumentSummary } from "@/lib/api/types";
import { formatIssueDateShort } from "@/lib/citations";
import { cn } from "@/lib/utils";

/**
 * The archive's browsable catalogue, shown before a search is typed.
 *
 * Until this existed, the only ways into the viewer were a search result or a
 * citation chip, so a first-time visitor had to guess a search term to see
 * anything at all and the archive read as empty even with issues in it. The
 * document rail is not that entry point — it is `lg`+ only, and its rows open
 * the scope picker rather than a document.
 *
 * Reuses `GET /api/documents`, the same Route Handler the scope picker reads.
 * No endpoint was added; the backend gained `first_page_id` on the existing
 * response, because the viewer is keyed on a page id and the catalogue would
 * otherwise have nothing to open.
 */

const PAGE_SIZE = 50;

type Status = "loading" | "loaded" | "error";

export function DocumentCatalogue({
  onOpen,
}: {
  /** Opens a document at its first page. */
  onOpen: (document: DocumentSummary, pageId: string) => void;
}) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;

    fetch(`/api/documents?limit=${PAGE_SIZE}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<DocumentListResponse>;
      })
      .then((body) => {
        setDocuments(body.results);
        setTotal(body.total);
        setStatus("loaded");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      });

    return () => controller.abort();
  }, []);

  if (status === "loading") return <CatalogueLoadingNote />;
  if (status === "error") return <CatalogueErrorNote />;
  if (documents.length === 0) return <CatalogueEmptyNote />;

  return (
    <>
      <p className="eyebrow mb-3">
        {total === 1 ? "1 issue" : `${total} issues`} in the archive
      </p>
      <ul className="flex flex-col">
        {documents.map((document) => (
          <DocumentRow
            key={document.document_id}
            document={document}
            onOpen={onOpen}
          />
        ))}
      </ul>
      {documents.length < total && (
        // Deliberately a note, not a "load more" button: the catalogue is a
        // starting point for browsing, and a reader who needs to reach past
        // the first 50 issues is better served by the search field above than
        // by paging a flat list. Revisit when the corpus is large enough for
        // that to be a real journey rather than a guess about one.
        <p className="mt-4 text-[0.75rem] text-muted-foreground">
          Showing the {documents.length} most recent issues. Search above to
          find others.
        </p>
      )}
    </>
  );
}

/**
 * One issue in the catalogue.
 *
 * Follows `ResultRow`'s visual language exactly rather than introducing a
 * second row style on the same page — same rule, padding, hover and type
 * scale, so the list a reader sees before searching and the list they see
 * after read as one thing.
 */
function DocumentRow({
  document,
  onOpen,
}: {
  document: DocumentSummary;
  onOpen: (document: DocumentSummary, pageId: string) => void;
}) {
  const date = formatIssueDateShort(document.issue_date);
  const pageId = document.first_page_id;

  // A document with no pages ingested cannot be opened. It is still listed —
  // it is genuinely in the archive — but as static text rather than a control
  // that looks tappable and then does nothing when tapped.
  if (pageId === null) {
    return (
      <li className="animate-rise">
        <div className="rule-t px-2 py-3.5">
          <DocumentMeta document={document} date={date} />
          <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
            No pages ingested yet — nothing to open.
          </p>
        </div>
      </li>
    );
  }

  return (
    <li className="animate-rise">
      <button
        type="button"
        onClick={() => onOpen(document, pageId)}
        className={cn(
          "rule-t w-full px-2 py-3.5 text-left",
          "transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
          "hover:bg-secondary",
        )}
      >
        <DocumentMeta document={document} date={date} />
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
          {document.page_count === 1 ? "1 page" : `${document.page_count} pages`}
          {" · opens at page 1"}
        </p>
      </button>
    </li>
  );
}

/** Publication and date line, shared by the openable and unopenable rows. */
function DocumentMeta({
  document,
  date,
}: {
  document: DocumentSummary;
  date: string | null;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="font-heading text-[0.9375rem] leading-snug text-foreground">
        {/* Falls back to `title` rather than to a placeholder: an unreadable
            masthead leaves `publication` null, but `title` is always set and
            usually still names the issue. */}
        {document.publication ?? document.title}
      </span>
      {date && (
        <time className="numeric text-[0.75rem] text-muted-foreground">
          {date}
        </time>
      )}
    </div>
  );
}

function CatalogueLoadingNote() {
  return (
    <p className="flex items-center gap-2 text-[0.875rem] text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      Loading the archive…
    </p>
  );
}

function CatalogueEmptyNote() {
  return (
    <div className="measure">
      <h2 className="font-heading text-[0.9375rem] text-foreground">
        No issues in the archive yet
      </h2>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
        Scanned pages appear here as they are added.
      </p>
    </div>
  );
}

function CatalogueErrorNote() {
  return (
    <div className="measure">
      <h2 className="font-heading text-[0.9375rem] text-foreground">
        The archive could not be listed
      </h2>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
        The archive service did not respond. Try again in a moment.
      </p>
    </div>
  );
}
