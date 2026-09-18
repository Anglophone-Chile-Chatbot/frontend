"use client";

import { useMemo } from "react";
import ReactMarkdown, {
  type Components,
  type Options as ReactMarkdownOptions,
} from "react-markdown";
import remarkGfm from "remark-gfm";

import type { ChatSource } from "@/lib/api/types";
import { assignCitationOrdinals, trimPartialMarker } from "@/lib/citations";
import { citeHastHandlers, remarkCite } from "@/lib/remark-cite";

import { CitationChip } from "./citation-chip";

/**
 * Renders an answer as real markdown (headings, bold, lists, etc.), with
 * `[CITE:id]` markers resolved into tappable citation chips inline.
 *
 * Citation parsing happens inside the markdown AST via `remarkCite`, not as a
 * separate text-splitting pass — that's what lets a marker sit mid-sentence
 * or inside a list item and still render correctly alongside real formatting.
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
  // Trimmed whether streaming or not: an unclosed `[CITE:` tail is hidden
  // mid-stream so it never flickers on screen, and left trimmed if the
  // stream hangs up before the marker closes (upstream cutoff) — a dangling
  // `[CITE:8f2` fragment should never render as raw text either way.
  const text = trimPartialMarker(answer);
  const ordinals = useMemo(() => assignCitationOrdinals(text), [text]);
  const byId = useMemo(
    () => new Map(sources.map((source) => [source.chunk_id, source])),
    [sources],
  );

  // `remark-cite`'s mdast `cite` node is converted to a `cite-chunk` hast
  // tag by `citeHastHandlers` (see remark-cite.ts) before it reaches
  // react-markdown's component-override matching, which keys off hast tag
  // names, not mdast node types. Both `Components` and `remarkRehypeOptions`
  // are typed against closed, pre-built unions of markdown's built-in node
  // types (react-markdown's own .d.ts, and mdast-util-to-hast's Handlers) —
  // hence the casts, verified correct against the actual hast tree produced
  // (see commit message / plans.md).
  const components = useMemo(
    () =>
      ({
        "cite-chunk": (props: { chunkId: string }) => {
          const source = byId.get(props.chunkId);
          if (!source) return null;
          const ordinal = ordinals.get(props.chunkId) ?? 0;
          return (
            <CitationChip
              source={source}
              ordinal={ordinal}
              isActive={activeChunkId === props.chunkId}
              onOpen={onOpenSource}
            />
          );
        },
      }) as unknown as Components,
    [byId, ordinals, activeChunkId, onOpenSource],
  );

  return (
    <div className="font-text-serif measure prose-answer text-[0.9375rem] leading-[1.65] text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCite]}
        remarkRehypeOptions={
          { handlers: citeHastHandlers } as ReactMarkdownOptions["remarkRehypeOptions"]
        }
        components={components}
      >
        {text}
      </ReactMarkdown>
      {isStreaming && (
        <span
          aria-hidden
          className="animate-caret ml-[0.1em] inline-block h-[1em] w-[0.5em] translate-y-[0.12em] bg-[var(--accent)]"
        />
      )}
    </div>
  );
}
