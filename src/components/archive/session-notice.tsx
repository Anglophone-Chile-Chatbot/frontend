"use client";

import { AlertTriangle, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

import { formatRemaining } from "@/lib/session-store";
import { cn } from "@/lib/utils";

/** Under a day left, the notice stops being background and says so. */
const URGENT_MS = 24 * 60 * 60 * 1000;

/**
 * The standing answer to "is this conversation saved, and for how long?".
 *
 * The chat is kept in the reader's browser for a rolling window (see
 * `lib/session-store.ts`), and a saved conversation that quietly disappears is
 * the exact bug this replaces — so the deadline is always on screen, counting
 * down, with a thin bar draining beneath it, and turns red in its last day.
 * Each new question renews it, and the line beneath the countdown says so.
 *
 * When the browser refuses to save at all (a private window, blocked site
 * data), the notice says *that* instead of promising a save that did not
 * happen — an honest "this will be lost" beats a countdown to nothing.
 *
 * **Delete is two taps**, because on a phone it sits one thumb-width from the
 * page and a single accidental tap must not erase a research session. The
 * second tap has four seconds before it reverts.
 */
export function SessionNotice({
  remainingMs,
  windowMs,
  saveFailed,
  onDelete,
  className,
}: {
  remainingMs: number | null;
  windowMs: number;
  saveFailed: boolean;
  onDelete: () => void;
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const id = window.setTimeout(() => setConfirming(false), 4_000);
    return () => window.clearTimeout(id);
  }, [confirming]);

  if (saveFailed) {
    return (
      <div
        role="status"
        className={cn("flex items-start gap-2.5 px-4 py-2.5 sm:px-6", className)}
      >
        <AlertTriangle
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive"
          aria-hidden
        />
        <p className="text-[0.75rem] leading-snug text-muted-foreground">
          <span className="font-medium text-foreground">This browser is blocking saving.</span>{" "}
          Your questions are lost if you leave or reload this page.
        </p>
      </div>
    );
  }

  if (remainingMs === null) return null;

  const urgent = remainingMs <= URGENT_MS;
  const fraction = Math.min(1, Math.max(0, remainingMs / windowMs));

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-center gap-2.5 pl-4 pr-1 sm:pl-6 sm:pr-3">
        <Clock3
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            urgent ? "text-destructive" : "text-muted-foreground",
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1 py-1.5 leading-tight">
          <p className="numeric text-[0.8125rem] text-foreground">
            Chat deletes in{" "}
            <span
              className={cn("font-semibold tabular-nums", urgent && "text-destructive")}
            >
              {formatRemaining(remainingMs)}
            </span>
          </p>
          <p className="truncate text-[0.6875rem] text-muted-foreground">
            {urgent ? (
              <>
                Ask again to keep it
                <span className="hidden sm:inline"> for another 7 days</span>
              </>
            ) : (
              <>
                Saved on this device only
                <span className="hidden sm:inline"> · each question renews 7 days</span>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirming) {
              setConfirming(false);
              onDelete();
            } else {
              setConfirming(true);
            }
          }}
          className={cn(
            "min-h-[44px] shrink-0 rounded-md px-3 text-[0.75rem] font-medium",
            "transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
            "focus-visible:outline-2 focus-visible:outline-offset-[-2px]",
            "focus-visible:outline-[var(--accent)]",
            confirming
              ? "bg-destructive text-white"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground active:bg-secondary",
          )}
        >
          {confirming ? "Tap to confirm" : "Delete now"}
        </button>
      </div>
      {/* The rolling window itself, draining. Transform only — never width. */}
      <span aria-hidden className="absolute inset-x-0 bottom-0 block h-[2px] bg-[var(--rule)]">
        <span
          className={cn(
            "block h-full origin-left",
            urgent ? "bg-destructive" : "bg-[var(--accent)]",
          )}
          style={{ transform: `scaleX(${fraction})` }}
        />
      </span>
    </div>
  );
}
