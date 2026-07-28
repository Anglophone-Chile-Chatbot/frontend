"use client";

import { AlertCircle } from "lucide-react";
import { useEffect, useRef } from "react";

import type { ChatSource } from "@/lib/api/types";
import { formatIssueDateShort } from "@/lib/citations";
import type { ChatTurn } from "@/hooks/use-archive-chat";
import { cn } from "@/lib/utils";

import { AnswerText } from "./answer-text";

/**
 * The question-and-answer transcript.
 *
 * Follows the stream while the user is at the bottom, but stops following the
 * moment they scroll up to read — auto-scroll that fights the reader is worse
 * than none.
 */
export function Transcript({
  turns,
  activeChunkId,
  onOpenSource,
}: {
  turns: ChatTurn[];
  activeChunkId: string | null;
  onOpenSource: (source: ChatSource) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const shouldFollow = useRef(true);

  const lastTurn = turns.at(-1);
  const streamedLength = lastTurn?.answer.length ?? 0;

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const onScroll = () => {
      const distanceFromBottom =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      shouldFollow.current = distanceFromBottom < 80;
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (shouldFollow.current) {
      endRef.current?.scrollIntoView({ block: "end" });
    }
  }, [turns.length, streamedLength]);

  return (
    <div
      ref={scrollerRef}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-7">
        <div className="flex flex-col gap-7">
          {turns.map((turn) => (
            <TurnBlock
              key={turn.id}
              turn={turn}
              activeChunkId={activeChunkId}
              onOpenSource={onOpenSource}
            />
          ))}
        </div>
        <div ref={endRef} className="h-px" />
      </div>
    </div>
  );
}

function TurnBlock({
  turn,
  activeChunkId,
  onOpenSource,
}: {
  turn: ChatTurn;
  activeChunkId: string | null;
  onOpenSource: (source: ChatSource) => void;
}) {
  return (
    <div className="animate-rise flex flex-col gap-3">
      <h2 className="font-heading text-[1.0625rem] leading-snug text-foreground sm:text-[1.125rem]">
        {turn.question}
      </h2>

      {turn.status === "retrieving" && <RetrievingNote />}

      {turn.status === "error" ? (
        <p className="flex items-start gap-2 text-[0.875rem] leading-relaxed text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {turn.error}
        </p>
      ) : (
        turn.answer.length > 0 && (
          <AnswerText
            answer={turn.answer}
            sources={turn.sources}
            isStreaming={turn.status === "streaming"}
            activeChunkId={activeChunkId}
            onOpenSource={onOpenSource}
          />
        )
      )}

      {turn.status === "complete" &&
        turn.answer.length === 0 &&
        turn.sources.length === 0 && <NoMatchNote />}

      {turn.sources.length > 0 && turn.status !== "error" && (
        <SourceList
          sources={turn.sources}
          activeChunkId={activeChunkId}
          onOpenSource={onOpenSource}
        />
      )}
    </div>
  );
}

/** Shown between submit and the first token — the retrieval step. */
function RetrievingNote() {
  return (
    <p className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
      <span className="flex gap-1" aria-hidden>
        <Dot delay="0ms" />
        <Dot delay="120ms" />
        <Dot delay="240ms" />
      </span>
      Searching the archive…
    </p>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1 w-1 rounded-full bg-[var(--accent)] opacity-40"
      style={{ animation: `caret 900ms ${delay} steps(1,end) infinite` }}
    />
  );
}

function NoMatchNote() {
  return (
    <p className="measure text-[0.875rem] leading-relaxed text-muted-foreground">
      Nothing in the archive matches that question yet. Try naming a place, a
      publication, or a year — the collection is Chilean newspapers of the
      1800s.
    </p>
  );
}

/** The pages an answer drew on, listed under it for scanning. */
function SourceList({
  sources,
  activeChunkId,
  onOpenSource,
}: {
  sources: ChatSource[];
  activeChunkId: string | null;
  onOpenSource: (source: ChatSource) => void;
}) {
  return (
    <div className="mt-1">
      <p className="eyebrow mb-2">Sources</p>
      <ul className="flex flex-col">
        {sources.map((source, index) => {
          const date = formatIssueDateShort(source.issue_date);
          const isActive = activeChunkId === source.chunk_id;
          return (
            <li key={source.chunk_id}>
              <button
                type="button"
                onClick={() => onOpenSource(source)}
                className={cn(
                  "flex min-h-[44px] w-full items-baseline gap-2.5 rounded-md",
                  "px-2 py-2 text-left transition-colors duration-[120ms]",
                  "ease-[var(--ease-crisp)] hover:bg-secondary",
                  isActive && "bg-[var(--accent-subtle)]",
                )}
              >
                <span className="numeric w-4 shrink-0 text-[0.75rem] text-[var(--accent)]">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-heading text-[0.875rem] text-foreground">
                    {source.publication ?? "Unidentified publication"}
                  </span>
                  <span className="numeric mt-0.5 block text-[0.75rem] text-muted-foreground">
                    {date ? `${date} · ` : ""}Page {source.page_number}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
