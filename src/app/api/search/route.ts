import { BACKEND_TIMEOUT_MS, backendBaseUrl } from "@/lib/api/backend";
import { sanitizeMessage } from "@/lib/validation";

/**
 * Proxy for the full-text search endpoint.
 *
 * Keeps the bare-IP Oracle origin off the client. Query bounds mirror the
 * backend's own `Query(...)` constraints so an out-of-range value is rejected
 * here rather than producing a 422 from FastAPI.
 *
 * `document_id` is forwarded, repeatable, so the reader's within-issue search
 * (CHUNK 3, 3e-1) rides the corpus-wide endpoint instead of gaining one of its
 * own. `GET /api/v1/search` has taken the parameter since CHUNK 1 and routes it
 * through the same `search_chunks(..., document_ids=...)` path chat uses — the
 * scope is a narrower `WHERE`, not a second retrieval pipeline. This handler
 * simply stopped dropping it.
 */

export const dynamic = "force-dynamic";

const MAX_QUERY_CHARS = 500;
const MAX_LIMIT = 50;

/** Mirrors `MAX_SCOPE_DOCUMENTS` in `backend/app/schemas/chat.py`. */
const MAX_SCOPE_DOCUMENTS = 50;

/** The canonical 8-4-4-4-12 form the backend's `UUID` query param accepts. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;

  const q = sanitizeMessage(params.get("q") ?? "");
  if (q.length === 0) {
    return jsonError("A search query is required.", "QUERY_REQUIRED", 400);
  }
  if (q.length > MAX_QUERY_CHARS) {
    return jsonError(
      `Query exceeds the ${MAX_QUERY_CHARS} character limit.`,
      "QUERY_TOO_LONG",
      413,
    );
  }

  const limit = clampInt(params.get("limit"), 20, 1, MAX_LIMIT);
  const offset = clampInt(params.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);

  // Malformed ids are rejected here rather than forwarded: FastAPI answers a
  // bare `document_id=abc` with a 422 that this proxy would relay as an opaque
  // 502, so the scoped reader would see "the archive search failed" for what is
  // really a bad link. A hand-edited URL should be a clear 400 instead.
  const documentIds = new URL(request.url).searchParams.getAll("document_id");
  if (documentIds.some((id) => !UUID_PATTERN.test(id))) {
    return jsonError("Malformed document identifier.", "INVALID_DOCUMENT_ID", 400);
  }
  if (documentIds.length > MAX_SCOPE_DOCUMENTS) {
    return jsonError(
      `A search may be scoped to at most ${MAX_SCOPE_DOCUMENTS} documents.`,
      "SCOPE_TOO_LARGE",
      413,
    );
  }

  const upstreamUrl = new URL(`${backendBaseUrl()}/search`);
  upstreamUrl.searchParams.set("q", q);
  upstreamUrl.searchParams.set("limit", String(limit));
  upstreamUrl.searchParams.set("offset", String(offset));
  // Appended, never `set`: the backend reads a *repeated* param as the list, so
  // collapsing several ids into one value would scope to nothing.
  for (const id of documentIds) upstreamUrl.searchParams.append("document_id", id);

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.any([
        request.signal,
        AbortSignal.timeout(BACKEND_TIMEOUT_MS),
      ]),
      cache: "no-store",
    });

    if (!upstream.ok) {
      return jsonError("The archive search failed.", "BACKEND_ERROR", 502);
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return jsonError(
      "The archive service is unreachable. Try again in a moment.",
      "BACKEND_UNREACHABLE",
      502,
    );
  }
}

/** Parse an integer query param, falling back and clamping to bounds. */
function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function jsonError(error: string, code: string, status: number): Response {
  return Response.json({ error, code }, { status });
}
