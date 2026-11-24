"use client";

import { Menu } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useArchiveChat, type ChatTurn } from "@/hooks/use-archive-chat";
import { useArchiveFilters } from "@/hooks/use-archive-filters";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSessionPersistence } from "@/hooks/use-session-persistence";
import type { ArchiveFilterState, ChatSource, DocumentSummary } from "@/lib/api/types";
import {
  formatScopeLabel,
  hasActiveFilters,
  serializeFilterParams,
} from "@/lib/archive-filters";
import { cn } from "@/lib/utils";

import { ChatEmptyState } from "./chat-empty-state";
import { Composer } from "./composer";
import { DocumentRail, RailBody } from "./document-rail";
import { NewspaperDrawer } from "./newspaper-rail";
import { ScopeBar } from "./scope-bar";
import { ScopePicker } from "./scope-picker";
import { SessionNotice } from "./session-notice";
import { SourceViewer } from "./source-viewer";
import { SourceViewerPanel } from "./source-viewer-panel";
import { Transcript } from "./transcript";
import { UndoClearBar } from "./undo-clear-bar";

interface PendingClear {
  turns: ChatTurn[];
  scope: DocumentSummary[];
  filters: ArchiveFilterState;
}

function filtersEqual(a: ArchiveFilterState, b: ArchiveFilterState): boolean {
  return (
    a.undated === b.undated &&
    a.dateFrom === b.dateFrom &&
    a.dateTo === b.dateTo &&
    a.publications.length === b.publications.length &&
    a.publications.every((pub, i) => pub === b.publications[i])
  );
}

/**
 * The public chatbot.
 *
 * Owns the conversation, the document scope, and the viewer selection, so a
 * citation tapped anywhere in the transcript opens the same panel. The server
 * is stateless, but the reader's own browser keeps a rolling copy of the
 * conversation (`use-session-persistence.ts`), with its deadline always on
 * screen (`SessionNotice`), so a reload or a stray navigation no longer wipes
 * a research session.
 *
 * Scope lives here rather than inside the hook because it outlives any single
 * turn: it is a standing setting the reader adjusts between questions, and
 * each turn records the scope it was actually asked under.
 */
export function ChatView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { turns, isBusy, ask, stop, reset, restore } = useArchiveChat();
  const {
    filters,
    clearFilters,
    setPublication,
    setDateRange,
    selectPublicationDates,
    selectUndated,
  } = useArchiveFilters();
  const [active, setActive] = useState<ChatSource | null>(null);
  const [activeTerms, setActiveTerms] = useState<string[]>([]);
  /** Bumped on every citation open, so re-opening resets the remembered zoom. */
  const [openNonce, setOpenNonce] = useState(0);
  const [scope, setScope] = useState<DocumentSummary[]>([]);
  const [pendingClear, setPendingClear] = useState<PendingClear | null>(null);
  const [clearAnnouncement, setClearAnnouncement] = useState("");
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [isNewspapersOpen, setNewspapersOpen] = useState(false);
  const [isMenuOpen, setMenuOpen] = useState(false);

  // One viewer at a time: the docked panel from `lg`, the sheet below it. Only
  // the visible one is handed the source, so the hidden one never fetches the
  // page (or the scan) a second time.
  const isDesktop = useMediaQuery("(min-width: 64rem)");

  const persistence = useSessionPersistence({
    turns: pendingClear ? pendingClear.turns : turns,
    scope: pendingClear ? pendingClear.scope : scope,
    isBusy: isBusy || pendingClear !== null,
    onRestore: (savedTurns, savedScope) => {
      setPendingClear(null);
      restore(savedTurns);
      setScope(savedScope);
    },
    onExpired: () => {
      setPendingClear(null);
      reset();
      setActive(null);
      setActiveTerms([]);
    },
  });

  const hasFilters = hasActiveFilters(filters);
  const filterScopeLabel = hasFilters ? formatScopeLabel(filters) : null;

  const openSource = useCallback((source: ChatSource, terms: string[]) => {
    setActive(source);
    setActiveTerms(terms);
    setOpenNonce((n) => n + 1);
  }, []);

  // The rail's "New question" clears the transcript immediately and holds a
  // 10-second Undo snapshot before deleting the saved browser copy.
  const startNewChat = useCallback(() => {
    if (turns.length === 0) {
      setMenuOpen(false);
      return;
    }
    const snapshotTurns = turns.some(
      (turn) => turn.status === "retrieving" || turn.status === "streaming",
    )
      ? turns.map((turn) =>
          turn.status === "retrieving" || turn.status === "streaming"
            ? { ...turn, status: "stopped" as const }
            : turn,
        )
      : turns;
    setPendingClear({
      turns: snapshotTurns,
      scope,
      filters: { ...filters, publications: [...filters.publications] },
    });
    setClearAnnouncement("Conversation cleared. Undo available.");
    reset();
    setActive(null);
    setActiveTerms([]);
    setMenuOpen(false);
  }, [turns, scope, filters, reset]);

  const undoClear = useCallback(() => {
    if (!pendingClear) return;
    const snapshot = pendingClear;
    setPendingClear(null);
    setClearAnnouncement("Conversation restored.");
    restore(snapshot.turns);
    setScope(snapshot.scope);
    if (!filtersEqual(filters, snapshot.filters)) {
      const current = new URLSearchParams(searchParams ? searchParams.toString() : "");
      const updated = serializeFilterParams(snapshot.filters, current);
      const queryStr = updated.toString();
      router.replace(queryStr ? `${pathname}?${queryStr}` : pathname, { scroll: false });
    }
  }, [pendingClear, restore, filters, searchParams, pathname, router]);

  const commitClear = useCallback(() => {
    setPendingClear(null);
    setClearAnnouncement("");
    persistence.discard();
  }, [persistence]);

  // Immediate shared-computer deletion from SessionNotice's two-tap button.
  const deleteSessionNow = useCallback(() => {
    setPendingClear(null);
    setClearAnnouncement("");
    reset();
    persistence.discard();
    setActive(null);
    setActiveTerms([]);
    setMenuOpen(false);
  }, [reset, persistence]);

  // Every question carries the scope in force when it was asked, so the
  // transcript stays truthful after the scope changes.
  const askScoped = useCallback(
    (question: string) => {
      if (question.trim().length === 0) return;
      if (pendingClear !== null) {
        setPendingClear(null);
        setClearAnnouncement("");
        persistence.discard();
      }
      if (scope.length === 0 && !hasFilters) return ask(question, null);
      // Chosen issues and the newspaper filter both apply; the backend ANDs
      // them. Sending only one silently dropped the other.
      const labels = scope.map((doc) => doc.publication ?? doc.title);
      if (hasFilters) labels.push(formatScopeLabel(filters));
      return ask(question, {
        ids: scope.length > 0 ? scope.map((doc) => doc.document_id) : undefined,
        publications: filters.publications.length > 0 ? filters.publications : undefined,
        date_from: filters.dateFrom ?? undefined,
        date_to: filters.dateTo ?? undefined,
        undated: filters.undated || undefined,
        labels,
      });
    },
    [pendingClear, persistence, ask, scope, hasFilters, filters],
  );

  const isEmpty = turns.length === 0;
  const hasNotice =
    !isEmpty && (persistence.remainingMs !== null || persistence.saveFailed);

  return (
    <div className="flex min-h-0 flex-1">
      {/* Rail is a standing, collapsible column from `lg` up (Kotaemon
          structure). Below that the same content opens from the menu button
          in the bar above the chat, in a slide-in sheet. */}
      <DocumentRail
        turns={turns}
        onNewChat={startNewChat}
        onOpenPicker={() => setPickerOpen(true)}
        // W4a: the rail owns no scope state of its own — it is passed the same
        // array ScopeBar and ScopePicker read, so all three can never disagree
        // about what the next question is scoped to.
        scope={scope}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Menu button (below `lg`, where there is no rail) and the saved-chat
            countdown. On desktop with nothing saved there is nothing to show,
            so the bar is not rendered at all rather than left as an empty row. */}
        <div
          className={cn(
            "rule-b flex shrink-0 items-stretch",
            !hasNotice && "lg:hidden",
          )}
        >
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open the menu: your questions and documents"
            className={cn(
              "flex min-h-[44px] w-12 shrink-0 items-center justify-center lg:hidden",
              "text-foreground transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
              "hover:bg-secondary active:bg-secondary",
              "focus-visible:outline-2 focus-visible:outline-offset-[-2px]",
              "focus-visible:outline-[var(--accent)]",
            )}
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>
          {hasNotice ? (
            <SessionNotice
              className="min-w-0 flex-1"
              remainingMs={persistence.remainingMs}
              windowMs={persistence.windowMs}
              saveFailed={persistence.saveFailed}
              onDelete={deleteSessionNow}
            />
          ) : (
            <p className="flex min-h-[44px] flex-1 items-center pr-4 text-[0.75rem] text-muted-foreground lg:hidden">
              Questions are kept on this device for a week.
            </p>
          )}
        </div>

        {isEmpty ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
            <ChatEmptyState onPick={askScoped} onBrowse={() => setPickerOpen(true)} />
          </div>
        ) : (
          <Transcript
            turns={turns}
            activeChunkId={active?.chunk_id ?? null}
            onOpenSource={openSource}
          />
        )}

        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {clearAnnouncement}
        </div>

        <div className="rule-t bg-background/95 supports-[backdrop-filter]:backdrop-blur-sm shrink-0">
          {pendingClear && <UndoClearBar onUndo={undoClear} onDismiss={commitClear} />}
          <ScopeBar
            selected={scope}
            filterScopeLabel={filterScopeLabel}
            onOpen={() => setPickerOpen(true)}
            onOpenNewspapers={() => setNewspapersOpen(true)}
            onClear={() => {
              setScope([]);
              if (hasFilters) clearFilters();
            }}
            // Scope must not change mid-answer: the turn in flight was
            // already retrieved under the old scope, so switching would
            // mislabel it.
            disabled={isBusy}
          />
          <Composer onSubmit={askScoped} onStop={stop} isBusy={isBusy} />
        </div>
      </div>

      <NewspaperDrawer
        open={isNewspapersOpen}
        onOpenChange={setNewspapersOpen}
        filters={filters}
        onSelectPublication={setPublication}
        onSelectDateRange={setDateRange}
        onSelectPublicationDates={selectPublicationDates}
        onSelectUndated={selectUndated}
        onClearFilters={clearFilters}
      />

      <ScopePicker
        open={isPickerOpen}
        onOpenChange={setPickerOpen}
        selected={scope}
        onChange={setScope}
      />

      {/* The cited chunk's own text is the passage to highlight. It rides on
          the stream's `sources` event (added 2026-08-13 — before that this was
          hardcoded null, so every chat citation opened the right page and
          marked nothing, and the honest-miss note could not fire either
          because it is gated on a non-null passage).
          Below `lg`: sheet. From `lg`: SourceViewerPanel takes over as a
          docked column and this one hides itself — see SourceViewer's own
          comment for why both exist rather than one responsive component. */}
      <SourceViewer
        source={isDesktop ? null : active}
        passage={active?.content ?? null}
        terms={activeTerms}
        openNonce={openNonce}
        onOpenChange={(open) => {
          if (!open) {
            setActive(null);
            setActiveTerms([]);
          }
        }}
      />
      <SourceViewerPanel
        source={isDesktop ? active : null}
        passage={active?.content ?? null}
        terms={activeTerms}
        openNonce={openNonce}
        onClose={() => {
          setActive(null);
          setActiveTerms([]);
        }}
      />

      {/* The rail's content as a slide-in sheet, below `lg`. */}
      <Sheet open={isMenuOpen && !isDesktop} onOpenChange={setMenuOpen}>
        <SheetContent
          side="left"
          className="gap-0 overflow-y-auto overscroll-contain p-0 data-[side=left]:w-[86vw] data-[side=left]:max-w-[20rem] data-[side=left]:sm:max-w-[20rem]"
        >
          <SheetHeader className="rule-b px-4 pt-4 pb-3">
            <SheetTitle className="text-[1.0625rem]">Anglophone Chile</SheetTitle>
            <SheetDescription className="text-[0.75rem]">
              Your questions and the documents you can ask within.
            </SheetDescription>
          </SheetHeader>
          <div className="pb-safe flex flex-1 flex-col">
            <RailBody
              turns={turns}
              onNewChat={startNewChat}
              onOpenPicker={() => {
                setMenuOpen(false);
                setPickerOpen(true);
              }}
              scope={scope}
              onSelectTurn={() => setMenuOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
