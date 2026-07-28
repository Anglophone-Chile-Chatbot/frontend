"use client";

import { useCallback, useState } from "react";

import { useArchiveChat } from "@/hooks/use-archive-chat";
import type { ChatSource } from "@/lib/api/types";

import { ChatEmptyState } from "./chat-empty-state";
import { Composer } from "./composer";
import { SourceViewer } from "./source-viewer";
import { Transcript } from "./transcript";

/**
 * The public chatbot.
 *
 * Owns the conversation and the viewer selection, so a citation tapped
 * anywhere in the transcript opens the same panel. Phase 1 is stateless — a
 * reload starts a new conversation, and nothing is persisted.
 */
export function ChatView() {
  const { turns, isBusy, ask, stop } = useArchiveChat();
  const [active, setActive] = useState<ChatSource | null>(null);

  const openSource = useCallback((source: ChatSource) => {
    setActive(source);
  }, []);

  const isEmpty = turns.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {isEmpty ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          <ChatEmptyState onPick={ask} />
        </div>
      ) : (
        <Transcript
          turns={turns}
          activeChunkId={active?.chunk_id ?? null}
          onOpenSource={openSource}
        />
      )}

      <Composer onSubmit={ask} onStop={stop} isBusy={isBusy} />

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
