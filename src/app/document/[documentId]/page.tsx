import type { Metadata } from "next";

import { DocumentReader } from "@/components/archive/document-reader";

/**
 * The document reader route — `/document/<id>?page=N&q=term`.
 *
 * One URL that a citation chip, an archive row, a search hit and a shared link
 * all resolve to, which is what makes a page in this archive citable at all.
 * Before this route existed the only address for a page was transient UI state
 * inside `/archive`, so there was nothing to link to or share.
 *
 * `?q=` carries the reader's search term across navigation (CHUNK 3, 3e-3).
 * Losing the query on the way from a result list into the document is the most
 * common complaint about archive sites: the reader arrives at the page having
 * forgotten why, with nothing marked. Putting the term in the URL rather than
 * in a store means it also survives a refresh, a shared link and the back
 * button, all for free.
 *
 * A thin server component over a client reader: `params` and `searchParams`
 * are awaited here (Next 16 — both are promises), and everything after that is
 * interactive, so the split falls naturally at the parse.
 */

export const metadata: Metadata = {
  title: "Read an issue — Anglophone Chile",
  description:
    "Read a scanned nineteenth-century Chilean newspaper issue page by page, with its extracted text, scans and figures.",
};

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { documentId } = await params;
  const { page, q } = await searchParams;

  return (
    <DocumentReader
      documentId={documentId}
      initialPage={parsePageParam(page)}
      initialQuery={parseQueryParam(q)}
    />
  );
}

/**
 * Parse `?q=` into a search term.
 *
 * Bounded at the same 500 characters the search Route Handler enforces, so a
 * hand-edited link cannot make the reader fire a request the proxy will reject
 * with a 413 and then report as a failed search. A repeated param arrives as
 * an array; the first is taken, on the same reasoning as `?page=`.
 */
function parseQueryParam(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined) return "";
  return value.slice(0, 500);
}

/**
 * Parse `?page=` into a page number, or null.
 *
 * Null means "no usable request", not "page 1" — the reader resolves that
 * against the pages that actually exist, because an issue's first ingested
 * page is not guaranteed to be numbered 1. Everything unusable collapses to
 * null here rather than being defended against downstream: a repeated param
 * (`?page=2&page=5`) arrives as an array, and a hand-edited or truncated link
 * can carry anything at all. A bad value opens the issue at its beginning,
 * which is the right outcome for a stale shared link.
 */
function parsePageParam(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined) return null;

  // `Number.parseInt` would accept "7abc" and "7.9"; a page number is an
  // integer or it is nothing.
  if (!/^\d+$/.test(value)) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
