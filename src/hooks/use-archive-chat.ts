"use client";

import { useCallback, useRef, useState } from "react";

import { SseParser } from "@/lib/api/sse";
import type { ChatRequestBody, ChatSource } from "@/lib/api/types";

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
 * Phase 1 chat is stateless — nothing is persisted, and no history is sent
 * upstream. Turns are kept in memory only so the transcript renders.
 */

/**
 * The document scope a turn was asked under.
 *
 * `null` is corpus-wide. Otherwise the chosen documents, carried as titles
 * alongside ids so the transcript can name the scope without a second lookup.
 */
export interface ChatScope {
  ids: string[];
  labels: string[];
}

export interface ChatTurn {
  id: string;
  question: string;
  /** Answer text accumulated so far; grows while streaming. */
  answer: string;
  /** Chunks retrieved for this turn, available before the answer starts. */
  sources: ChatSource[];
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
};

export function useArchiveChat(): UseArchiveChat {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

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
          status: "retrieving",
          scope,
        },
      ]);
      setIsBusy(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // The key is omitted entirely when unscoped, so a corpus-wide request
        // is byte-identical to what it was before scoping existed.
        const payload: ChatRequestBody = { message: trimmed };
        if (scope) payload.document_ids = scope.ids;

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const code = await readErrorCode(response);
          patchTurn(id, {
            status: "error",
            error: ERROR_COPY[code] ?? ERROR_COPY.BACKEND_ERROR,
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
              patchTurn(id, { sources: event.sources, status: "streaming" });
            } else if (event.type === "delta") {
              answer += event.text;
              patchTurn(id, { answer, status: "streaming" });
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

  return { turns, isBusy, ask, stop, reset };
}

/** Pull the `code` out of a JSON error body, if there is one. */
async function readErrorCode(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null) {
      const code = (body as Record<string, unknown>).code;
      if (typeof code === "string") return code;
    }
  } catch {
    // Non-JSON error body; fall through to the generic message.
  }
  return "BACKEND_ERROR";
}
