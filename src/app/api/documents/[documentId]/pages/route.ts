import { BACKEND_TIMEOUT_MS, backendBaseUrl } from "@/lib/api/backend";

/**
 * Proxy for a document's ordered page list.
 *
 * Backs the document reader at `/document/[documentId]`, which needs the whole
 * page strip up front to draw prev/next, the page jump, and the blank-page
 * marks before any page is opened.
 *
 * Same shape as the single-page proxy next door: the bare-IP Oracle origin
 * never reaches the browser, the id is validated here so a malformed one costs
 * no upstream round trip, and every failure mode answers `{error, code}`.
 */

export const dynamic = "force-dynamic";

// The canonical 8-4-4-4-12 form the backend's `UUID` path param accepts.
// Mirrors `api/pages/[pageId]/route.ts` deliberately — one spelling of the
// same rule in both places is easier to keep honest than a shared helper that
// hides which routes enforce it.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
): Promise<Response> {
  const { documentId } = await context.params;

  if (!UUID_PATTERN.test(documentId)) {
    return Response.json(
      { error: "Malformed document identifier.", code: "INVALID_DOCUMENT_ID" },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(
      `${backendBaseUrl()}/documents/${documentId}/pages`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.any([
          request.signal,
          AbortSignal.timeout(BACKEND_TIMEOUT_MS),
        ]),
        cache: "no-store",
      },
    );

    if (upstream.status === 404) {
      return Response.json(
        { error: "That issue is not in the archive.", code: "DOCUMENT_NOT_FOUND" },
        { status: 404 },
      );
    }
    if (!upstream.ok) {
      return Response.json(
        { error: "The archive could not load that issue.", code: "BACKEND_ERROR" },
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
