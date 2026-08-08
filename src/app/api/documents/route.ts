import { BACKEND_TIMEOUT_MS, backendBaseUrl } from "@/lib/api/backend";
import { sanitizeMessage } from "@/lib/validation";

/**
 * Proxy for the document catalogue.
 *
 * Backs the chat's scope picker. Same shape as the search proxy: the bare-IP
 * Oracle origin stays server-side, and query bounds mirror the backend's own
 * `Query(...)` constraints so an out-of-range value is rejected here rather
 * than coming back as a 422 from FastAPI.
 */

export const dynamic = "force-dynamic";

const MAX_FILTER_CHARS = 200;
const MAX_LIMIT = 200;

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;

  const q = sanitizeMessage(params.get("q") ?? "");
  if (q.length > MAX_FILTER_CHARS) {
    return jsonError(
      `Filter exceeds the ${MAX_FILTER_CHARS} character limit.`,
      "QUERY_TOO_LONG",
      413,
    );
  }

  const limit = clampInt(params.get("limit"), 50, 1, MAX_LIMIT);
  const offset = clampInt(params.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);

  const upstreamUrl = new URL(`${backendBaseUrl()}/documents`);
  // Omitted rather than sent empty: the backend treats an absent `q` as
  // "no filter", and an empty string would be a substring match on everything.
  if (q.length > 0) upstreamUrl.searchParams.set("q", q);
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
      return jsonError("The document list could not be loaded.", "BACKEND_ERROR", 502);
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
