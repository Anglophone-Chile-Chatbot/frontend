import { backendBaseUrl } from "@/lib/api/backend";
import { isIsoDate } from "@/lib/archive-filters";
import {
  MAX_SCOPE_DOCUMENTS,
  type ChatHistory,
  type ChatHistoryTurn,
  type ChatRequestBody,
  type ConversationState,
} from "@/lib/api/types";
import { MAX_PROMPT_CHARS, sanitizeMessage } from "@/lib/validation";

/**
 * Streaming proxy for the RAG chat endpoint.
 *
 * The FastAPI backend emits its own Server-Sent Event protocol
 * (`sources` → `delta`* → `done` | `error`), which the client reads directly
 * via `useArchiveChat`. This handler is a byte-level passthrough: the upstream
 * body is piped straight through without buffering, so tokens reach the
 * browser as they are generated rather than in one batch at the end.
 */

// The proxy must stay open for the life of the LLM stream.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", "INVALID_JSON", 400);
  }

  const raw =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).message
      : undefined;

  if (typeof raw !== "string") {
    return jsonError("A 'message' string is required.", "MESSAGE_REQUIRED", 400);
  }

  const message = sanitizeMessage(raw);
  if (message.length === 0) {
    return jsonError("Message cannot be empty.", "MESSAGE_EMPTY", 400);
  }
  if (message.length > MAX_PROMPT_CHARS) {
    return jsonError(
      `Message exceeds the ${MAX_PROMPT_CHARS} character limit.`,
      "MESSAGE_TOO_LONG",
      413,
    );
  }

  const scope = readDocumentIds(body);
  if (scope === INVALID) {
    return jsonError(
      "'document_ids' must be an array of document UUIDs.",
      "SCOPE_INVALID",
      400,
    );
  }

  const publications = readPublications(body);
  const dateFrom = readDate(body, "date_from");
  const dateTo = readDate(body, "date_to");
  const history = readHistory(body);

  // Absent means corpus-wide. The keys are omitted rather than sent as null so
  // the unscoped request body is byte-identical to what it was before scoping
  // existed.
  const payload: ChatRequestBody = { message };
  if (scope !== undefined) payload.document_ids = scope;
  if (publications !== undefined && publications.length > 0) {
    payload.publications = publications;
  }
  if (dateFrom !== undefined) payload.date_from = dateFrom;
  if (dateTo !== undefined) payload.date_to = dateTo;
  if ((body as Record<string, unknown> | null)?.undated === true) payload.undated = true;
  if (history !== undefined) payload.history = history;

  let upstream: Response;
  try {
    upstream = await fetch(`${backendBaseUrl()}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(payload),
      // Abort the upstream LLM stream if the user navigates away or stops.
      signal: request.signal,
      cache: "no-store",
    });
  } catch {
    return jsonError(
      "The archive service is unreachable. Try again in a moment.",
      "BACKEND_UNREACHABLE",
      502,
    );
  }

  // 429 (per-minute or daily AI limit) and 503 (the AI spend counter is
  // down) carry a message the reader should see, ending "search still works".
  if (upstream.status === 429 || upstream.status === 503) {
    try {
      const errBody: unknown = await upstream.json();
      if (typeof errBody === "object" && errBody !== null && !Array.isArray(errBody)) {
        return Response.json(errBody, { status: upstream.status });
      }
    } catch {
      // Non-JSON body; fall through to the default payload below.
    }
    return upstream.status === 429
      ? jsonError("Too many questions right now. Try again shortly.", "RATE_LIMITED", 429)
      : jsonError(
          "AI answers are unavailable right now; search still works.",
          "SERVICE_UNAVAILABLE",
          503,
        );
  }

  if (!upstream.ok || !upstream.body) {
    return jsonError(
      "The archive service could not answer that question.",
      "BACKEND_ERROR",
      502,
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering so frames are not held back.
      "X-Accel-Buffering": "no",
    },
  });
}

/** Returned when `document_ids` is present but not a valid id array. */
const INVALID = Symbol("invalid-scope");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Read an optional document scope out of the request body.
 *
 * Returns `undefined` when no scope was requested (corpus-wide), the id list
 * when one was, or `INVALID` when the field is present but malformed.
 *
 * An empty array is passed through rather than treated as absent: the backend
 * reads it as an empty scope matching nothing, which is the honest reading of
 * "scope me to no documents". Silently widening it to the whole corpus would
 * answer from everything precisely when the caller asked for nothing.
 *
 * Ids are shape-checked here so a malformed one fails as a clean 400 instead
 * of a FastAPI 422 arriving where the client expects an event stream.
 */
function readDocumentIds(body: unknown): string[] | undefined | typeof INVALID {
  if (typeof body !== "object" || body === null) return undefined;

  const raw = (body as Record<string, unknown>).document_ids;
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) return INVALID;
  if (raw.length > MAX_SCOPE_DOCUMENTS) return INVALID;
  if (!raw.every((id) => typeof id === "string" && UUID_PATTERN.test(id))) {
    return INVALID;
  }

  return raw as string[];
}

function readPublications(body: unknown): string[] | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const raw = (body as Record<string, unknown>).publications;
  if (!Array.isArray(raw)) return undefined;
  return raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function readDate(body: unknown, key: string): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const raw = (body as Record<string, unknown>)[key];
  if (typeof raw === "string" && isIsoDate(raw)) return raw;
  return undefined;
}

const MAX_HISTORY_TURNS = 3;
const MAX_HISTORY_QUESTION_CHARS = 300;

/**
 * Light shape check for optional follow-up history (`history` field).
 *
 * Keeps at most 3 turns, trims question strings to 300 characters, and drops
 * any unknown properties. If `history` is malformed, drops it silently rather
 * than rejecting the request with 400 (the backend enforces the authoritative
 * validation and caps).
 */
function readHistory(body: unknown): ChatHistory | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const raw = (body as Record<string, unknown>).history;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return undefined;
  }

  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.turns)) return undefined;

  let state: ConversationState | null = null;
  if (record.state !== undefined && record.state !== null) {
    if (typeof record.state !== "object" || Array.isArray(record.state)) {
      return undefined;
    }
    state = record.state as ConversationState;
  }

  const turns: ChatHistoryTurn[] = [];
  for (const item of record.turns.slice(-MAX_HISTORY_TURNS)) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return undefined;
    }
    const turn = item as Record<string, unknown>;
    if (typeof turn.question !== "string" || typeof turn.standalone !== "string") {
      return undefined;
    }
    turns.push({
      question: turn.question.slice(0, MAX_HISTORY_QUESTION_CHARS),
      standalone: turn.standalone.slice(0, MAX_HISTORY_QUESTION_CHARS),
    });
  }

  if (turns.length === 0 && state === null) return undefined;

  return { state, turns };
}

function jsonError(error: string, code: string, status: number): Response {
  return Response.json({ error, code }, { status });
}
