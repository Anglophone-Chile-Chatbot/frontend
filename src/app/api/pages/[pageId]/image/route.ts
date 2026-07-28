import { backendBaseUrl } from "@/lib/api/backend";

/**
 * Proxy for a page's scan image.
 *
 * Scans are immutable once ingested, so the upstream cache headers are passed
 * through rather than replaced with `no-store`.
 */

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Scans are large; allow more time than a JSON round trip.
const IMAGE_TIMEOUT_MS = 30_000;

export async function GET(
  request: Request,
  context: { params: Promise<{ pageId: string }> },
): Promise<Response> {
  const { pageId } = await context.params;

  if (!UUID_PATTERN.test(pageId)) {
    return new Response(null, { status: 400 });
  }

  try {
    const upstream = await fetch(`${backendBaseUrl()}/pages/${pageId}/image`, {
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
