"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ChatTurn } from "@/hooks/use-archive-chat";
import type { DocumentSummary } from "@/lib/api/types";
import {
  clearSession,
  loadSession,
  saveSession,
  SESSION_KEY,
  SESSION_TTL_MS,
} from "@/lib/session-store";

/**
 * Keeps the Ask conversation in the reader's browser and reports how long it
 * has left. See `lib/session-store.ts` for what is stored and why.
 *
 * Three rules this hook holds to, each one a bug waiting otherwise:
 *
 * - **Nothing is written before the restore has run.** The first render has no
 *   turns; saving that would delete the very session about to be restored.
 * - **Only a new question moves the deadline.** Re-saving the restored turns,
 *   or changing the document scope, keeps the existing expiry. Otherwise
 *   opening the site would renew a session forever.
 * - **Nothing is written mid-stream** — except on the way out (tab hidden or
 *   closing), so a reload during an answer keeps the earlier turns.
 *
 * Two tabs: an idle tab follows a newer save from the other one; a tab with
 * its own unsaved questions keeps them and the later save wins.
 */
export interface SessionPersistence {
  /** Ms until the saved session is deleted; `null` when nothing is saved. */
  remainingMs: number | null;
  /** True when the browser refused the save, so the UI must not promise one. */
  saveFailed: boolean;
  /** The full window, for drawing how much of it is left. */
  windowMs: number;
  /** Delete the saved copy now (the caller resets the visible chat). */
  discard: () => void;
}

export function useSessionPersistence({
  turns,
  scope,
  isBusy,
  onRestore,
  onExpired,
}: {
  turns: ChatTurn[];
  scope: DocumentSummary[];
  isBusy: boolean;
  onRestore: (turns: ChatTurn[], scope: DocumentSummary[]) => void;
  /** The saved session ran out, or was deleted in another tab. */
  onExpired: () => void;
}): SessionPersistence {
  const [hydrated, setHydrated] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [now, setNow] = useState(0);

  const latest = useRef({ turns, scope });
  const expiresAtRef = useRef<number | null>(null);
  /** The turns array last written or restored, to tell a new question from a re-save. */
  const baseline = useRef<ChatTurn[] | null>(null);

  const onRestoreRef = useRef(onRestore);
  const onExpiredRef = useRef(onExpired);
  useEffect(() => {
    latest.current = { turns, scope };
    onRestoreRef.current = onRestore;
    onExpiredRef.current = onExpired;
  });

  const persist = useCallback(() => {
    const { turns: current, scope: currentScope } = latest.current;
    if (current.length === 0) {
      // Nothing to save. Only delete the stored copy if *this* tab had put
      // something there: a tab that never held a conversation must not wipe
      // the one another tab saved (an idle tab changing its scope would).
      if (baseline.current === null) return;
      clearSession();
      expiresAtRef.current = null;
      baseline.current = null;
      setExpiresAt(null);
      setSaveFailed(false);
      return;
    }

    const isNewActivity = current !== baseline.current;
    const at =
      isNewActivity || expiresAtRef.current === null
        ? Date.now() + SESSION_TTL_MS
        : expiresAtRef.current;

    const ok = saveSession(current, currentScope, at);
    setSaveFailed(!ok);
    if (ok) {
      baseline.current = current;
      expiresAtRef.current = at;
      setExpiresAt(at);
      setNow(Date.now());
    }
  }, []);

  // Restore once, after mount — reading storage during render would make the
  // server HTML and the client HTML disagree.
  useEffect(() => {
    // Deferred one tick: storage is an external system, and the restore sets
    // state from it, which must not happen inside the effect's own commit.
    const id = window.setTimeout(() => {
      const saved = loadSession();
      if (saved) {
        baseline.current = saved.turns;
        expiresAtRef.current = saved.expiresAt;
        onRestoreRef.current(saved.turns, saved.scope);
        setExpiresAt(saved.expiresAt);
        setNow(Date.now());
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // Save when a turn settles, or when the scope changes between questions.
  useEffect(() => {
    if (!hydrated || isBusy) return;
    persist();
  }, [hydrated, isBusy, turns, scope, persist]);

  // Save on the way out, even mid-stream, so a reload keeps earlier turns.
  useEffect(() => {
    if (!hydrated) return;
    // Only when this tab has something new. A tab that merely showed what it
    // restored must not overwrite a newer session another tab has saved since.
    const flush = () => {
      const { turns: current } = latest.current;
      if (current.length > 0 && current !== baseline.current) persist();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
      else setNow(Date.now());
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hydrated, persist]);

  // The saved copy was deleted in another tab: follow it.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_KEY && event.newValue !== null) {
        // Another tab saved a newer session. An idle tab (nothing new of its
        // own) follows it, so two open tabs never drift apart. A tab with its
        // own unsaved questions keeps them: that one saves next, and wins.
        const { turns: current } = latest.current;
        if (current.length > 0 && current !== baseline.current) return;
        const saved = loadSession();
        if (!saved) return;
        baseline.current = saved.turns;
        expiresAtRef.current = saved.expiresAt;
        onRestoreRef.current(saved.turns, saved.scope);
        setExpiresAt(saved.expiresAt);
        setNow(Date.now());
        return;
      }
      if (event.key === SESSION_KEY && event.newValue === null) {
        expiresAtRef.current = null;
        baseline.current = null;
        setExpiresAt(null);
        onExpiredRef.current();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // The countdown. Once a minute is enough until the last minute, when it
  // counts seconds so the reader can see it moving.
  useEffect(() => {
    if (expiresAt === null) return;
    const left = expiresAt - Date.now();
    if (left <= 0) {
      clearSession();
      expiresAtRef.current = null;
      baseline.current = null;
      // Deferred: an expiry must not set state during this effect's own commit.
      const id = window.setTimeout(() => {
        setExpiresAt(null);
        onExpiredRef.current();
      }, 0);
      return () => window.clearTimeout(id);
    }
    const delay = left < 60_000 ? 1_000 : Math.min(left % 60_000 || 60_000, 30_000);
    const id = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(id);
  }, [expiresAt, now]);

  const discard = useCallback(() => {
    clearSession();
    expiresAtRef.current = null;
    baseline.current = null;
    setExpiresAt(null);
    setSaveFailed(false);
  }, []);

  return {
    remainingMs: expiresAt === null ? null : Math.max(0, expiresAt - now),
    saveFailed,
    windowMs: SESSION_TTL_MS,
    discard,
  };
}
