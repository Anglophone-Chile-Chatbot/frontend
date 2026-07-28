import { BACKEND_TIMEOUT_MS, backendBaseUrl } from "@/lib/api/backend";
import { sanitizeMessage } from "@/lib/validation";

/**
 * Proxy for the full-text search endpoint.
 *
 * Keeps the bare-IP Oracle origin off the client. Query bounds mirror the
 * backend's own `Query(...)` constraints so an out-of-range value is rejected
 * here rather than producing a 422 from FastAPI.
 */

export const dynamic = "force-dynamic";

const MAX_QUERY_CHARS = 500;
const MAX_LIMIT = 50;

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

  const upstreamUrl = new URL(`${backendBaseUrl()}/search`);
  upstreamUrl.searchParams.set("q", q);
  upstreamUrl.searchParams.set("limit", String(limit));
  upstreamUrl.searchParams.set("offset", String(offset));

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
