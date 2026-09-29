import { BACKEND_TIMEOUT_MS, backendBaseUrl } from "@/lib/api/backend";

/**
 * Proxy for newspaper facets (publications, issue counts, year breakdowns).
 *
 * Backs the left "Newspapers" folder rail and date filters.
 * Caches in Next.js or browser as appropriate, but force-dynamic for fresh date ranges.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;

  const upstreamUrl = new URL(`${backendBaseUrl()}/documents/facets`);

  const dateFrom = params.get("date_from") ?? params.get("from");
  if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    upstreamUrl.searchParams.set("date_from", dateFrom);
  }

  const dateTo = params.get("date_to") ?? params.get("to");
  if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    upstreamUrl.searchParams.set("date_to", dateTo);
  }

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
      return jsonError("The newspaper facets could not be loaded.", "BACKEND_ERROR", upstream.status === 404 ? 404 : 502);
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
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

function jsonError(error: string, code: string, status: number): Response {
  return Response.json({ error, code }, { status });
}
