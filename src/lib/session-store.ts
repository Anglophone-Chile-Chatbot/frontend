import type { ChatTurn } from "@/hooks/use-archive-chat";
import type { DocumentSummary } from "@/lib/api/types";

/**
 * The reader's own saved conversation, kept in *their browser* and nowhere else.
 *
 * The server stays stateless: nothing here is sent upstream, and no history is
 * ever stored server-side. This only stops a same-tab navigation, a reload or a
 * stray tap from throwing away the reader's work — before this, chat turns
 * lived in React state alone, so anything that unmounted the Ask page wiped
 * them (measured in code 2026-09-30: no `localStorage`, `sessionStorage` or
 * cookie anywhere in `src/`).
 *
 * **`localStorage`, not cookies.** A cookie is ~4KB and rides on every request
 * to the server; a conversation with its cited sources is far bigger and the
 * server should never see it.
 *
 * **A rolling window.** The saved session expires `SESSION_TTL_MS` after the
 * reader's last question, and every new question moves that deadline forward.
 * Merely opening the site does not, or a session someone only looked at would
 * never expire. The reader sees the live countdown (`SessionNotice`), and a
 * shared computer is the reason for both the countdown and the delete button.
 */

export const SESSION_KEY = "anglophone-chile:session:v1";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** More than this is far past what a reader scans, and storage is ~5MB. */
const MAX_TURNS = 30;

const INTERRUPTED_COPY =
  "This answer was cut off when the page closed. Ask again to retry.";

interface StoredSession {
  v: 1;
  expiresAt: number;
  turns: ChatTurn[];
  scope: DocumentSummary[];
}

export interface SavedSession {
  turns: ChatTurn[];
  scope: DocumentSummary[];
  expiresAt: number;
}

function isTurn(value: unknown): value is ChatTurn {
  if (typeof value !== "object" || value === null) return false;
  const turn = value as Record<string, unknown>;
  return (
    typeof turn.id === "string" &&
    typeof turn.question === "string" &&
    typeof turn.answer === "string" &&
    Array.isArray(turn.sources) &&
    Array.isArray(turn.related) &&
    Array.isArray(turn.terms) &&
    typeof turn.status === "string"
  );
}

function isScopeDoc(value: unknown): value is DocumentSummary {
  if (typeof value !== "object" || value === null) return false;
  const doc = value as Record<string, unknown>;
  return typeof doc.document_id === "string" && typeof doc.title === "string";
}

/**
 * A turn that was still in flight when the page closed has no more text
 * coming, so it comes back as an honest error rather than a spinner that never
 * ends. Whatever text had streamed is kept.
 */
function settle(turn: ChatTurn): ChatTurn {
  if (turn.status === "complete" || turn.status === "error") return turn;
  return { ...turn, status: "error", error: INTERRUPTED_COPY };
}

/** Read the saved session, deleting it instead when it has expired or is unreadable. */
export function loadSession(now: number = Date.now()): SavedSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) throw new Error("shape");
    const stored = parsed as Partial<StoredSession>;

    if (
      stored.v !== 1 ||
      typeof stored.expiresAt !== "number" ||
      !Array.isArray(stored.turns) ||
      !Array.isArray(stored.scope)
    ) {
      throw new Error("shape");
    }

    if (stored.expiresAt <= now) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }

    const turns = stored.turns.filter(isTurn).map(settle);
    if (turns.length === 0) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }

    return {
      turns,
      scope: stored.scope.filter(isScopeDoc),
      expiresAt: stored.expiresAt,
    };
  } catch {
    // Corrupt JSON, an old shape, or storage blocked: treat as no session.
    clearSession();
    return null;
  }
}

/**
 * Save the session. Returns whether it is actually on disk — `false` when the
 * browser is blocking storage (private window, blocked site data), so the UI
 * can say so instead of promising a save that did not happen.
 */
export function saveSession(
  turns: ChatTurn[],
  scope: DocumentSummary[],
  expiresAt: number,
): boolean {
  let keep = turns.slice(-MAX_TURNS);

  // Quota: drop the oldest turn and retry until it fits or nothing is left.
  while (keep.length > 0) {
    const payload: StoredSession = { v: 1, expiresAt, turns: keep, scope };
    try {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
      return true;
    } catch {
      keep = keep.slice(1);
    }
  }
  return false;
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

/**
 * The time left, in the fewest words that stay exact enough to act on:
 * `6 d 23 h`, `4 h 12 m`, `12 m`, `40 s`.
 */
export function formatRemaining(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);

  if (days > 0) return hours > 0 ? `${days} d ${hours} h` : `${days} d`;
  if (hours > 0) return minutes > 0 ? `${hours} h ${minutes} m` : `${hours} h`;
  if (minutes > 0) return `${minutes} m`;
  return `${seconds} s`;
}
