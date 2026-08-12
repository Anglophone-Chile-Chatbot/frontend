/**
 * Server startup hooks. Runs once per Next.js server instance, before any
 * request is handled.
 *
 * The only job today is widening undici's connection keep-alive window so
 * Route Handlers stop re-handshaking with Oracle on every request. See
 * `register` below for the measurements that motivated it.
 */

export async function register(): Promise<void> {
  // Guard the runtime: `undici` is a Node package, and this file is also
  // evaluated in the Edge runtime, where importing it would throw at boot.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { Agent, setGlobalDispatcher } = await import("undici");

  /**
   * How long an idle socket to the backend is kept open.
   *
   * Node's global `fetch` already pools connections — that part was assumed
   * broken and is not (verified: 6 sequential requests opened 2 TCP
   * connections, and Next's fetch patch only wraps caching around
   * `originFetch`, never touching the dispatcher). The real defect is the
   * *timeout*: undici discards an idle socket after 4s, while nginx on Oracle
   * holds it for 65s (`keepalive_timeout 65` in `infra/nginx/nginx.conf`).
   * undici was hanging up on a connection the server would still have honored.
   *
   * That 4s window is almost exactly wrong for this app: a reader opens a
   * page, reads for a few seconds, then asks a question — and every such
   * request paid a fresh ~0.28s handshake.
   *
   * Measured 2026-08-12 against Oracle, `/search?q=valparaiso`, requests
   * spaced by an idle gap (first request always discarded — it pays the
   * handshake either way):
   *
   *   default 4s timeout : 849ms after 5s idle, new TCP connect every time
   *   this setting       : 572ms after 5s idle, socket reused
   *
   * Through a Route Handler, `/api/documents` goes 586ms → 296ms across a 6s
   * gap, and stays flat at ~295ms through 10s / 20s / 30s of idle, so the
   * cliff is removed rather than pushed a few seconds further out.
   *
   * Kept below nginx's 65s on purpose. If the client outlives the server's
   * window, undici hands out a socket nginx has already closed, which surfaces
   * as an occasional `ECONNRESET` / `UND_ERR_SOCKET` rather than a clean
   * retry. Raising this without raising `keepalive_timeout` first reintroduces
   * that failure — the two numbers are a pair.
   */
  const KEEP_ALIVE_MS = 60_000;

  setGlobalDispatcher(
    new Agent({
      keepAliveTimeout: KEEP_ALIVE_MS,
      // undici will not extend a socket's life past this even if the server's
      // `Keep-Alive` header asks for longer, so it is pinned to the same
      // value rather than left at the 10-minute default — that default would
      // let a header push us past nginx's 65s window.
      keepAliveMaxTimeout: KEEP_ALIVE_MS,
    }),
  );
}
