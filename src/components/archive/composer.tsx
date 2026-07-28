"use client";

import { ArrowUp, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  MAX_PROMPT_CHARS,
  PROMPT_COUNTER_THRESHOLD,
} from "@/lib/validation";

/**
 * True when the device uses a touch keyboard, where Enter must insert a
 * newline rather than submit — otherwise the field becomes unusable.
 *
 * Read at keypress time rather than held in state: the answer is only needed
 * inside the handler, and a media query read is cheap.
 */
function isTouchKeyboard(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

/**
 * The question input.
 *
 * A textarea rather than an input, because research questions run long and
 * wrap. It auto-grows to a capped height so the transcript stays visible on a
 * 375px screen. Enter submits; Shift+Enter inserts a newline — but only on
 * pointer-precise devices, since on touch keyboards Enter must insert a
 * newline or the field becomes impossible to use.
 */
export function Composer({
  onSubmit,
  onStop,
  isBusy,
  autoFocus = false,
}: {
  onSubmit: (question: string) => void;
  onStop: () => void;
  isBusy: boolean;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow: reset then measure, so the box shrinks back when text is cut.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const trimmed = value.trim();
  const isOverLimit = trimmed.length > MAX_PROMPT_CHARS;
  const canSubmit = trimmed.length > 0 && !isOverLimit && !isBusy;

  function submit() {
    if (!canSubmit) return;
    onSubmit(trimmed);
    setValue("");
  }

  return (
    <div className="rule-t bg-background/95 pb-safe supports-[backdrop-filter]:backdrop-blur-sm">
      <div className="mx-auto w-full max-w-3xl px-3 py-3 sm:px-4">
        <div
          className={cn(
            "flex items-end gap-2 rounded-lg border bg-card p-2",
            "transition-[border-color,box-shadow] duration-[120ms] ease-[var(--ease-crisp)]",
            "focus-within:border-[var(--accent)]",
            isOverLimit && "border-destructive",
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            autoFocus={autoFocus}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !isTouchKeyboard() &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Ask about the archive…"
            aria-label="Ask a question about the archive"
            className={cn(
              "flex-1 resize-none bg-transparent px-1.5 py-1.5",
              // 16px minimum prevents iOS Safari from zooming on focus.
              "text-base leading-[1.5] outline-none sm:text-[0.9375rem]",
              "placeholder:text-muted-foreground",
            )}
          />

          <button
            type="button"
            onClick={isBusy ? onStop : submit}
            disabled={!isBusy && !canSubmit}
            aria-label={isBusy ? "Stop generating" : "Send question"}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
              "transition-[background-color,opacity,transform] duration-[120ms]",
              "ease-[var(--ease-crisp)] active:scale-[0.94]",
              isBusy
                ? "bg-secondary text-secondary-foreground hover:bg-[var(--accent-subtle)]"
                : cn(
                    "bg-[var(--accent)] text-[var(--accent-foreground)]",
                    "disabled:bg-secondary disabled:text-muted-foreground",
                    "disabled:cursor-not-allowed disabled:active:scale-100",
                  ),
            )}
          >
            {isBusy ? (
              <Square className="h-3.5 w-3.5 fill-current" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-3 px-1">
          <p className="text-[0.6875rem] leading-tight text-muted-foreground">
            Answers cite the pages they draw from. Tap a number to read the
            original.
          </p>
          {trimmed.length > PROMPT_COUNTER_THRESHOLD && (
            <span
              className={cn(
                "numeric shrink-0 text-[0.6875rem] tabular-nums",
                isOverLimit ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {trimmed.length}/{MAX_PROMPT_CHARS}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
