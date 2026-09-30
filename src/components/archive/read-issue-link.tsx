"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The way from a single cited page into reading the whole issue.
 *
 * This is how the citation path reaches the reader. The chip itself
 * deliberately does *not* navigate: a chip that routed away would trade the
 * reader's open conversation for one page — and it would also throw away the
 * passage highlight, which is the entire reason a citation opens a viewer
 * rather than a link. The viewer stays in place, and this offers the issue
 * around the page as an explicit second step.
 *
 * **Always a new tab (2026-09-30).** Opened in the same tab, this link unmounted
 * the Ask page and wiped the reader's conversation — that is what reset a
 * session mid-research. The chat is now also saved in the browser, but a
 * reader who follows a citation into a whole issue is comparing the two, so
 * the conversation stays where it is and the issue opens beside it.
 *
 * Deep-links to the page already open, so the reader lands where they were
 * rather than at page 1 and has to find their way back.
 *
 * `query` carries the reader's search term into the issue (CHUNK 3, 3e-3).
 * Arriving from a search with the term already in the reader's own box — and
 * the matching pages already marked — is the difference between continuing an
 * investigation and starting one over. Losing the query on navigation is the
 * single most common complaint about archive sites.
 */
export function ReadIssueLink({
  documentId,
  pageNumber,
  query,
  className,
}: {
  documentId: string;
  /** Null while the page is still loading and its number is not yet known. */
  pageNumber: number | null;
  /** The term the reader searched, carried into the issue. Empty for none. */
  query?: string;
  className?: string;
}) {
  const params = new URLSearchParams();
  if (pageNumber !== null) params.set("page", String(pageNumber));
  if (query && query.trim().length > 0) params.set("q", query.trim());
  const search = params.toString();
  const href = search.length > 0
    ? `/document/${documentId}?${search}`
    : `/document/${documentId}`;

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex min-h-[44px] items-center gap-1.5 text-[0.75rem]",
        "text-[var(--accent)] transition-colors duration-[120ms]",
        "ease-[var(--ease-crisp)] hover:text-foreground",
        className,
      )}
    >
      <BookOpen className="h-3.5 w-3.5" aria-hidden />
      Read the whole issue
      <span className="sr-only"> (opens in a new tab)</span>
    </Link>
  );
}
