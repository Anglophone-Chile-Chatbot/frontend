"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Timed bar shown after "New question" clears the transcript, giving the
 * reader 10 seconds to restore the conversation and its scope before the saved
 * browser copy is deleted. Sits in the bottom dock flow above ScopeBar so it
 * never covers the question input on a 375px phone.
 */
export function UndoClearBar({
  onUndo,
  onDismiss,
  durationMs = 10_000,
}: {
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
}) {
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(durationMs);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  // Pause the auto-dismiss timer while focus is inside the bar so keyboard and
  // assistive-tech users do not lose the Undo button mid-focus.
  useEffect(() => {
    if (paused) return;
    const startedAt = Date.now();
    const timeout = Math.max(0, remainingRef.current);
    const id = window.setTimeout(() => {
      remainingRef.current = 0;
      onDismissRef.current();
    }, timeout);
    return () => {
      window.clearTimeout(id);
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (Date.now() - startedAt),
      );
    };
  }, [paused]);

  return (
    <div
      role="region"
      aria-label="Conversation cleared"
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setPaused(false);
        }
      }}
      className="animate-rise rule-b bg-card-answer"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-2 px-3 py-0.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-[0.8125rem] leading-snug text-foreground">
            Conversation cleared
          </span>
          <span aria-hidden className="text-muted-foreground">
            ·
          </span>
          <button
            type="button"
            onClick={onUndo}
            className={cn(
              "inline-flex min-h-[44px] shrink-0 items-center rounded-md px-3",
              "text-[0.8125rem] font-medium text-[var(--accent)]",
              "transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
              "hover:bg-[var(--accent-subtle)] active:bg-[var(--accent-subtle)]",
              "focus-visible:outline-2 focus-visible:outline-offset-[-2px]",
              "focus-visible:outline-[var(--accent)]",
            )}
          >
            Undo
          </button>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-md",
            "text-muted-foreground transition-colors duration-[120ms]",
            "ease-[var(--ease-crisp)] hover:bg-secondary hover:text-foreground",
            "active:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-[-2px]",
            "focus-visible:outline-[var(--accent)]",
          )}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
