import { backendBaseUrl } from "@/lib/api/backend";

/**
 * Proxy for a cropped figure image.
 *
 * A near-twin of the page-scan proxy next door, and deliberately a separate
 * route rather than a shared one: the two address different resources
 * (`/figures/{id}/image` vs `/pages/{id}/image`) and a combined handler would
 * have to branch on a segment to pick the upstream path, which is more
 * indirection than duplicating a fetch.
 *
 * Like scans, crops are immutable once ingested — the ingest pipeline clears
 * and rewrites the figures directory per run — so upstream cache headers are
 * passed through rather than replaced with `no-store`.
 */

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Crops are a fraction of a full page scan, but share the scan timeout: the
// cost here is the round trip to Oracle, not the payload.
const IMAGE_TIMEOUT_MS = 30_000;

export async function GET(
  request: Request,
  context: { params: Promise<{ figureId: string }> },
): Promise<Response> {
  const { figureId } = await context.params;

  if (!UUID_PATTERN.test(figureId)) {
    return new Response(null, { status: 400 });
  }

  try {
    const upstream = await fetch(`${backendBaseUrl()}/figures/${figureId}/image`, {
      signal: AbortSignal.any([
        request.signal,
        AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      ]),
    });

    if (!upstream.ok || !upstream.body) {
      return new Response(null, { status: upstream.status === 404 ? 404 : 502 });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type":
          upstream.headers.get("Content-Type") ?? "application/octet-stream",
        "Cache-Control":
          upstream.headers.get("Cache-Control") ??
          "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
