import { backendBaseUrl } from "@/lib/api/backend";
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

  let upstream: Response;
  try {
    upstream = await fetch(`${backendBaseUrl()}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ message }),
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

function jsonError(error: string, code: string, status: number): Response {
  return Response.json({ error, code }, { status });
}
