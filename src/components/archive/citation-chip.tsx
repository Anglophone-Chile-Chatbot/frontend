"use client";

import type { ChatSource } from "@/lib/api/types";
import { formatIssueDateShort } from "@/lib/citations";
import { cn } from "@/lib/utils";

/**
 * An inline citation marker rendered as a tappable chip.
 *
 * Sits in the flow of the answer text, so it must not disturb the line rhythm:
 * it uses tabular figures, a baseline-aligned box, and a tap target padded out
 * to ~44px via a pseudo-element rather than real size (which would break the
 * line box on mobile).
 */
export function CitationChip({
  source,
  ordinal,
  onOpen,
  isActive = false,
}: {
  source: ChatSource;
  ordinal: number;
  onOpen: (source: ChatSource) => void;
  isActive?: boolean;
}) {
  const date = formatIssueDateShort(source.issue_date);
  const label = [
    source.publication ?? "Unidentified publication",
    date,
    `p. ${source.page_number}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={() => onOpen(source)}
      aria-label={`Citation ${ordinal}: ${label}`}
      title={label}
      className={cn(
        "relative mx-[0.15em] inline-flex min-w-[1.4em] items-center justify-center",
        "rounded-[0.25rem] px-[0.35em] py-[0.05em] align-baseline",
        "font-sans text-[0.72em] font-medium leading-none numeric",
        "transition-[background-color,color,box-shadow] duration-[120ms]",
        "ease-[var(--ease-crisp)]",
        // Expand the hit area to ~44px without affecting layout.
        "after:absolute after:left-1/2 after:top-1/2 after:h-[44px] after:w-[44px]",
        "after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']",
        isActive
          ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
          : cn(
              "bg-[var(--accent-subtle)] text-[var(--accent)]",
              "hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]",
              "active:bg-[var(--accent)] active:text-[var(--accent-foreground)]",
            ),
      )}
    >
      {ordinal}
    </button>
  );
}
