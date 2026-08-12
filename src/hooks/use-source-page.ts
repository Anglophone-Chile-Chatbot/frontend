"use client";

import { useEffect, useState } from "react";

import type { PageDetail, ViewerSource } from "@/lib/api/types";

/**
 * Fetches the page a citation or search result points to.
 *
 * Shared by the mobile sheet and desktop docked source viewers so the two
 * can't drift — both are thin renderers over this one fetch.
 */
export function useSourcePage(source: ViewerSource | null) {
  const pageId = source?.page_id ?? null;
  const [page, setPage] = useState<PageDetail | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">(
    pageId ? "loading" : "idle",
  );
  const [tab, setTab] = useState<"text" | "image">("text");

  // Reset when the viewer moves to a different page, so a slow request can
  // never paint over newer content. Done during render rather than in an
  // effect: an effect would show one frame of the previous page's text.
  // Seeded with `null` so a viewer that mounts already open still takes the
  // reset path and shows its loading state.
  const [renderedPageId, setRenderedPageId] = useState<string | null>(null);
  if (pageId !== renderedPageId) {
    setRenderedPageId(pageId);
    setPage(null);
    setStatus(pageId ? "loading" : "idle");
    setTab("text");
  }

  useEffect(() => {
    if (!pageId) return;

    const controller = new AbortController();
    fetch(`/api/pages/${pageId}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<PageDetail>;
      })
      .then((detail) => {
        setPage(detail);
        setStatus("idle");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      });

    return () => controller.abort();
  }, [pageId]);

  return { page, status, tab, setTab };
}
