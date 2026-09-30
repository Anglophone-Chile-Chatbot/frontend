"use client";

import {
  Check,
  Library,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PenSquare,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useRailCollapsed } from "@/hooks/use-rail-collapsed";
import type { DocumentListResponse, DocumentSummary } from "@/lib/api/types";
import { formatIssueDateShort } from "@/lib/citations";
import type { ChatTurn } from "@/hooks/use-archive-chat";
import { cn } from "@/lib/utils";

/**
 * The left rail: this visit's questions (on Ask), and a handful of recent
 * documents as a shortcut into the assistant's scope picker.
 *
 * **Two shells, one body.** From `lg` up it is a standing column that
 * *collapses* to an icon strip (Gemini/ChatGPT style) — the choice is
 * remembered, and collapsing hands the width to the document pane on the right
 * (`globals.css`, `--rail-w` / `--panel-w`). Below `lg` there is no standing
 * column: the same `RailBody` is shown in a slide-in sheet opened from the menu
 * button (`chat-view.tsx`), so a phone gets the same list, the same "New
 * question" and the same collections rather than a lesser copy.
 *
 * The collapsed strip is a second layer over the expanded one and both stay
 * mounted, cross-fading with `opacity`. The hidden layer is `inert`, so it can
 * be neither tabbed to nor read out. The expanded layer has a fixed width and
 * is simply clipped by the shrinking column, so its text never re-wraps while
 * the width animates.
 *
 * **W4a (2026-09-17): the rail shows the current scope.** `scope` is threaded
 * down from `ChatView`, which owns it, and a scoped row carries the accent
 * check `ScopePicker`'s own `DocumentRow` uses. The scope is deliberately
 * legible in **two** places (this rail and the `ScopeBar` above the composer);
 * the rail is the standing list a reader scans, as in NotebookLM.
 *
 * The question list is this visit's conversation. Since 2026-09-30 it survives
 * a reload because the reader's browser keeps a rolling copy
 * (`use-session-persistence.ts`); the server still stores nothing.
 */
export function DocumentRail({
  turns,
  onNewChat,
  onOpenPicker,
  scope,
}: {
  turns?: ChatTurn[];
  onNewChat?: () => void;
  onOpenPicker?: () => void;
  scope?: DocumentSummary[];
}) {
  const [collapsed, setCollapsed] = useRailCollapsed();
  const scoped = (scope?.length ?? 0) > 0;

  return (
    <aside
      className={cn(
        "rail-col rule-r relative hidden shrink-0 overflow-hidden lg:block",
        "bg-[var(--sidebar)]",
      )}
    >
      {/* Expanded layer — fixed 15rem wide, clipped by the column as it shrinks. */}
      <div
        inert={collapsed}
        className={cn(
          "absolute inset-y-0 left-0 flex w-60 flex-col overflow-y-auto overscroll-contain",
          "transition-opacity duration-150 ease-[var(--ease-crisp)]",
          collapsed ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
        <div className="p-2 pb-0">
          <RailButton
            label="Collapse the sidebar"
            onClick={() => setCollapsed(true)}
            className="w-10 justify-center px-0"
          >
            <PanelLeftClose className="h-4 w-4" />
          </RailButton>
        </div>
        <RailBody
          turns={turns}
          onNewChat={onNewChat}
          onOpenPicker={onOpenPicker}
          scope={scope}
        />
      </div>

      {/* Collapsed layer — same 8px inset as the expanded toggle, so the
          toggle button does not move when the rail opens or shuts. */}
      <div
        inert={!collapsed}
        className={cn(
          "absolute inset-0 flex flex-col items-center gap-1 p-2",
          "transition-opacity duration-150 ease-[var(--ease-crisp)]",
          collapsed ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <RailButton
          label="Expand the sidebar"
          onClick={() => setCollapsed(false)}
          className="w-10 justify-center px-0"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </RailButton>
        {turns && onNewChat && (
          <RailButton
            label="New question"
            onClick={onNewChat}
            disabled={turns.length === 0}
            className="w-10 justify-center px-0"
          >
            <PenSquare className="h-4 w-4" />
          </RailButton>
        )}
        {turns && (
          <RailButton
            label={
              turns.length > 0
                ? `This session — ${turns.length} question${turns.length === 1 ? "" : "s"}`
                : "This session"
            }
            onClick={() => setCollapsed(false)}
            className="relative w-10 justify-center px-0"
          >
            <MessageSquare className="h-4 w-4" />
            {turns.length > 0 && (
              <span
                aria-hidden
                className="numeric absolute top-1 right-0.5 min-w-[1rem] rounded-full bg-[var(--accent)] px-1 text-center text-[0.625rem] leading-4 text-[var(--accent-foreground)]"
              >
                {turns.length}
              </span>
            )}
          </RailButton>
        )}
        <RailButton
          label={scoped ? "Documents — asking within a selection" : "Documents"}
          onClick={onOpenPicker ?? (() => setCollapsed(false))}
          className="relative w-10 justify-center px-0"
        >
          <Library className="h-4 w-4" />
          {scoped && (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--accent)] ring-2 ring-[var(--sidebar)]"
            />
          )}
        </RailButton>
      </div>
    </aside>
  );
}

/** A 40px rail button with a native tooltip. Icon-only when narrow. */
function RailButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-10 items-center gap-2 rounded-md text-foreground",
        "transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
        "hover:bg-secondary active:bg-secondary",
        "focus-visible:outline-2 focus-visible:outline-offset-[-2px]",
        "focus-visible:outline-[var(--accent)]",
        "disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * The rail's content, shared by the desktop column and the mobile sheet.
 * `onSelectTurn` lets the sheet close itself before scrolling to a question.
 */
export function RailBody({
  turns,
  onNewChat,
  onOpenPicker,
  scope,
  onSelectTurn,
}: {
  turns?: ChatTurn[];
  onNewChat?: () => void;
  onOpenPicker?: () => void;
  scope?: DocumentSummary[];
  /** Called after a question is chosen — the mobile sheet closes here. */
  onSelectTurn?: () => void;
}) {
  const scopedIds = new Set((scope ?? []).map((doc) => doc.document_id));

  const goToTurn = (id: string) => {
    onSelectTurn?.();
    // After the sheet's close begins, so the scroll is not fighting its lock.
    window.setTimeout(() => {
      document.getElementById(`turn-${id}`)?.scrollIntoView({ block: "start" });
    }, 0);
  };

  return (
    <>
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
                "flex min-h-[44px] w-full items-center gap-2 rounded-md px-2.5 lg:min-h-[38px]",
                "text-[0.8125rem] text-foreground transition-colors duration-[120ms]",
                "ease-[var(--ease-crisp)] hover:bg-secondary active:bg-secondary",
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
                Questions you ask are listed here, and kept on this device for a week
                after your last one.
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {turns.map((turn) => (
                  <li key={turn.id}>
                    <button
                      type="button"
                      onClick={() => goToTurn(turn.id)}
                      className={cn(
                        "flex min-h-[44px] w-full items-start gap-2 rounded-md px-2.5 py-2 text-left lg:min-h-[34px] lg:py-1.5",
                        "text-[0.8125rem] leading-snug text-foreground/85 transition-colors",
                        "duration-[120ms] ease-[var(--ease-crisp)] hover:bg-secondary active:bg-secondary",
                      )}
                    >
                      <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="line-clamp-2">{turn.question}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <div className={cn("rule-t mt-3 p-3", !turns && "flex-1")}>
        <p className="eyebrow mb-1.5 px-2.5">Collections</p>
        <RecentDocuments onOpenPicker={onOpenPicker} scopedIds={scopedIds} />
      </div>
    </>
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
      "flex min-h-[44px] w-full flex-col items-start justify-center gap-0 rounded-md px-2.5 py-1.5 lg:min-h-[34px]",
      "text-left transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
      "hover:bg-secondary",
      isScoped &&
        "border-l-2 border-[var(--accent)] bg-[var(--accent)]/[0.06] pl-2",
    );
  const footerClass = cn(
    "mt-1.5 flex min-h-[44px] w-full items-center gap-2 rounded-md px-2.5 lg:min-h-[34px]",
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
