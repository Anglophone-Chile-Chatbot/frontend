"use client";

import { Library, X } from "lucide-react";

import type { DocumentSummary } from "@/lib/api/types";
import { formatIssueDateShort } from "@/lib/citations";
import { cn } from "@/lib/utils";

/**
 * The chat's scope control, sitting directly above the composer.
 *
 * Always visible — this is what makes the mode discoverable without a tour or
 * a tooltip. It states the current scope in words rather than as an icon whose
 * meaning has to be guessed, because "which pages can this answer draw from"
 * is the single most consequential thing about a research assistant's reply.
 *
 * Two states, one control: corpus-wide reads as an invitation to narrow;
 * scoped reads as a standing constraint with a one-tap escape.
 */
export function ScopeBar({
  selected,
  onOpen,
  onClear,
  disabled = false,
}: {
  /** Documents the chat is pinned to; empty means corpus-wide. */
  selected: DocumentSummary[];
  onOpen: () => void;
  onClear: () => void;
  /** True while a turn is streaming — scope must not change mid-answer. */
  disabled?: boolean;
}) {
  const isScoped = selected.length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pt-2 sm:px-4">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onOpen}
          disabled={disabled}
          aria-label={
            isScoped
              ? `Asking within ${describe(selected)}. Change document scope`
              : "Scope questions to a document"
          }
          className={cn(
            "flex min-h-[36px] min-w-0 flex-1 items-center gap-2 rounded-md px-2",
            "text-left transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
            "hover:bg-secondary disabled:pointer-events-none disabled:opacity-55",
          )}
        >
          <Library
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              isScoped ? "text-[var(--accent)]" : "text-muted-foreground",
            )}
          />

          {isScoped ? (
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] leading-tight">
              <span className="text-muted-foreground">Asking within </span>
              <span className="font-medium text-foreground">
                {describe(selected)}
              </span>
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] leading-tight text-muted-foreground">
              Asking the whole archive
              <span className="text-foreground/45"> · pick a document</span>
            </span>
          )}
        </button>

        {isScoped && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            aria-label="Clear document scope and ask the whole archive"
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
              "text-muted-foreground transition-colors duration-[120ms]",
              "ease-[var(--ease-crisp)] hover:bg-secondary hover:text-foreground",
              "disabled:pointer-events-none disabled:opacity-55",
            )}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Name the scope the way a reader would say it.
 *
 * One document is named outright; several are counted, since a list of titles
 * would wrap and push the composer down on a 375px screen.
 */
function describe(selected: DocumentSummary[]): string {
  if (selected.length === 1) {
    const [only] = selected;
    const name = only.publication ?? only.title;
    const date = formatIssueDateShort(only.issue_date);
    return date ? `${name}, ${date}` : name;
  }
  return `${selected.length} documents`;
}
