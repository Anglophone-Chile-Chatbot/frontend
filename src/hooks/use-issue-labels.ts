"use client";

import { useEffect, useState } from "react";

import type { DocumentListResponse } from "@/lib/api/types";
import { editionName, issueLabels } from "@/lib/editions";

/**
 * The archive-wide "Supplement" / "Issue 1" / "Issue 2" labels, for views that
 * show one issue at a time (tester item 16, 2026-11-26).
 *
 * `issueLabels` needs every issue of the same paper and day to number them,
 * and the reader heading, a Sources row or the scope bar only hold one. So the
 * list is fetched once per page load (one shared request, kept in module
 * scope) and every caller reads the same map. Until it arrives, or if it
 * fails, the label falls back to the printed edition name, which is what
 * these views showed before.
 *
 * Limit: one page of 200 issues covers today's archive (15). The full
 * collection (~4,300 issues) needs the server to send the label with each
 * issue instead; that is recorded in frontend/plans.md.
 */
let shared: Promise<Map<string, string>> | null = null;

function loadLabels(): Promise<Map<string, string>> {
  if (shared === null) {
    shared = fetch("/api/documents?limit=200")
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<DocumentListResponse>;
      })
      .then((body) => issueLabels(body.results))
      .catch(() => {
        shared = null;
        return new Map<string, string>();
      });
  }
  return shared;
}

export function useIssueLabels(): Map<string, string> {
  const [labels, setLabels] = useState<Map<string, string>>(() => new Map());
  useEffect(() => {
    let live = true;
    void loadLabels().then((map) => {
      if (live) setLabels(map);
    });
    return () => {
      live = false;
    };
  }, []);
  return labels;
}

/** The label for one issue: the archive-wide one, else its printed edition. */
export function issueLabelFor(
  labels: Map<string, string>,
  documentId: string,
  edition: string | null | undefined,
): string | null {
  return labels.get(documentId) ?? editionName(edition);
}
