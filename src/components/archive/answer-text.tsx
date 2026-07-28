"use client";

import { Fragment, useMemo } from "react";

import type { ChatSource } from "@/lib/api/types";
import { parseAnswer, trimPartialMarker } from "@/lib/citations";

import { CitationChip } from "./citation-chip";

/**
 * Renders an answer with `[CITE:id]` markers resolved into citation chips.
 *
 * While streaming, a partially-arrived marker at the tail is hidden so the
 * reader never sees a raw `[CITE:8f2` fragment flicker into a chip.
 */
export function AnswerText({
  answer,
  sources,
  isStreaming,
  activeChunkId,
  onOpenSource,
}: {
  answer: string;
  sources: ChatSource[];
  isStreaming: boolean;
  activeChunkId: string | null;
  onOpenSource: (source: ChatSource) => void;
}) {
  const segments = useMemo(() => {
    const text = isStreaming ? trimPartialMarker(answer) : answer;
    return parseAnswer(text, sources);
  }, [answer, sources, isStreaming]);

  return (
    <div className="measure whitespace-pre-wrap text-[0.9375rem] leading-[1.65] text-foreground">
      {segments.map((segment, index) =>
        segment.kind === "text" ? (
          <Fragment key={index}>{segment.text}</Fragment>
        ) : (
          <CitationChip
            key={index}
            source={segment.source}
            ordinal={segment.ordinal}
            isActive={activeChunkId === segment.chunkId}
            onOpen={onOpenSource}
          />
        ),
      )}
      {isStreaming && (
        <span
          aria-hidden
          className="animate-caret ml-[0.1em] inline-block h-[1em] w-[0.5em] translate-y-[0.12em] bg-[var(--accent)]"
        />
      )}
    </div>
  );
}
