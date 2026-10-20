"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { SseParser } from "@/lib/api/sse";
import type {
  ChatHistory,
  ChatHistoryTurn,
  ChatRequestBody,
  ChatSource,
  ConversationState,
  QuestionIntent,
} from "@/lib/api/types";

/**
 * Chat state driven by the backend's own SSE protocol.
 *
 * The Vercel AI SDK's `useChat` is deliberately not used here: the backend
 * speaks its own event protocol (`sources` → `delta`* → `done` | `error`) in
 * which retrieved sources arrive as a first-class event *before* any answer
 * text. Translating that into the SDK's wire format would mean smuggling
 * citations through data parts and maintaining a protocol shim on every
 * request. Reading the stream directly keeps sources first-class, which is
 * exactly what citation chips need.
 *
 * Phase 1 chat is stateless *server-side*: the backend stores nothing. Since
 * CHUNK 25 / W8 each follow-up carries a compact history (the server's opaque
 * conversation state and the last 3 questions, never earlier answers). Turns live in memory here; the reader's own browser
 * keeps a rolling copy (`use-session-persistence.ts`) so a navigation or a
 * reload does not throw the conversation away, and `restore` puts it back.
 */

/**
 * The document scope a turn was asked under.
 *
 * `null` is corpus-wide. Otherwise the chosen documents, carried as titles
 * alongside ids so the transcript can name the scope without a second lookup.
 */
export interface ChatScope {
  ids?: string[];
  labels: string[];
  publications?: string[];
  date_from?: string;
  date_to?: string;
  undated?: boolean;
}

export interface ChatTurn {
  id: string;
  question: string;
  /** Answer text accumulated so far; grows while streaming. */
  answer: string;
  /** Chunks retrieved for this turn, available before the answer starts. */
  sources: ChatSource[];
  /** Further matches retrieved but not grounded in the context. */
  related: ChatSource[];
  /** Search terms used for retrieval, for highlighting. */
  terms: string[];
  /**
   * The backend's lookup/sweep verdict. Optional: turns saved in the browser
   * before 2026-10-05 have none, and `null` means the rewrite did not run.
   */
  intent?: QuestionIntent | null;
  /** The rewrite's subject terms, for the find-everything link. */
  topics?: string[];
  /** The question as the server understood it (CHUNK 25 / W8). */
  standalone?: string;
  /** True when the server treated this turn as a follow-up to earlier turns. */
  followUp?: boolean;
  /** Opaque compact conversation state from the server's `state` SSE event. */
  state?: ConversationState;
  status: "retrieving" | "streaming" | "complete" | "error";
  /** User-facing error copy, set only when `status === "error"`. */
  error?: string;
  /**
   * Scope this turn was asked under; `null` for corpus-wide.
   *
   * Recorded per turn rather than read from current state at render time: the
   * scope can be changed after a turn completes, and a transcript that
   * relabelled old answers to match the *current* scope would be lying about
   * where those answers came from.
   */
  scope: ChatScope | null;
}

export interface UseArchiveChat {
  turns: ChatTurn[];
  /** True from submit until the stream terminates. */
  isBusy: boolean;
  /** Ask a question, optionally scoped to chosen documents. */
  ask: (question: string, scope?: ChatScope | null) => Promise<void>;
  stop: () => void;
  reset: () => void;
  /** Put back turns saved in the reader's browser. Ignored while one is streaming. */
  restore: (turns: ChatTurn[]) => void;
}

const ERROR_COPY: Record<string, string> = {
  generation_failed:
    "The assistant lost its connection while answering. Ask again to retry.",
  BACKEND_UNREACHABLE:
    "The archive service is unreachable right now. Try again in a moment.",
  BACKEND_ERROR: "The archive could not answer that question.",
  MESSAGE_TOO_LONG: "That question is too long. Shorten it and try again.",
  SCOPE_INVALID:
    "That document selection is no longer valid. Clear it and choose again.",
  RATE_LIMITED: "Too many questions right now. Try again shortly.",
  SERVICE_UNAVAILABLE: "AI answers are unavailable right now; search still works.",
};

export function useArchiveChat(): UseArchiveChat {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // The settled turns, read by `ask` to build the follow-up history. A ref, so
  // `ask` keeps one identity instead of being rebuilt on every streamed delta.
  const turnsRef = useRef<ChatTurn[]>([]);
  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  /** Apply a partial update to one turn, leaving the rest untouched. */
  const patchTurn = useCallback((id: string, patch: Partial<ChatTurn>) => {
    setTurns((current) =>
      current.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)),
    );
  }, []);

  const ask = useCallback(
    async (question: string, scope: ChatScope | null = null) => {
      const trimmed = question.trim();
      if (trimmed.length === 0 || abortRef.current) return;

      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `turn-${Date.now()}`;

      setTurns((current) => [
        ...current,
        {
          id,
          question: trimmed,
          answer: "",
          sources: [],
          related: [],
          terms: [],
          status: "retrieving",
          scope,
        },
      ]);
      setIsBusy(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const payload: ChatRequestBody = { message: trimmed };
        if (scope) {
          if (scope.ids && scope.ids.length > 0) payload.document_ids = scope.ids;
          if (scope.publications && scope.publications.length > 0) {
            payload.publications = scope.publications;
          }
          if (scope.date_from) payload.date_from = scope.date_from;
          if (scope.date_to) payload.date_to = scope.date_to;
          if (scope.undated) payload.undated = true;
        }
        const history = buildHistory(turnsRef.current);
        if (history !== undefined) {
          payload.history = history;
        }

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const { code, message } = await readError(response);
          const errorText =
            code === "RATE_LIMITED" || code === "SERVICE_UNAVAILABLE"
              ? (message ?? ERROR_COPY[code])
              : (ERROR_COPY[code] ?? ERROR_COPY.BACKEND_ERROR);
          patchTurn(id, {
            status: "error",
            error: errorText,
          });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const parser = new SseParser();

        // Buffer deltas between paints: a fast stream can emit many small
        // frames, and setting state per frame causes needless re-renders.
        let answer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          for (const event of parser.push(decoder.decode(value, { stream: true }))) {
            if (event.type === "sources") {
              patchTurn(id, { 
                sources: event.sources, 
                related: event.related,
                terms: event.terms,
                intent: event.intent,
                topics: event.topics,
                standalone: event.standalone_question ?? trimmed,
                followUp: event.follow_up,
                status: "streaming" 
              });
            } else if (event.type === "delta") {
              answer += event.text;
              patchTurn(id, { answer, status: "streaming" });
            } else if (event.type === "state") {
              patchTurn(id, { state: event.state });
            } else if (event.type === "error") {
              patchTurn(id, {
                status: "error",
                error: ERROR_COPY[event.message] ?? ERROR_COPY.generation_failed,
              });
              return;
            } else {
              patchTurn(id, { status: "complete" });
            }
          }
        }

        // Stream ended without an explicit terminator (upstream hang-up).
        setTurns((current) =>
          current.map((turn) =>
            turn.id === id && turn.status === "streaming"
              ? { ...turn, status: "complete" }
              : turn,
          ),
        );
      } catch (error) {
        // A user-initiated stop is not a failure — keep what streamed.
        if (error instanceof DOMException && error.name === "AbortError") {
          setTurns((current) =>
            current.map((turn) =>
              turn.id === id ? { ...turn, status: "complete" } : turn,
            ),
          );
        } else {
          patchTurn(id, {
            status: "error",
            error: ERROR_COPY.BACKEND_UNREACHABLE,
          });
        }
      } finally {
        abortRef.current = null;
        setIsBusy(false);
      }
    },
    [patchTurn],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setTurns([]);
    setIsBusy(false);
  }, []);

  const restore = useCallback((saved: ChatTurn[]) => {
    if (abortRef.current) return;
    setTurns(saved);
  }, []);

  return { turns, isBusy, ask, stop, reset, restore };
}

/**
 * Build the compact conversation history from earlier completed turns.
 *
 * Omits `history` entirely on the first question (no earlier completed turns).
 * Skips turns that errored or were stopped before any answer text arrived.
 * Uses the most recent `state` from any earlier completed turn (omitting `state`
 * when no turn has one, e.g. turns restored from an older saved session).
 */
function buildHistory(turns: ChatTurn[]): ChatHistory | undefined {
  const completed = turns.filter(
    (turn) => turn.status === "complete" && turn.answer.length > 0,
  );
  if (completed.length === 0) return undefined;

  let latestState: ConversationState | undefined;
  for (let i = completed.length - 1; i >= 0; i--) {
    if (completed[i].state !== undefined) {
      latestState = completed[i].state;
      break;
    }
  }

  const recentTurns: ChatHistoryTurn[] = completed.slice(-3).map((turn) => ({
    question: turn.question,
    standalone:
      turn.standalone && turn.standalone.trim().length > 0
        ? turn.standalone
        : turn.question,
  }));

  return latestState !== undefined
    ? { state: latestState, turns: recentTurns }
    : { turns: recentTurns };
}

/** Pull `code` and `error` out of a JSON error body, if present. */
async function readError(
  response: Response,
): Promise<{ code: string; message?: string }> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null) {
      const record = body as Record<string, unknown>;
      const code =
        typeof record.code === "string"
          ? record.code
          : response.status === 429
            ? "RATE_LIMITED"
            : "BACKEND_ERROR";
      const message =
        typeof record.error === "string" && record.error.trim().length > 0
          ? record.error.trim()
          : undefined;
      return { code, message };
    }
  } catch {
    // Non-JSON error body; fall through to the generic message.
  }
  return { code: response.status === 429 ? "RATE_LIMITED" : "BACKEND_ERROR" };
}
