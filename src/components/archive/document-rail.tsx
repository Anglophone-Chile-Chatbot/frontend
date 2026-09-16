"use client";

import { Check, Library, MessageSquare, PenSquare } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { DocumentListResponse, DocumentSummary } from "@/lib/api/types";
import { formatIssueDateShort } from "@/lib/citations";
import type { ChatTurn } from "@/hooks/use-archive-chat";
import { cn } from "@/lib/utils";

/**
 * The desktop-only left rail: this session's questions (on Ask), and a
 * handful of recent documents as a shortcut into the assistant's scope
 * picker — shared chrome across Ask and Archive so the app reads as one
 * shell rather than two differently-structured pages.
 *
 * Hidden below `lg` — mobile keeps today's sheet-based scope picker rather
 * than gaining a permanent column, since the shell is `h-dvh` +
 * `overflow-hidden` specifically so the composer survives the mobile
 * keyboard, and a persistent rail would either break that or become a
 * desktop-only affordance smuggled in as "responsive."
 *
 * **W4a (2026-09-17): the rail shows the current scope.** Before this it
 * could not — `RecentDocuments` did its own independent fetch and held no
 * concept of "currently scoped", so there was no state here capable of
 * rendering a highlight even in principle. That made "the left side gives no
 * indication" an architectural fact rather than a styling oversight. `scope`
 * is now threaded down from `ChatView`, which already owns it, and a scoped
 * row is marked with the same accent check `ScopePicker`'s own `DocumentRow`
 * uses — reusing that vocabulary rather than inventing a second one.
 *
 * The scope is deliberately legible in **two** places at once (this rail and
 * the `ScopeBar` above the composer). That is not redundancy to trim: the rail
 * is the standing list a reader scans, and NotebookLM's source list works the
 * same way — the list *is* the primary statement of what is in context, not an
 * echo of a bar somewhere else.
 *
 * The conversation list is this-session only, held in memory via `turns` —
 * Phase 1 chat is stateless (CLAUDE.md, no exceptions), so there is
 * deliberately no persistence, no backend call, and nothing here survives a
 * reload. It exists to make the *current* transcript scannable when it gets
 * long, not to be a history feature. On Archive there is no chat state to
 * show, so that section is omitted rather than faked empty.
 */
export function DocumentRail({
  turns,
  onNewChat,
  onOpenPicker,
  scope,
}: {
  /** Omit entirely on pages with no chat state (Archive). */
  turns?: ChatTurn[];
  onNewChat?: () => void;
  /** Opens the scope picker; omitted on Archive, which links to Ask instead. */
  onOpenPicker?: () => void;
  /**
   * Documents the next question will be restricted to. Omitted on Archive,
   * which has no scope concept at all — browsing is corpus-wide by design, so
   * there is nothing there to mark active and nothing is faked.
   */
  scope?: DocumentSummary[];
}) {
  const scopedIds = new Set((scope ?? []).map((doc) => doc.document_id));
  return (
    <aside className="rule-r hidden w-60 shrink-0 flex-col overflow-y-auto bg-[var(--sidebar)] lg:flex">
      {/* The standing answer to "what am I asking?", at the top of the column
          the reader's eye already returns to. Rendered only when scoped: an
          always-present "whole archive" chip would be chrome stating the
          default, and the ScopeBar already says that in its idle state. */}
      {scope && scope.length > 0 && (
        <div className="rule-b px-3 py-2.5">
          <p className="eyebrow mb-1 px-2.5">Asking within</p>
          <ul className="flex flex-col gap-0.5">
            {scope.map((doc) => (
              <li
                key={doc.document_id}
                className={cn(
                  "flex items-start gap-2 rounded-md px-2.5 py-1",
                  "border-l-2 border-[var(--accent)] bg-[var(--accent)]/[0.06]",
                )}
              >
                <span className="min-w-0">
                  <span className="font-heading block truncate text-[0.8125rem] text-foreground">
                    {doc.publication ?? doc.title}
                  </span>
                  {(formatIssueDateShort(doc.issue_date) || doc.edition_label) && (
                    <span className="numeric block truncate text-[0.6875rem] text-muted-foreground">
                      {[formatIssueDateShort(doc.issue_date), doc.edition_label]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {turns && onNewChat && (
        <>
          <div className="p-3">
            <button
              type="button"
              onClick={onNewChat}
              disabled={turns.length === 0}
              className={cn(
                "flex min-h-[38px] w-full items-center gap-2 rounded-md px-2.5",
                "text-[0.8125rem] text-foreground transition-colors duration-[120ms]",
                "ease-[var(--ease-crisp)] hover:bg-secondary",
                "disabled:pointer-events-none disabled:opacity-45",
              )}
            >
              <PenSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              New question
            </button>
          </div>

          <div className="px-3">
            <p className="eyebrow mb-1.5 px-2.5">This session</p>
            {turns.length === 0 ? (
              <p className="px-2.5 py-1 text-[0.75rem] leading-relaxed text-muted-foreground">
                Questions you ask will be listed here for the rest of this visit.
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {turns.map((turn) => (
                  <li key={turn.id}>
                    <a
                      href={`#turn-${turn.id}`}
                      className={cn(
                        "flex min-h-[34px] items-start gap-2 rounded-md px-2.5 py-1.5",
                        "text-[0.8125rem] leading-snug text-foreground/85 transition-colors",
                        "duration-[120ms] ease-[var(--ease-crisp)] hover:bg-secondary",
                      )}
                    >
                      <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="line-clamp-2">{turn.question}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <div className={cn("rule-t p-3", !turns && "flex-1")}>
        <p className="eyebrow mb-1.5 px-2.5">Collections</p>
        <RecentDocuments onOpenPicker={onOpenPicker} scopedIds={scopedIds} />
      </div>
    </aside>
  );
}

const RECENT_LIMIT = 6;

function RecentDocuments({
  onOpenPicker,
  scopedIds,
}: {
  onOpenPicker?: () => void;
  /**
   * Ids the chat is currently scoped to. Empty on Archive, where there is no
   * scope to show — the rows there gain the same visual language for
   * consistency but never an active state, because browsing is corpus-wide.
   */
  scopedIds: Set<string>;
}) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/documents?limit=${RECENT_LIMIT}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<DocumentListResponse>;
      })
      .then((body) => {
        setDocuments(body.results);
        setStatus("loaded");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      });
    return () => controller.abort();
  }, []);

  if (status === "loading") return null;

  if (status === "error" || documents.length === 0) {
    return (
      <p className="px-2.5 py-1 text-[0.75rem] leading-relaxed text-muted-foreground">
        No documents in the archive yet.
      </p>
    );
  }

  // Active rows carry an accent left-border and tinted ground — the same
  // vocabulary ScopePicker's DocumentRow uses for a checked document, so the
  // two surfaces agree rather than teaching the reader two different marks.
  const rowClass = (isScoped: boolean) =>
    cn(
      "flex min-h-[34px] w-full flex-col items-start gap-0 rounded-md px-2.5 py-1.5",
      "text-left transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
      "hover:bg-secondary",
      isScoped &&
        "border-l-2 border-[var(--accent)] bg-[var(--accent)]/[0.06] pl-2",
    );
  const footerClass = cn(
    "mt-1.5 flex min-h-[34px] w-full items-center gap-2 rounded-md px-2.5",
    "text-[0.75rem] text-muted-foreground transition-colors duration-[120ms]",
    "ease-[var(--ease-crisp)] hover:bg-secondary hover:text-foreground",
  );

  return (
    <>
      <ul className="flex flex-col gap-0.5">
        {documents.map((doc) => {
          const date = formatIssueDateShort(doc.issue_date);
          const isScoped = scopedIds.has(doc.document_id);
          const label = (
            <>
              <span className="flex w-full items-center gap-1.5">
                {/* aria-hidden: the active state is announced by aria-current
                    on the row itself, so the glyph would otherwise be read
                    twice. */}
                {isScoped && (
                  <Check
                    aria-hidden
                    className="h-3 w-3 shrink-0 text-[var(--accent)]"
                    strokeWidth={3}
                  />
                )}
                <span className="font-heading min-w-0 flex-1 truncate text-[0.8125rem] text-foreground">
                  {doc.publication ?? doc.title}
                </span>
              </span>
              {/* The rail shows publication + date and nothing else, so it is
                  the surface where the two same-day `Chilian Times` issues are
                  *most* alike — two rows with identical text, one above the
                  other. `edition_label` is non-null only for such a pair, so
                  appending it here costs the other rows nothing. Truncated
                  rather than wrapped: the rail is a fixed 240px column and a
                  wrapping stem would push the rows to uneven heights. */}
              {(date || doc.edition_label) && (
                <span className="numeric w-full truncate text-[0.6875rem] text-muted-foreground">
                  {[date, doc.edition_label].filter(Boolean).join(" · ")}
                </span>
              )}
            </>
          );
          return (
            <li key={doc.document_id}>
              {/* On Ask, a row opens the scope picker in place. On Archive,
                  there is no picker to open — a row is a shortcut into Ask
                  instead, where scoping actually lives. */}
              {onOpenPicker ? (
                <button
                  type="button"
                  onClick={onOpenPicker}
                  aria-current={isScoped ? "true" : undefined}
                  className={rowClass(isScoped)}
                >
                  {label}
                </button>
              ) : (
                <Link href="/" className={rowClass(false)}>
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      {onOpenPicker ? (
        <button type="button" onClick={onOpenPicker} className={footerClass}>
          <Library className="h-3.5 w-3.5 shrink-0" />
          Browse all documents
        </button>
      ) : (
        <Link href="/" className={footerClass}>
          <Library className="h-3.5 w-3.5 shrink-0" />
          Ask within a document
        </Link>
      )}
    </>
  );
}
