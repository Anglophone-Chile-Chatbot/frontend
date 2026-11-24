"use client";

import type { ChatSource } from "@/lib/api/types";
import { formatIssueDateShort } from "@/lib/citations";
import { editionName } from "@/lib/editions";
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
    editionName(source.edition),
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
        // Left margin only: the chip is a footnote mark, so it sits tight
        // against the following punctuation rather than floating between the
        // word and the period.
        "cite-chip relative ml-[0.15em] inline-flex min-w-[1.6em] items-center justify-center",
        "rounded-[0.25rem] px-[0.35em] py-[0.05em] align-baseline",
        "font-sans text-[0.72em] font-medium leading-none numeric",
        "transition-[background-color,color,box-shadow] duration-[120ms]",
        "ease-[var(--ease-crisp)]",
        // Expand the hit area to 44px TALL without affecting layout, but only a
        // little wider than the chip. It used to be 44px wide too, centred, and
        // adjacent chips sit ~17px apart, so each chip's hit area covered its
        // left neighbour's centre: tapping "1" in "1234" opened citation 2
        // (live phone check 2026-11-24, 7 of 12 chips). Adjacent chips also get
        // a small gap, so their hit areas never overlap.
        "after:absolute after:-inset-x-[0.3em] after:top-1/2 after:h-[44px]",
        "after:-translate-y-1/2 after:content-['']",
        "[.cite-chip+&]:ml-[0.4em]",
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
