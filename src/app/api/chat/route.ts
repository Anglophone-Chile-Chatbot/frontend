import { backendBaseUrl } from "@/lib/api/backend";
import { MAX_SCOPE_DOCUMENTS, type ChatRequestBody } from "@/lib/api/types";
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

  // Absent means corpus-wide. The key is omitted rather than sent as null so
  // the unscoped request body is byte-identical to what it was before scoping
  // existed.
  const payload: ChatRequestBody = { message };
  if (scope !== undefined) payload.document_ids = scope;

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

function jsonError(error: string, code: string, status: number): Response {
  return Response.json({ error, code }, { status });
}
