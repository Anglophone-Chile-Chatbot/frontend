"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The way from a single cited page into reading the whole issue.
 *
 * This is how the citation path reaches the reader. The chip itself
 * deliberately does *not* navigate: Phase 1 chat is stateless and holds the
 * transcript in memory only, so a chip that routed away would trade the
 * reader's whole conversation for one page — and it would also throw away the
 * passage highlight, which is the entire reason a citation opens a viewer
 * rather than a link. The viewer stays in place, and this offers the issue
 * around the page as an explicit second step.
 *
 * Deep-links to the page already open, so the reader lands where they were
 * rather than at page 1 and has to find their way back.
 */
export function ReadIssueLink({
  documentId,
  pageNumber,
  className,
}: {
  documentId: string;
  /** Null while the page is still loading and its number is not yet known. */
  pageNumber: number | null;
  className?: string;
}) {
  const href =
    pageNumber === null
      ? `/document/${documentId}`
      : `/document/${documentId}?page=${pageNumber}`;

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-[44px] items-center gap-1.5 text-[0.75rem]",
        "text-[var(--accent)] transition-colors duration-[120ms]",
        "ease-[var(--ease-crisp)] hover:text-foreground",
        className,
      )}
    >
      <BookOpen className="h-3.5 w-3.5" aria-hidden />
      Read the whole issue
    </Link>
  );
}
