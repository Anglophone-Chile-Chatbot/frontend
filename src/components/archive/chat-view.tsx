"use client";

import { useCallback, useState } from "react";

import { useArchiveChat } from "@/hooks/use-archive-chat";
import type { ChatSource, DocumentSummary } from "@/lib/api/types";

import { ChatEmptyState } from "./chat-empty-state";
import { Composer } from "./composer";
import { ScopeBar } from "./scope-bar";
import { ScopePicker } from "./scope-picker";
import { SourceViewer } from "./source-viewer";
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
  const { turns, isBusy, ask, stop } = useArchiveChat();
  const [active, setActive] = useState<ChatSource | null>(null);
  const [scope, setScope] = useState<DocumentSummary[]>([]);
  const [isPickerOpen, setPickerOpen] = useState(false);

  const openSource = useCallback((source: ChatSource) => {
    setActive(source);
  }, []);

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

      <div className="rule-t bg-background/95 supports-[backdrop-filter]:backdrop-blur-sm">
        <ScopeBar
          selected={scope}
          onOpen={() => setPickerOpen(true)}
          onClear={() => setScope([])}
          // Scope must not change mid-answer: the turn in flight was already
          // retrieved under the old scope, so switching would mislabel it.
          disabled={isBusy}
        />
        <Composer onSubmit={askScoped} onStop={stop} isBusy={isBusy} />
      </div>

      <ScopePicker
        open={isPickerOpen}
        onOpenChange={setPickerOpen}
        selected={scope}
        onChange={setScope}
      />

      {/* No passage to highlight from a chat citation: the stream's `sources`
          event carries citation metadata but not chunk text. Search results do
          carry content, so the archive browser passes a passage through. */}
      <SourceViewer
        source={active}
        passage={null}
        onOpenChange={(open) => {
          if (!open) setActive(null);
        }}
      />
    </div>
  );
}
