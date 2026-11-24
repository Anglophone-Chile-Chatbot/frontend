"use client";

import { useMemo } from "react";
import ReactMarkdown, {
  type Components,
  type Options as ReactMarkdownOptions,
} from "react-markdown";
import remarkGfm from "remark-gfm";

import type { ChatSource } from "@/lib/api/types";
import { citeHastHandlers, remarkCite } from "@/lib/remark-cite";

import { CitationChip } from "./citation-chip";

/**
 * Renders an answer as real markdown (headings, bold, lists, etc.), with
 * `[CITE:id]` markers resolved into tappable citation chips inline.
 *
 * Expects `answer` to be already trimmed and normalized, and `ordinals` to
 * come from `numberCitations`, so inline chips and the Sources list share one
 * numbering pass.
 */
export function AnswerText({
  answer,
  sources,
  ordinals,
  isStreaming,
  activeChunkId,
  onOpenSource,
}: {
  answer: string;
  sources: ChatSource[];
  ordinals: ReadonlyMap<string, number>;
  isStreaming: boolean;
  activeChunkId: string | null;
  onOpenSource: (source: ChatSource) => void;
}) {
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
          const ordinal = ordinals.get(props.chunkId);
          if (!source || ordinal === undefined) return null;
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
        {answer}
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
