"use client";

import { Check, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { DocumentListResponse, DocumentSummary } from "@/lib/api/types";
import { MAX_SCOPE_DOCUMENTS } from "@/lib/api/types";
import { formatIssueDateShort } from "@/lib/citations";
import { cn } from "@/lib/utils";

/**
 * Document picker for scoped chat.
 *
 * Follows the `SourceViewer` precedent deliberately rather than inventing a
 * third pattern: a bottom sheet on mobile, a right-hand panel from `sm` up.
 * A persistent sidebar was rejected — the shell is `h-dvh` + `overflow-hidden`
 * so the composer survives the mobile keyboard, and a permanent third column
 * would either break that or become a desktop-only affordance, which the
 * mobile-first rule forbids.
 *
 * Selection is multi-select because the backend accepts an id array, but the
 * common case is one document, so a tap selects and the panel stays open for a
 * second choice rather than closing eagerly.
 */

const PAGE_SIZE = 50;

type Status = "idle" | "loading" | "loaded" | "error";

export function ScopePicker({
  open,
  onOpenChange,
  selected,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Currently scoped documents, empty for corpus-wide. */
  selected: DocumentSummary[];
  onChange: (documents: DocumentSummary[]) => void;
}) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [filter, setFilter] = useState("");
  const controllerRef = useRef<AbortController | null>(null);

  const selectedIds = useMemo(
    () => new Set(selected.map((doc) => doc.document_id)),
    [selected],
  );

  // Fetch when opened, and again when the filter settles. Debounced so typing
  // does not fire a request per keystroke.
  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(
      () => {
        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;
        setStatus("loading");

        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        const term = filter.trim();
        if (term.length > 0) params.set("q", term);

        fetch(`/api/documents?${params}`, { signal: controller.signal })
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
      },
      filter.trim().length > 0 ? 200 : 0,
    );

    return () => clearTimeout(timer);
  }, [open, filter]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const toggle = useCallback(
    (doc: DocumentSummary) => {
      if (selectedIds.has(doc.document_id)) {
        onChange(selected.filter((item) => item.document_id !== doc.document_id));
        return;
      }
      if (selected.length >= MAX_SCOPE_DOCUMENTS) return;
      onChange([...selected, doc]);
    },
    [onChange, selected, selectedIds],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "h-[85dvh] rounded-t-xl p-0",
          "sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:w-[min(30rem,90vw)]",
          "sm:max-w-none sm:rounded-none sm:border-l",
        )}
      >
        <SheetHeader className="gap-1 px-4 pt-4 pb-3 sm:px-5">
          <SheetTitle className="text-[1.0625rem] leading-snug">
            Choose a document
          </SheetTitle>
          <SheetDescription className="text-[0.8125rem] leading-relaxed">
            Pin the assistant to one issue and it will answer only from those
            pages. Leave nothing selected to search the whole archive.
          </SheetDescription>
        </SheetHeader>

        <div className="rule-b px-4 pb-3 sm:px-5">
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border bg-card px-3",
              "transition-[border-color] duration-[120ms] ease-[var(--ease-crisp)]",
              "focus-within:border-[var(--accent)]",
            )}
          >
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              type="search"
              inputMode="search"
              placeholder="Filter by title or publication…"
              aria-label="Filter documents"
              className={cn(
                "min-h-[44px] flex-1 bg-transparent outline-none",
                // 16px avoids iOS zoom-on-focus.
                "text-base sm:text-[0.9375rem]",
                "placeholder:text-muted-foreground",
              )}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 sm:px-5">
          {status === "loading" && <PickerNote icon>Loading documents…</PickerNote>}

          {status === "error" && (
            <PickerEmpty
              title="The document list could not be loaded"
              body="The archive service did not respond. Close this panel and try again."
            />
          )}

          {status === "loaded" && documents.length === 0 && (
            <PickerEmpty
              title={
                filter.trim().length > 0
                  ? `No document matches “${filter.trim()}”`
                  : "No documents in the archive yet"
              }
              body={
                filter.trim().length > 0
                  ? "Try part of a publication name, or clear the filter to see everything."
                  : "Once scanned pages are ingested, every issue will be listed here to scope questions to."
              }
            />
          )}

          {status === "loaded" && documents.length > 0 && (
            <>
              <p className="eyebrow py-3">
                {total} {total === 1 ? "document" : "documents"}
              </p>
              <ul className="flex flex-col pb-2">
                {documents.map((doc) => (
                  <DocumentRow
                    key={doc.document_id}
                    document={doc}
                    isSelected={selectedIds.has(doc.document_id)}
                    onToggle={toggle}
                  />
                ))}
              </ul>
              {total > documents.length && (
                <p className="pt-1 text-[0.75rem] leading-relaxed text-muted-foreground">
                  Showing the {documents.length} most recent. Filter by name to
                  reach older issues.
                </p>
              )}
            </>
          )}
        </div>

        {selected.length > 0 && (
          <div className="rule-t pb-safe bg-background/95 px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 text-[0.8125rem] text-muted-foreground">
                <span className="numeric text-foreground">{selected.length}</span>{" "}
                selected
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className={cn(
                    "flex min-h-[44px] items-center rounded-md px-3 text-[0.8125rem]",
                    "text-muted-foreground transition-colors duration-[120ms]",
                    "ease-[var(--ease-crisp)] hover:text-foreground",
                  )}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    "flex min-h-[44px] items-center rounded-md px-4",
                    "bg-[var(--accent)] text-[0.8125rem] font-medium",
                    "text-[var(--accent-foreground)] transition-transform",
                    "duration-[120ms] ease-[var(--ease-crisp)] active:scale-[0.97]",
                  )}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DocumentRow({
  document,
  isSelected,
  onToggle,
}: {
  document: DocumentSummary;
  isSelected: boolean;
  onToggle: (document: DocumentSummary) => void;
}) {
  const date = formatIssueDateShort(document.issue_date);

  return (
    <li>
      <button
        type="button"
        onClick={() => onToggle(document)}
        aria-pressed={isSelected}
        className={cn(
          "rule-t flex min-h-[44px] w-full items-start gap-3 px-2 py-3 text-left",
          "transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
          "hover:bg-secondary",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[0.25rem]",
            "border transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
            isSelected
              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
              : "border-[var(--rule-strong)]/40",
          )}
        >
          {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block font-heading text-[0.9375rem] leading-snug text-foreground">
            {document.publication ?? document.title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {date && (
              <time className="numeric text-[0.75rem] text-muted-foreground">
                {date}
              </time>
            )}
            <span className="numeric text-[0.75rem] text-muted-foreground">
              {document.page_count}{" "}
              {document.page_count === 1 ? "page" : "pages"}
            </span>
            {/* A document with no ingested pages cannot answer anything —
                say so rather than letting it look selectable-and-useful. */}
            {document.page_count === 0 && (
              <span className="text-[0.75rem] text-muted-foreground italic">
                no text yet
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

function PickerNote({
  children,
  icon = false,
}: {
  children: React.ReactNode;
  icon?: boolean;
}) {
  return (
    <p className="flex items-center gap-2 pt-6 text-[0.875rem] text-muted-foreground">
      {icon && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </p>
  );
}

function PickerEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="measure pt-6">
      <h3 className="font-heading text-[0.9375rem] text-foreground">{title}</h3>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}
