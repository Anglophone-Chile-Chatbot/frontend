"use client";

import { FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import type { PageDetail } from "@/lib/api/types";
import { parsePageBlocks, type PageBlock } from "@/lib/page-blocks";
import { cn } from "@/lib/utils";

/**
 * The viewer's actual content: tab switch + text/image body.
 *
 * Extracted so the mobile sheet and desktop docked panel render identically
 * from the same fetch (`useSourcePage`) — behaviour can't drift between the
 * two, only their surrounding chrome differs.
 */
export function SourceViewerBody({
  status,
  page,
  tab,
  onTabChange,
  passage,
}: {
  status: "idle" | "loading" | "error";
  page: PageDetail | null;
  tab: "text" | "image";
  onTabChange: (tab: "text" | "image") => void;
  passage: string | null;
}) {
  return (
    <>
      <ViewerTabs tab={tab} onChange={onTabChange} hasImage={page?.has_image ?? false} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 sm:px-5">
        {status === "loading" && <ViewerLoading />}
        {status === "error" && <ViewerError />}
        {status === "idle" &&
          page &&
          (tab === "text" ? (
            <PageText text={page.raw_text} passage={passage} />
          ) : (
            <PageImage pageId={page.page_id} hasImage={page.has_image} />
          ))}
      </div>
    </>
  );
}

/** Text / Image switch. Kept as buttons — two options don't warrant tabs. */
function ViewerTabs({
  tab,
  onChange,
  hasImage,
}: {
  tab: "text" | "image";
  onChange: (tab: "text" | "image") => void;
  hasImage: boolean;
}) {
  const base = cn(
    "flex min-h-[40px] flex-1 items-center justify-center gap-1.5",
    "text-[0.8125rem] font-medium transition-colors duration-[120ms]",
    "ease-[var(--ease-crisp)] border-b-2",
  );

  return (
    <div className="rule-b flex px-4 sm:px-5" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={tab === "text"}
        onClick={() => onChange("text")}
        className={cn(
          base,
          tab === "text"
            ? "border-[var(--accent)] text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
        )}
      >
        <FileText className="h-3.5 w-3.5" />
        Text
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === "image"}
        onClick={() => onChange("image")}
        className={cn(
          base,
          tab === "image"
            ? "border-[var(--accent)] text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
          !hasImage && "opacity-55",
        )}
      >
        <ImageIcon className="h-3.5 w-3.5" />
        Scan
      </button>
    </div>
  );
}

/**
 * Page text, rendered as a newspaper page rather than as a raw string.
 *
 * `pages.raw_text` is markdown produced by the ingest pipeline. This used to be
 * printed verbatim under `whitespace-pre-wrap`, which surfaced literal `###`
 * markers and turned every paragraph break into a visible blank line — it read
 * as a text dump, not a digitised page. `parsePageBlocks` recovers the heading
 * and paragraph structure so it can be typeset properly.
 *
 * Matching is exact-substring first. OCR text and the stored chunk come from
 * the same extraction, so an exact match is the common case; when it fails
 * (the chunk spans a page break, or was normalized) the text still renders,
 * just without a highlight. Nothing is faked.
 *
 * The highlight works on offsets into the *raw* string, and blocks carry their
 * source ranges, so structure and highlighting are derived from one source of
 * truth and cannot drift apart.
 */
function PageText({ text, passage }: { text: string | null; passage: string | null }) {
  const markRef = useRef<HTMLElement>(null);

  const blocks = useMemo(() => parsePageBlocks(text), [text]);

  // The cited passage as a range in the raw text; null when absent or unmatched.
  const range = useMemo(() => {
    if (!text || !passage) return null;
    const needle = passage.trim();
    if (!needle) return null;
    const index = text.indexOf(needle);
    return index === -1 ? null : { start: index, end: index + needle.length };
  }, [text, passage]);

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center", behavior: "auto" });
  }, [range, blocks]);

  if (!text || text.trim().length === 0) {
    return (
      <EmptyNote
        title="No text was extracted from this page"
        body="The scan produced no readable text — the page may be an illustration, a masthead, or too degraded for OCR."
      />
    );
  }

  return (
    <article className="font-text-serif measure pt-4 text-[0.9375rem] leading-[1.7] text-foreground/90">
      {blocks.map((block, index) => {
        const key = `${block.start}-${index}`;

        if (block.kind === "heading") {
          // Heading levels are collapsed to two visual tiers. The OCR tree's
          // depth reflects typographic size on the page, not a document
          // outline, and on an advertisement-heavy page it swings between h1
          // and h4 for what are all just advertiser names. Two tiers keep the
          // page scannable without implying a hierarchy the paper never had.
          return (
            <h3
              key={key}
              className={cn(
                "font-heading mt-5 mb-1.5 leading-snug text-foreground first:mt-0",
                block.level <= 2 ? "text-[1.0625rem]" : "text-[0.9375rem]",
              )}
            >
              <Highlighted block={block} range={range} markRef={markRef} />
            </h3>
          );
        }

        return (
          <p key={key} className="mb-3 last:mb-0">
            <Highlighted block={block} range={range} markRef={markRef} />
          </p>
        );
      })}
    </article>
  );
}

/**
 * One block's text, with the cited passage marked where it overlaps.
 *
 * The citation range is expressed in raw-text offsets and a passage can span
 * several blocks, so each block renders the intersection of its own range with
 * the citation's. The `<mark>` ref is attached to the first block that overlaps
 * — that is the one to scroll to.
 */
function Highlighted({
  block,
  range,
  markRef,
}: {
  block: PageBlock;
  range: { start: number; end: number } | null;
  markRef: React.RefObject<HTMLElement | null>;
}) {
  if (!range || range.end <= block.start || range.start >= block.end) {
    return <>{block.text}</>;
  }

  // Map the overlap into offsets within this block's own text. Headings carry
  // their `#` marker in the source range but not in `text`, so clamping keeps
  // the slice inside the rendered string.
  const markerOffset = block.end - block.start - block.text.length;
  const from = Math.max(0, range.start - block.start - markerOffset);
  const to = Math.min(block.text.length, range.end - block.start - markerOffset);

  if (to <= from) return <>{block.text}</>;

  return (
    <>
      {block.text.slice(0, from)}
      <mark
        ref={range.start >= block.start ? markRef : undefined}
        className="rounded-[0.2rem] bg-[var(--accent-subtle)] px-0.5 text-foreground"
      >
        {block.text.slice(from, to)}
      </mark>
      {block.text.slice(to)}
    </>
  );
}

/** The scan image, or an honest note when none has been ingested. */
function PageImage({ pageId, hasImage }: { pageId: string; hasImage: boolean }) {
  if (!hasImage) {
    return (
      <EmptyNote
        title="No scan image for this page"
        body="This page's text is in the archive, but its scan image has not been ingested yet."
      />
    );
  }

  return (
    <div className="pt-4">
      {/* Plain <img>: scans are proxied through a Route Handler and are not
          known to the Next image optimizer at build time. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/pages/${pageId}/image`}
        alt="Newspaper page scan"
        className="animate-fade h-auto w-full rounded-md border bg-card"
        loading="lazy"
      />
    </div>
  );
}

function ViewerLoading() {
  return (
    <div className="flex items-center gap-2 pt-8 text-sm text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      Loading the page…
    </div>
  );
}

function ViewerError() {
  return (
    <EmptyNote
      title="That page could not be loaded"
      body="The archive service did not respond. Close this panel and try the citation again."
    />
  );
}

function EmptyNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="measure pt-8">
      <h3 className="font-heading text-[0.9375rem] text-foreground">{title}</h3>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
