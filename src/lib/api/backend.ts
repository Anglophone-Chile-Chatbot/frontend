import "server-only";

/**
 * Server-side access to the FastAPI backend.
 *
 * The Oracle origin is a bare IP over plain HTTP (see `infra/plans.md` — no
 * domain, no Cloudflare in Phase 1). It is therefore never referenced from the
 * browser: all traffic goes through Next Route Handlers, which run on the
 * server and proxy to this URL. That keeps the origin out of the public UI and
 * lets the frontend be served entirely over HTTPS from Vercel.
 */

/** Base URL of the FastAPI API, e.g. `http://129.80.3.40/api/v1`. */
export function backendBaseUrl(): string {
  const url = process.env.BACKEND_API_URL;
  if (!url) {
    throw new Error(
      "BACKEND_API_URL is not set. Point it at the FastAPI origin, " +
        "e.g. http://129.80.3.40/api/v1",
    );
  }
  return url.replace(/\/+$/, "");
}

/** Seconds to wait for the backend before giving up on a non-streaming call. */
export const BACKEND_TIMEOUT_MS = 15_000;
