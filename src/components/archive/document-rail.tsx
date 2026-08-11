"use client";

import { Library, MessageSquare, PenSquare } from "lucide-react";
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
}: {
  /** Omit entirely on pages with no chat state (Archive). */
  turns?: ChatTurn[];
  onNewChat?: () => void;
  /** Opens the scope picker; omitted on Archive, which links to Ask instead. */
  onOpenPicker?: () => void;
}) {
  return (
    <aside className="rule-r hidden w-60 shrink-0 flex-col overflow-y-auto bg-[var(--sidebar)] lg:flex">
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
        <RecentDocuments onOpenPicker={onOpenPicker} />
      </div>
    </aside>
  );
}

const RECENT_LIMIT = 6;

function RecentDocuments({ onOpenPicker }: { onOpenPicker?: () => void }) {
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

  const rowClass = cn(
    "flex min-h-[34px] w-full flex-col items-start gap-0 rounded-md px-2.5 py-1.5",
    "text-left transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
    "hover:bg-secondary",
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
          const label = (
            <>
              <span className="font-heading w-full truncate text-[0.8125rem] text-foreground">
                {doc.publication ?? doc.title}
              </span>
              {date && (
                <span className="numeric text-[0.6875rem] text-muted-foreground">{date}</span>
              )}
            </>
          );
          return (
            <li key={doc.document_id}>
              {/* On Ask, a row opens the scope picker in place. On Archive,
                  there is no picker to open — a row is a shortcut into Ask
                  instead, where scoping actually lives. */}
              {onOpenPicker ? (
                <button type="button" onClick={onOpenPicker} className={rowClass}>
                  {label}
                </button>
              ) : (
                <Link href="/" className={rowClass}>
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
