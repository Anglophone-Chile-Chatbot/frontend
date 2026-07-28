"use client";

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
 */

const STARTERS = [
  "What did the papers report about the nitrate trade?",
  "How were British merchants in Valparaíso described?",
  "Find coverage of earthquakes and their aftermath",
  "What shipping news appears in these issues?",
] as const;

export function ChatEmptyState({ onPick }: { onPick: (question: string) => void }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-10 sm:px-6">
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
    </div>
  );
}
