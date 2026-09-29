"use client";

import { AlertCircle, Library, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ChatSource } from "@/lib/api/types";
import { classifySourceUse, formatIssueDateShort } from "@/lib/citations";
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
  onOpenSource: (source: ChatSource, terms: string[]) => void;
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
  onOpenSource: (source: ChatSource, terms: string[]) => void;
}) {
  return (
    <div id={`turn-${turn.id}`} className="animate-rise flex scroll-mt-4 flex-col gap-3">
      {/* The question gets its own role — a labelled rule, not a heading.
          It's user-typed text, so it takes the reading serif, never
          Playfair (a display face reserved for real titles). */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2.5">
          <span className="eyebrow shrink-0 text-muted-foreground">You asked</span>
          <span className="rule-t h-0 flex-1 translate-y-[-1px]" aria-hidden />
        </div>
        <p className="font-text-serif border-l-2 border-[var(--rule-strong)] pl-3 text-[1.0625rem] leading-snug font-semibold text-foreground sm:text-[1.125rem]">
          {turn.question}
        </p>
        {/* Scope is stamped on the turn, not read from current state, so an
            answer stays labelled with the scope it was actually asked under. */}
        {turn.scope && <ScopeMark labels={turn.scope.labels} />}
      </div>

      {turn.status === "retrieving" && <RetrievingNote scoped={turn.scope !== null} />}

      {turn.status === "error" ? (
        <p className="flex items-start gap-2 text-[0.875rem] leading-relaxed text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {turn.error}
        </p>
      ) : (
        turn.answer.length > 0 && (
          <div className="bg-card-answer rounded-r-lg border border-[var(--rule)] border-l-[3px] border-l-[var(--accent)] px-4 py-3.5">
            <p className="eyebrow mb-2 flex items-center gap-1.5 text-[var(--accent)]">
              <span
                className="h-[5px] w-[5px] shrink-0 rounded-full bg-[var(--accent)]"
                aria-hidden
              />
              Answer from the archive
            </p>
            <AnswerText
              answer={turn.answer}
              sources={turn.sources}
              isStreaming={turn.status === "streaming"}
              activeChunkId={activeChunkId}
              onOpenSource={(source) => onOpenSource(source, turn.terms)}
            />
          </div>
        )
      )}

      {turn.status === "complete" &&
        turn.answer.length === 0 &&
        turn.sources.length === 0 && <NoMatchNote scoped={turn.scope !== null} />}

      {turn.sources.length > 0 && turn.status !== "error" && (
        <SourceList
          sources={turn.sources}
          answer={turn.answer}
          isComplete={turn.status === "complete"}
          terms={turn.terms}
          activeChunkId={activeChunkId}
          onOpenSource={onOpenSource}
        />
      )}

      {turn.related.length > 0 && turn.status !== "error" && (
        <RelatedList
          related={turn.related}
          terms={turn.terms}
          activeChunkId={activeChunkId}
          onOpenSource={onOpenSource}
        />
      )}
    </div>
  );
}

/**
 * Which documents this turn was confined to.
 *
 * A quiet label rather than a chip row: it is provenance, not a control, and
 * the transcript's job is the answer. One document is named; several are
 * counted, so the line cannot wrap away the answer on a 375px screen.
 */
function ScopeMark({ labels }: { labels: string[] }) {
  const text =
    labels.length === 1 ? labels[0] : `${labels.length} selected documents`;

  return (
    <p className="flex items-center gap-1.5 text-[0.75rem] leading-tight text-muted-foreground">
      <Library className="h-3 w-3 shrink-0 text-[var(--accent)]" />
      <span className="min-w-0 truncate">Within {text}</span>
    </p>
  );
}

/** Shown between submit and the first token — the retrieval step. */
function RetrievingNote({ scoped }: { scoped: boolean }) {
  return (
    <p className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
      <span className="flex gap-1" aria-hidden>
        <Dot delay="0ms" />
        <Dot delay="120ms" />
        <Dot delay="240ms" />
      </span>
      {scoped ? "Searching the selected pages…" : "Searching the archive…"}
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

function NoMatchNote({ scoped }: { scoped: boolean }) {
  // Distinguishing the two is the point: "nothing in the archive" would be a
  // false statement when only one document was actually searched, and it hides
  // the fix, which is to widen the scope.
  return (
    <p className="measure text-[0.875rem] leading-relaxed text-muted-foreground">
      {scoped
        ? "Nothing in the selected documents matches that question. Try different terms, or clear the scope to search the whole archive."
        : "Nothing in the archive matches that question yet. Try naming a place, a publication, or a year — the collection is Chilean newspapers of the 1800s."}
    </p>
  );
}

/** The pages an answer drew on, listed under it for scanning. */
function SourceList({
  sources,
  answer,
  isComplete,
  terms,
  activeChunkId,
  onOpenSource,
}: {
  sources: ChatSource[];
  answer: string;
  isComplete: boolean;
  terms: string[];
  activeChunkId: string | null;
  onOpenSource: (source: ChatSource, terms: string[]) => void;
}) {
  const { use, cited } = classifySourceUse(
    sources.map((s) => s.chunk_id),
    answer,
    isComplete,
  );
  return (
    <div className="mt-1">
      <p className="eyebrow mb-2">{use === "none" ? "Closest matches" : "Sources"}</p>
      {use === "none" && (
        <p className="measure mb-2 text-[0.8125rem] leading-relaxed text-muted-foreground">
          None of these answers the question. They share search words with it and are kept in
          case they help.
        </p>
      )}
      {use === "some" && (
        <p className="measure mb-2 text-[0.8125rem] leading-relaxed text-muted-foreground">
          Greyed-out passages matched the search but were not used in the answer.
        </p>
      )}
      <ul className="flex flex-col">
        {sources.map((source, index) => {
          const date = formatIssueDateShort(source.issue_date);
          const isActive = activeChunkId === source.chunk_id;
          // Greyed only in a mix; when nothing was cited the heading and note
          // already say so, and greying every row would only add noise.
          const isUncited = use === "some" && !cited.has(source.chunk_id);
          return (
            <li key={source.chunk_id}>
              <button
                type="button"
                onClick={() => onOpenSource(source, terms)}
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
                  <span 
                    className={cn(
                      "block truncate font-heading text-[0.875rem]",
                      isUncited ? "text-muted-foreground" : "text-foreground"
                    )}
                  >
                    {source.publication ?? "Unidentified publication"}
                  </span>
                  <span className="numeric mt-0.5 block text-[0.75rem] text-muted-foreground">
                    {date ? `${date} · ` : ""}Page {source.page_number}
                    {isUncited && <span className="sr-only"> (not used in the answer)</span>}
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

function RelatedList({
  related,
  terms,
  activeChunkId,
  onOpenSource,
}: {
  related: ChatSource[];
  terms: string[];
  activeChunkId: string | null;
  onOpenSource: (source: ChatSource, terms: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-h-[44px] items-center gap-1.5 rounded-md px-2 -ml-2 text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        {open ? "Hide further matches" : `${related.length} further ${related.length === 1 ? "match" : "matches"}`}
      </button>
      {open && (
        <ul className="mt-2 flex flex-col gap-0.5">
          {related.map((source) => {
            const date = formatIssueDateShort(source.issue_date);
            const isActive = activeChunkId === source.chunk_id;
            return (
              <li key={source.chunk_id}>
                <button
                  type="button"
                  onClick={() => onOpenSource(source, terms)}
                  className={cn(
                    "flex min-h-[44px] w-full items-baseline gap-2.5 rounded-md",
                    "px-2 py-2 text-left transition-colors duration-[120ms]",
                    "ease-[var(--ease-crisp)] hover:bg-secondary",
                    isActive && "bg-[var(--accent-subtle)]",
                  )}
                >
                  <span className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-2">
                    <span className="block truncate font-heading text-[0.875rem] text-muted-foreground">
                      {source.publication ?? "Unidentified publication"}
                    </span>
                    <span className="numeric text-[0.75rem] text-muted-foreground">
                      {date ? `${date} · ` : ""}Page {source.page_number}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
