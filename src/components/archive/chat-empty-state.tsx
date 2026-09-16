"use client";

import { Library } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The opening screen, shown before the first question.
 *
 * States plainly what the archive holds and what the assistant does with it —
 * including that answers are drawn only from the scanned pages, which sets the
 * expectation that matters most for a research tool.
 *
 * The prompts are real research questions about 19th-century Chilean
 * newspapers, not filler.
 *
 * Document scope is introduced here as a second way in, phrased as a capability
 * ("narrow to a single issue") rather than a promise about what the archive
 * currently contains — nothing has been ingested yet, and the picker itself
 * says so honestly when opened.
 *
 * **W4d + W4e, done as one edit 2026-09-17** — deliberately, because both
 * planned to add copy to this same component and building them apart is how an
 * empty state turns into a wall of competing hints.
 *
 * Reading this file first (which W4d flagged as not yet done) changed the plan:
 * W4d proposed a first-visit explainer naming *two* modes, but the "Ask within
 * a single issue" button below **already** introduces the scoped mode, with its
 * own descriptor line. Adding a banner that re-announced it would have said the
 * same thing twice on the first screen a reader ever sees. So only the genuinely
 * missing half was added — the keyword-search escape hatch (W4e).
 *
 * That hatch is one muted sentence, not a card: a reader who wants to know
 * whether a word appears at all should not be made to guess that the second
 * nav item holds a plain search box, but they also should not be sold it. It
 * sits with the scope affordance under the same rule, so the two ways out of
 * "ask a question" read as one short list rather than two stacked banners.
 */

const STARTERS = [
  "What did the papers report about the nitrate trade?",
  "How were British merchants in Valparaíso described?",
  "Find coverage of earthquakes and their aftermath",
  "What shipping news appears in these issues?",
] as const;

export function ChatEmptyState({
  onPick,
  onBrowse,
}: {
  onPick: (question: string) => void;
  onBrowse: () => void;
}) {
  return (
    /* `my-auto` centres this block only while there is room to spare. Unlike
       `justify-center` on the flex parent, auto margins never push content
       past the scroll container's top edge, so on a short viewport the block
       simply scrolls instead of bleeding out of both ends — which is what hid
       the eyebrow behind the header and slid the last row under the composer. */
    <div className="mx-auto my-auto flex w-full max-w-3xl flex-col px-4 py-10 sm:px-6">
      <p className="eyebrow">The Anglophone Chile Archive</p>

      <h1 className="mt-3 font-heading text-[1.75rem] leading-[1.15] text-foreground sm:text-[2.25rem]">
        Ask the nineteenth-century
        <br />
        Chilean press.
      </h1>

      <p className="measure mt-4 text-[0.9375rem] leading-relaxed text-muted-foreground">
        A searchable collection of scanned Chilean newspapers from the 1800s.
        Questions are answered only from the pages themselves, and every claim
        carries a citation you can open and read in the original.
      </p>

      <div className="mt-8">
        <p className="eyebrow mb-3">Try asking</p>
        <ul className="flex flex-col gap-1.5">
          {STARTERS.map((starter) => (
            <li key={starter}>
              <button
                type="button"
                onClick={() => onPick(starter)}
                className={cn(
                  "group flex min-h-[44px] w-full items-center gap-3 rounded-md",
                  "rule-t px-2 py-2.5 text-left",
                  "transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
                  "hover:bg-secondary",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-1 w-1 shrink-0 rounded-full bg-[var(--rule-strong)] opacity-40",
                    "transition-[background-color,opacity] duration-[120ms]",
                    "group-hover:bg-[var(--accent)] group-hover:opacity-100",
                  )}
                />
                <span className="text-[0.875rem] leading-snug text-foreground/85">
                  {starter}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rule-t mt-8 pt-4">
        <button
          type="button"
          onClick={onBrowse}
          className={cn(
            "group flex min-h-[44px] w-full items-center gap-3 rounded-md px-2 py-2",
            "text-left transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
            "hover:bg-secondary",
          )}
        >
          <Library className="h-4 w-4 shrink-0 text-muted-foreground transition-colors duration-[120ms] group-hover:text-[var(--accent)]" />
          <span className="min-w-0">
            <span className="block text-[0.875rem] leading-snug text-foreground/85">
              Ask within a single issue
            </span>
            <span className="mt-0.5 block text-[0.75rem] leading-snug text-muted-foreground">
              Pin the assistant to one document so it answers only from those
              pages.
            </span>
          </span>
        </button>

        {/* W4e: the plain-search escape hatch. Browse already contains a
            keyword search that never touches the LLM, but the header names it
            only "Browse", so a reader landing on a chat composer has no way to
            know it is there — which is precisely how it was missed.

            One muted sentence, no card and no icon, deliberately: this is a
            signpost for the reader who wants a word rather than an answer, not
            a second product being pitched. It is a link to /archive and
            explicitly NOT a second search box on this page — that would
            recreate the two-search-boxes confusion CHUNK 3 removed when it
            renamed Archive to Browse and inverted that page. */}
        <p className="mt-1 px-2 text-[0.75rem] leading-relaxed text-muted-foreground">
          Looking for a word rather than an answer?{" "}
          <Link
            href="/archive"
            className={cn(
              "text-foreground/80 underline decoration-[var(--rule-strong)]",
              "underline-offset-[3px] transition-colors duration-[120ms]",
              "ease-[var(--ease-crisp)] hover:text-[var(--accent)]",
              "hover:decoration-[var(--accent)]",
              // Measured at 375px, not assumed: the inline link's own box is
              // 30px, under the 44px tap minimum. `inline-flex` + a min-height
              // gives the anchor a real 44px hit area, and the matching
              // negative block margin keeps the surrounding sentence's line
              // rhythm unchanged so the paragraph does not grow a gap.
              "inline-flex min-h-[44px] items-center align-middle",
              "-my-[7px]",
            )}
          >
            Search the archive
          </Link>{" "}
          for it directly.
        </p>
      </div>
    </div>
  );
}
