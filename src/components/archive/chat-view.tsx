"use client";

import { useCallback, useState } from "react";

import { useArchiveChat } from "@/hooks/use-archive-chat";
import type { ChatSource, DocumentSummary } from "@/lib/api/types";

import { ChatEmptyState } from "./chat-empty-state";
import { Composer } from "./composer";
import { DocumentRail } from "./document-rail";
import { ScopeBar } from "./scope-bar";
import { ScopePicker } from "./scope-picker";
import { SourceViewer } from "./source-viewer";
import { SourceViewerPanel } from "./source-viewer-panel";
import { Transcript } from "./transcript";

/**
 * The public chatbot.
 *
 * Owns the conversation, the document scope, and the viewer selection, so a
 * citation tapped anywhere in the transcript opens the same panel. Phase 1 is
 * stateless — a reload starts a new conversation, and nothing is persisted.
 *
 * Scope lives here rather than inside the hook because it outlives any single
 * turn: it is a standing setting the reader adjusts between questions, and
 * each turn records the scope it was actually asked under.
 */
export function ChatView() {
  const { turns, isBusy, ask, stop, reset } = useArchiveChat();
  const [active, setActive] = useState<ChatSource | null>(null);
  const [scope, setScope] = useState<DocumentSummary[]>([]);
  const [isPickerOpen, setPickerOpen] = useState(false);

  const openSource = useCallback((source: ChatSource) => {
    setActive(source);
  }, []);

  // The rail's "New question" clears the transcript — close any open
  // citation too, since it would otherwise point at a turn that no longer
  // exists once the panel is reopened.
  const startNewChat = useCallback(() => {
    reset();
    setActive(null);
  }, [reset]);

  // Every question carries the scope in force when it was asked, so the
  // transcript stays truthful after the scope changes.
  const askScoped = useCallback(
    (question: string) =>
      ask(
        question,
        scope.length > 0
          ? {
              ids: scope.map((doc) => doc.document_id),
              labels: scope.map((doc) => doc.publication ?? doc.title),
            }
          : null,
      ),
    [ask, scope],
  );

  const isEmpty = turns.length === 0;

  return (
    <div className="flex min-h-0 flex-1">
      {/* Rail is a standing column from `lg` up only (Kotaemon structure);
          below that it doesn't exist — the mobile shell stays exactly as it
          was, sheet-based scope picker included. This-session-only turn list,
          no persistence: Phase 1 chat is stateless, no exceptions. */}
      <DocumentRail turns={turns} onNewChat={startNewChat} onOpenPicker={() => setPickerOpen(true)} />

      <div className="flex min-h-0 flex-1 flex-col">
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

        <div className="rule-t bg-background/95 supports-[backdrop-filter]:backdrop-blur-sm shrink-0">
          <ScopeBar
            selected={scope}
            onOpen={() => setPickerOpen(true)}
            onClear={() => setScope([])}
            // Scope must not change mid-answer: the turn in flight was
            // already retrieved under the old scope, so switching would
            // mislabel it.
            disabled={isBusy}
          />
          <Composer onSubmit={askScoped} onStop={stop} isBusy={isBusy} />
        </div>
      </div>

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
        source={active}
        passage={active?.content ?? null}
        onOpenChange={(open) => {
          if (!open) setActive(null);
        }}
      />
      <SourceViewerPanel
        source={active}
        passage={active?.content ?? null}
        onClose={() => setActive(null)}
      />
    </div>
  );
}
