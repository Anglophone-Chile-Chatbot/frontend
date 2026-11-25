"use client";

import { AlertCircle, Library, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ChatSource, QuestionIntent } from "@/lib/api/types";
import {
  formatIssueDateShort,
  normalizeCitations,
  numberCitations,
  trimPartialMarker,
  type CitationNumbering,
} from "@/lib/citations";
import type { ChatTurn } from "@/hooks/use-archive-chat";
import { sweepTopic } from "@/lib/sweep-intent";
import { editionName } from "@/lib/editions";
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
  onResolve,
}: {
  turns: ChatTurn[];
  activeChunkId: string | null;
  onOpenSource: (source: ChatSource, terms: string[]) => void;
  /** Re-ask a "Which did you mean?" turn with the name the reader tapped. */
  onResolve: (turn: ChatTurn, name: string) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const shouldFollow = useRef(true);

  const lastTurn = turns.at(-1);
  const streamedLength = lastTurn?.answer.length ?? 0;
  // A "Which did you mean?" turn and a status change (sources, Stop) grow the
  // page without adding answer text, so they are followed too (2026-11-26:
  // the clarify buttons arrived hidden behind the question box at 375 px).
  const lastStatus = lastTurn?.status;
  const clarifyCount = lastTurn?.clarify?.candidates.length ?? 0;

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
  }, [turns.length, streamedLength, lastStatus, clarifyCount]);

  return (
    <div
      ref={scrollerRef}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-7">
        <div className="flex flex-col gap-7">
          {turns.map((turn, index) => {
            const isFirstQuestion = !turns
              .slice(0, index)
              .some(
                (prev) =>
                  (prev.status === "complete" || prev.status === "stopped") &&
                  prev.answer.trim().length > 0,
              );
            return (
              <TurnBlock
                key={turn.id}
                turn={turn}
                isFirstQuestion={isFirstQuestion}
                activeChunkId={activeChunkId}
                onOpenSource={onOpenSource}
                onResolve={onResolve}
              />
            );
          })}
        </div>
        <div ref={endRef} className="h-px" />
      </div>
    </div>
  );
}

function TurnBlock({
  turn,
  isFirstQuestion,
  activeChunkId,
  onOpenSource,
  onResolve,
}: {
  turn: ChatTurn;
  isFirstQuestion: boolean;
  activeChunkId: string | null;
  onOpenSource: (source: ChatSource, terms: string[]) => void;
  onResolve: (turn: ChatTurn, name: string) => void;
}) {
  // Backend CHUNK 30. Checked defensively: saved turns come back from the
  // reader's browser storage.
  const candidates =
    turn.clarify && Array.isArray(turn.clarify.candidates) && turn.clarify.candidates.length >= 2
      ? turn.clarify.candidates.filter((c) => typeof c === "string").slice(0, 4)
      : null;
  const normalizedAnswer = useMemo(
    () => normalizeCitations(trimPartialMarker(turn.answer)),
    [turn.answer],
  );
  const numbering = useMemo(
    () => numberCitations(normalizedAnswer, turn.sources),
    [normalizedAnswer, turn.sources],
  );
  const hasAnswerText = normalizedAnswer.trim().length > 0;

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

      {candidates && (
        <ClarifyChoices candidates={candidates} onChoose={(name) => onResolve(turn, name)} />
      )}

      {turn.status === "error" ? (
        <p className="flex items-start gap-2 text-[0.875rem] leading-relaxed text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {turn.error}
        </p>
      ) : (
        hasAnswerText && (
          <div className="bg-card-answer rounded-r-lg border border-[var(--rule)] border-l-[3px] border-l-[var(--accent)] px-4 py-3.5">
            <p className="eyebrow mb-2 flex items-center gap-1.5 text-[var(--accent)]">
              <span
                className="h-[5px] w-[5px] shrink-0 rounded-full bg-[var(--accent)]"
                aria-hidden
              />
              Answer from the archive
            </p>
            <AnswerText
              answer={normalizedAnswer}
              sources={turn.sources}
              ordinals={numbering.ordinals}
              isStreaming={turn.status === "streaming"}
              activeChunkId={activeChunkId}
              onOpenSource={(source) => onOpenSource(source, turn.terms)}
            />
          </div>
        )
      )}

      {turn.status === "stopped" && hasAnswerText && (
        <p className="measure text-[0.8125rem] leading-relaxed text-muted-foreground">
          {turn.interrupted
            ? "The connection dropped before this answer finished."
            : "You stopped this answer."}
        </p>
      )}

      {turn.status === "stopped" && !hasAnswerText && (
        <p className="measure text-[0.875rem] leading-relaxed text-muted-foreground">
          {turn.sources.length > 0
            ? `${turn.interrupted ? "The connection dropped" : "Stopped"} before an answer was written. The passages it found are below.`
            : `${turn.interrupted ? "The connection dropped" : "Stopped"} before an answer was written.`}
        </p>
      )}

      {turn.status === "complete" &&
        !candidates &&
        !hasAnswerText &&
        turn.sources.length === 0 && <NoMatchNote scoped={turn.scope !== null} />}

      {turn.status !== "retrieving" && turn.status !== "error" && (
        <SearchedForNote turn={turn} isFirstQuestion={isFirstQuestion} />
      )}

      {turn.status === "complete" && !candidates && (
        <EveryMatchNote question={turn.question} intent={turn.intent} topics={turn.topics} />
      )}

      {turn.sources.length > 0 && turn.status !== "error" && (
        <SourceList
          sources={turn.sources}
          numbering={numbering}
          status={turn.status}
          hasAnswerText={hasAnswerText}
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
  numbering,
  status,
  hasAnswerText,
  terms,
  activeChunkId,
  onOpenSource,
}: {
  sources: ChatSource[];
  numbering: CitationNumbering<ChatSource>;
  status: ChatTurn["status"];
  hasAnswerText: boolean;
  terms: string[];
  activeChunkId: string | null;
  onOpenSource: (source: ChatSource, terms: string[]) => void;
}) {
  const shared = sharedPageIds(sources);
  if (status === "streaming" || status === "retrieving") {
    return (
      <div className="mt-1">
        <p className="eyebrow mb-2">Sources</p>
        <ol className="flex flex-col">
          {sources.map((source) => (
            <SourceRow
              key={source.chunk_id}
              source={source}
              showOpening={shared.has(source.page_id)}
              // The chip's number once the answer has cited it, else none:
              // arrival order would disagree with the chips mid-stream.
              ordinal={numbering.ordinals.get(source.chunk_id)}
              isActive={activeChunkId === source.chunk_id}
              onOpen={() => onOpenSource(source, terms)}
            />
          ))}
        </ol>
      </div>
    );
  }

  if (status === "stopped" && (!hasAnswerText || numbering.cited.length === 0)) {
    return (
      <div className="mt-1">
        <p className="eyebrow mb-2">Passages found</p>
        <ul className="flex flex-col">
          {sources.map((source) => (
            <SourceRow
              key={source.chunk_id}
              source={source}
              showOpening={shared.has(source.page_id)}
              isActive={activeChunkId === source.chunk_id}
              onOpen={() => onOpenSource(source, terms)}
            />
          ))}
        </ul>
      </div>
    );
  }

  if (status === "complete" && numbering.cited.length === 0) {
    return (
      <div className="mt-1">
        <p className="eyebrow mb-2">Closest matches</p>
        <p className="measure mb-2 text-[0.8125rem] leading-relaxed text-muted-foreground">
          None of these answers the question. They share search words with it and are kept in
          case they help.
        </p>
        <ul className="flex flex-col">
          {sources.map((source) => (
            <SourceRow
              key={source.chunk_id}
              source={source}
              showOpening={shared.has(source.page_id)}
              isActive={activeChunkId === source.chunk_id}
              onOpen={() => onOpenSource(source, terms)}
            />
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="mt-1">
      <p className="eyebrow mb-2">Sources</p>
      <ol className="flex flex-col">
        {numbering.cited.map((source) => (
          <SourceRow
            key={source.chunk_id}
            source={source}
            showOpening={shared.has(source.page_id)}
            ordinal={numbering.ordinals.get(source.chunk_id)}
            isActive={activeChunkId === source.chunk_id}
            onOpen={() => onOpenSource(source, terms)}
          />
        ))}
      </ol>
      {numbering.unused.length > 0 && (
        <>
          <p className="mt-3 mb-1.5 text-[0.75rem] font-medium text-muted-foreground">
            Matched the search, not used
          </p>
          <ul className="flex flex-col">
            {numbering.unused.map((source) => (
              <SourceRow
                key={source.chunk_id}
                source={source}
                showOpening={shared.has(source.page_id)}
                muted
                isActive={activeChunkId === source.chunk_id}
                onOpen={() => onOpenSource(source, terms)}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * Page ids that more than one listed passage comes from. Two passages on the
 * same page used to give two identical rows ("Chilian Times · 14 Mar 1891 ·
 * Supplement · Page 2" twice), which read as a duplicate (tester report
 * 2026-11-20); those rows now also show how each passage opens.
 */
function sharedPageIds(sources: readonly ChatSource[]): Set<string> {
  const seen = new Set<string>();
  const shared = new Set<string>();
  for (const source of sources) {
    if (seen.has(source.page_id)) shared.add(source.page_id);
    seen.add(source.page_id);
  }
  return shared;
}

/** The first words of a passage, plain text, for telling same-page rows apart. */
function passageOpening(content: string): string {
  const plain = content.replace(/[#*_>|`]+/g, " ").replace(/\s+/g, " ").trim();
  return plain.length > 72 ? `${plain.slice(0, 72).replace(/\s+\S*$/, "")}…` : plain;
}

function SourceRow({
  source,
  ordinal,
  muted = false,
  showOpening = false,
  isActive,
  onOpen,
}: {
  source: ChatSource;
  ordinal?: number;
  muted?: boolean;
  showOpening?: boolean;
  isActive: boolean;
  onOpen: () => void;
}) {
  const date = formatIssueDateShort(source.issue_date);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex min-h-[44px] w-full items-baseline gap-2.5 rounded-md",
          "px-2 py-2 text-left transition-colors duration-[120ms]",
          "ease-[var(--ease-crisp)] hover:bg-secondary",
          isActive && "bg-[var(--accent-subtle)]",
        )}
      >
        {ordinal !== undefined && (
          <span className="numeric w-4 shrink-0 text-[0.75rem] text-[var(--accent)]">
            {ordinal}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate font-heading text-[0.875rem]",
              muted ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {source.publication ?? "Unidentified publication"}
          </span>
          <span className="numeric mt-0.5 block text-[0.75rem] text-muted-foreground">
            {date ? `${date} · ` : ""}
            {editionName(source.edition) ? `${editionName(source.edition)} · ` : ""}Page {source.page_number}
            {muted && <span className="sr-only"> (not used in the answer)</span>}
          </span>
          {showOpening && source.content && (
            <span className="mt-0.5 block truncate text-[0.75rem] italic text-muted-foreground">
              {passageOpening(source.content)}
            </span>
          )}
        </span>
      </button>
    </li>
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
                      {date ? `${date} · ` : ""}
            {editionName(source.edition) ? `${editionName(source.edition)} · ` : ""}Page {source.page_number}
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

/**
 * Offered under an answer to a "find all mentions" question. Chat reads six
 * passages, which is the wrong tool for completeness; the Browse page lists
 * every match with counts. Says so plainly and links there with the search
 * already typed. The backend's verdict decides when it shows (see
 * `lib/sweep-intent.ts`).
 */
/**
 * Shown on every turn that received a `sources` frame so the reader sees how
 * the search was phrased, whether a follow-up carried context, or whether a
 * later question was treated as a new topic.
 */
/**
 * "Which did you mean?" (W9 item 8, backend CHUNK 30). The server asks only
 * when a follow-up's reference genuinely fits two or more things the last
 * answer listed, instead of guessing. One 44 px chip per name; tapping one
 * re-asks the same question with that name confirmed.
 */
function ClarifyChoices({
  candidates,
  onChoose,
}: {
  candidates: string[];
  onChoose: (name: string) => void;
}) {
  return (
    <div role="group" aria-label="Which did you mean?" className="flex flex-col gap-2">
      <p className="measure text-[0.9375rem] leading-relaxed text-foreground">
        Which did you mean?
      </p>
      <div className="flex flex-wrap gap-2">
        {candidates.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onChoose(name)}
            className={cn(
              "inline-flex min-h-[44px] max-w-full items-center rounded-md border border-[var(--rule-strong)] bg-card px-3.5",
              "text-left text-[0.875rem] text-foreground [overflow-wrap:anywhere]",
              "transition-[background-color,transform] duration-[120ms] ease-[var(--ease-crisp)]",
              "hover:bg-[var(--accent-subtle)] active:scale-[0.97] active:bg-[var(--accent-subtle)]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
              "motion-reduce:transition-none motion-reduce:active:scale-100",
            )}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function SearchedForNote({
  turn,
  isFirstQuestion,
}: {
  turn: ChatTurn;
  isFirstQuestion: boolean;
}) {
  if (turn.followUp === undefined) return null;

  const cleanedTerms = turn.terms
    .map((term) => term.trim())
    .filter((term) => term.length > 0)
    .slice(0, 5);
  const termsText = cleanedTerms.join(", ");

  let text: string;
  if (turn.followUp) {
    const standalone = turn.standalone?.trim() || turn.question.trim();
    text = `Searched for: ${standalone}`;
  } else if (isFirstQuestion) {
    text = `Searched for: ${termsText.length > 0 ? termsText : turn.question.trim()}`;
  } else {
    text =
      termsText.length > 0
        ? `Treated as a new question · Searched for: ${termsText}`
        : "Treated as a new question";
  }

  return (
    <p className="measure min-w-0 break-words text-[0.75rem] leading-relaxed text-muted-foreground">
      {text}
    </p>
  );
}

function EveryMatchNote({
  question,
  intent,
  topics,
}: {
  question: string;
  intent?: QuestionIntent | null;
  topics?: string[];
}) {
  const topic = sweepTopic(question, intent, topics);
  if (!topic) return null;
  return (
    <p className="measure text-[0.8125rem] leading-relaxed text-muted-foreground">
      This answer draws on six passages at most.{" "}
      <Link
        href={`/archive?q=${encodeURIComponent(topic)}`}
        className="inline-flex min-h-[44px] items-center font-medium text-[var(--accent)] underline-offset-2 hover:underline"
      >
        See every match for “{topic}”
      </Link>{" "}
      with counts by issue.
    </p>
  );
}
