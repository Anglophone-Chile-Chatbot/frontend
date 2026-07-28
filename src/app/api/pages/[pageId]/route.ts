import { BACKEND_TIMEOUT_MS, backendBaseUrl } from "@/lib/api/backend";

/**
 * Proxy for a single page's extracted text and document context.
 *
 * Backs the document viewer, which opens when a citation chip is tapped.
 */

export const dynamic = "force-dynamic";

// Accepts the canonical 8-4-4-4-12 UUID form the backend's UUID path param
// expects; rejecting early avoids a pointless upstream round trip.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  context: { params: Promise<{ pageId: string }> },
): Promise<Response> {
  const { pageId } = await context.params;

  if (!UUID_PATTERN.test(pageId)) {
    return Response.json(
      { error: "Malformed page identifier.", code: "INVALID_PAGE_ID" },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(`${backendBaseUrl()}/pages/${pageId}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.any([
        request.signal,
        AbortSignal.timeout(BACKEND_TIMEOUT_MS),
      ]),
      cache: "no-store",
    });

    if (upstream.status === 404) {
      return Response.json(
        { error: "That page is not in the archive.", code: "PAGE_NOT_FOUND" },
        { status: 404 },
      );
    }
    if (!upstream.ok) {
      return Response.json(
        { error: "The archive could not load that page.", code: "BACKEND_ERROR" },
        { status: 502 },
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      {
        error: "The archive service is unreachable. Try again in a moment.",
        code: "BACKEND_UNREACHABLE",
      },
      { status: 502 },
    );
  }
}
