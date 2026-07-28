"use client";

import { FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ChatSource, PageDetail } from "@/lib/api/types";
import { formatIssueDate } from "@/lib/citations";
import { cn } from "@/lib/utils";

/**
 * The document viewer.
 *
 * Opens when a citation chip or search result is tapped, showing the cited
 * page's extracted text with the cited passage highlighted and scrolled into
 * view. Per CLAUDE.md, text is the default view on mobile and the scan image
 * is one tap away.
 *
 * A bottom sheet on mobile and a right-hand panel from `sm` up — the same
 * component, so behaviour can't drift between breakpoints.
 */
export function SourceViewer({
  source,
  passage,
  onOpenChange,
}: {
  /** The page to show; `null` closes the viewer. */
  source: ChatSource | null;
  /** Cited chunk text, highlighted within the page when found. */
  passage?: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const pageId = source?.page_id ?? null;
  const [page, setPage] = useState<PageDetail | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">(
    pageId ? "loading" : "idle",
  );
  const [tab, setTab] = useState<"text" | "image">("text");

  // Reset when the viewer moves to a different page, so a slow request can
  // never paint over newer content. Done during render rather than in an
  // effect: an effect would show one frame of the previous page's text.
  // Seeded with `null` so a viewer that mounts already open still takes the
  // reset path and shows its loading state.
  const [renderedPageId, setRenderedPageId] = useState<string | null>(null);
  if (pageId !== renderedPageId) {
    setRenderedPageId(pageId);
    setPage(null);
    setStatus(pageId ? "loading" : "idle");
    setTab("text");
  }

  useEffect(() => {
    if (!pageId) return;

    const controller = new AbortController();
    fetch(`/api/pages/${pageId}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<PageDetail>;
      })
      .then((detail) => {
        setPage(detail);
        setStatus("idle");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      });

    return () => controller.abort();
  }, [pageId]);

  const dateline = page ? formatIssueDate(page.issue_date) : null;
  const publication = page?.publication ?? source?.publication ?? null;

  return (
    <Sheet open={source !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "h-[85dvh] rounded-t-xl p-0",
          // From sm up it becomes a right-hand reading panel.
          "sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:w-[min(30rem,90vw)]",
          "sm:max-w-none sm:rounded-none sm:border-l",
        )}
      >
        <SheetHeader className="rule-b gap-1 px-4 pt-4 pb-3 sm:px-5">
          <SheetTitle className="text-[1.0625rem] leading-snug">
            {publication ?? "Unidentified publication"}
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8125rem]">
            {dateline && <time className="numeric">{dateline}</time>}
            {dateline && <span aria-hidden>·</span>}
            <span className="numeric">
              Page {source?.page_number ?? page?.page_number}
              {page ? ` of ${page.document_page_count}` : ""}
            </span>
          </SheetDescription>
        </SheetHeader>

        <ViewerTabs tab={tab} onChange={setTab} hasImage={page?.has_image ?? false} />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 sm:px-5">
          {status === "loading" && <ViewerLoading />}
          {status === "error" && <ViewerError />}
          {status === "idle" &&
            page &&
            (tab === "text" ? (
              <PageText text={page.raw_text} passage={passage ?? null} />
            ) : (
              <PageImage pageId={page.page_id} hasImage={page.has_image} />
            ))}
        </div>
      </SheetContent>
    </Sheet>
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
 * Page text with the cited passage highlighted and scrolled to.
 *
 * Matching is exact-substring first. OCR text and the stored chunk come from
 * the same extraction, so an exact match is the common case; when it fails
 * (the chunk spans a page break, or was normalized) the text still renders,
 * just without a highlight. Nothing is faked.
 */
function PageText({ text, passage }: { text: string | null; passage: string | null }) {
  const markRef = useRef<HTMLElement>(null);

  const parts = useMemo(() => {
    if (!text) return null;
    if (!passage) return { before: text, match: "", after: "" };

    const needle = passage.trim();
    const index = needle.length > 0 ? text.indexOf(needle) : -1;
    if (index === -1) return { before: text, match: "", after: "" };

    return {
      before: text.slice(0, index),
      match: text.slice(index, index + needle.length),
      after: text.slice(index + needle.length),
    };
  }, [text, passage]);

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center", behavior: "auto" });
  }, [parts]);

  if (!text || text.trim().length === 0) {
    return (
      <EmptyNote
        title="No text was extracted from this page"
        body="The scan produced no readable text — the page may be an illustration, a masthead, or too degraded for OCR."
      />
    );
  }

  return (
    <article className="measure pt-4 font-sans text-[0.9375rem] leading-[1.7] whitespace-pre-wrap text-foreground/90">
      {parts?.before}
      {parts?.match && (
        <mark
          ref={markRef}
          className="rounded-[0.2rem] bg-[var(--accent-subtle)] px-0.5 text-foreground"
        >
          {parts.match}
        </mark>
      )}
      {parts?.after}
    </article>
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
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}
