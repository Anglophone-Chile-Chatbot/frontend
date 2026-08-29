"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DocumentListResponse, DocumentSummary } from "@/lib/api/types";

/**
 * The archive's catalogue: which issues exist, filtered and paged.
 *
 * **Server-side filtering and paging, deliberately, on a corpus of nine.**
 * `GET /documents` already takes `q` (substring over title and publication),
 * `limit` (default 50, max 200) and `offset`. Fetching all nine issues once and
 * filtering them in the browser would be simpler today and would have to be
 * torn out at ~600 issues, which is where the bulk run lands the corpus — a
 * ~60× jump. Designing for the corpus that is coming rather than the one on the
 * box is the single most expensive thing to get wrong here, so the filter is a
 * request and the list is a page.
 *
 * A filter keystroke is debounced into that request. Grouping happens in
 * `groupIssues` over whatever page has been loaded, not over the whole corpus:
 * a group header is a heading for the rows beneath it, never a claim about how
 * many issues of that publication the archive holds.
 */

/**
 * Issues per request.
 *
 * The backend's default is 50 and its ceiling is 200. 24 is a page of cards
 * rather than a page of data — enough that the nine-issue corpus arrives whole
 * and a 600-issue one still opens instantly, few enough that "Show more" is a
 * real, cheap step rather than a token gesture over an already-loaded list.
 */
const PAGE_SIZE = 24;

/** Debounce before a filter keystroke becomes a request. */
const DEBOUNCE_MS = 250;

export type CatalogueStatus = "loading" | "loaded" | "error";

export function useCatalogue() {
  const [filter, setFilter] = useState("");
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<CatalogueStatus>("loading");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  /** The filter the current `documents` answer — not the one being typed. */
  const [applied, setApplied] = useState("");
  const controllerRef = useRef<AbortController | null>(null);

  const term = filter.trim();

  const load = useCallback(async (query: string, offset: number) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    if (offset === 0) setStatus("loading");
    else setIsLoadingMore(true);

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      // Omitted rather than sent empty — the Route Handler drops an empty `q`
      // anyway, and sending one would read as a filter that matched everything.
      if (query.length > 0) params.set("q", query);

      const response = await fetch(`/api/documents?${params}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(String(response.status));

      const body = (await response.json()) as DocumentListResponse;
      setTotal(body.total);
      setDocuments((current) =>
        offset === 0 ? body.results : [...current, ...body.results],
      );
      setApplied(query);
      setStatus("loaded");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("error");
    } finally {
      setIsLoadingMore(false);
    }
  }, []);

  // First page, and every change of filter. Debounced so typing "Mercury" is
  // one request rather than seven.
  useEffect(() => {
    const timer = window.setTimeout(() => void load(term, 0), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [term, load]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const loadMore = useCallback(() => {
    void load(applied, documents.length);
  }, [load, applied, documents.length]);

  const groups = useMemo(() => groupIssues(documents), [documents]);

  return {
    filter,
    setFilter,
    /** The filter the loaded rows answer, for empty-state copy. */
    applied,
    documents,
    groups,
    total,
    status,
    isLoadingMore,
    hasMore: documents.length < total,
    loadMore,
  };
}

/** Issues of one publication, in one span of years. */
export interface CatalogueGroup {
  /** Stable key — publication plus decade, both already normalised. */
  key: string;
  publication: string;
  /** e.g. "1890s", or "1904–1905" when a decade holds more than one year. */
  period: string;
  issues: DocumentSummary[];
}

/**
 * Group the loaded issues by publication, then by decade.
 *
 * Sorting is `issue_date DESC` and nothing else on the backend
 * (`document_service.py`), which is right for nine issues and unreadable at
 * six hundred: a flat reverse-chronological column of six hundred rows is a
 * wall, and the corpus spans **1843-12-16 → 1905-01-14 across 3 publications**
 * — exactly the shape that wants grouping. Decade rather than year because
 * three publications × six decades is a browsable outline, while three × sixty
 * years would be as long as the list it is meant to organise.
 *
 * The backend's date ordering is preserved *within* each group, and groups
 * themselves are emitted newest-first, so the catalogue still reads
 * chronologically top to bottom.
 *
 * **Keyed on `document_id` throughout, never on title or date.** Two documents
 * in the live corpus are both `The Chilian Times 1891-03-14`, four pages each,
 * with nothing to tell them apart — labelling that pair is CHUNK 4's job, but
 * a catalogue that used title+date as a key would collapse them into one row
 * and silently hide an issue of the archive. At 600 issues that pairing is
 * routine rather than exotic.
 */
function groupIssues(documents: DocumentSummary[]): CatalogueGroup[] {
  const groups = new Map<string, CatalogueGroup>();

  for (const issue of documents) {
    // An unreadable masthead leaves `publication` null; `title` is always set.
    const publication = issue.publication ?? issue.title;
    const year = issue.issue_date ? Number(issue.issue_date.slice(0, 4)) : null;
    const decade = year === null ? null : Math.floor(year / 10) * 10;
    const key = `${publication}::${decade ?? "undated"}`;

    const existing = groups.get(key);
    if (existing) {
      existing.issues.push(issue);
      continue;
    }

    groups.set(key, {
      key,
      publication,
      period: decade === null ? "Undated" : `${decade}s`,
      issues: [issue],
    });
  }

  // Narrow each period to the years actually present. "1904–1905" is a more
  // useful heading than "1900s" when the decade holds two issues, and the
  // archive's real shape is a handful of issues per decade, not a full run.
  for (const group of groups.values()) {
    const years = group.issues
      .map((issue) => issue.issue_date?.slice(0, 4))
      .filter((year): year is string => year !== undefined);
    if (years.length === 0) continue;

    // Computed rather than read off the ends of the array: the backend orders
    // `issue_date DESC`, but a null date sorts wherever Postgres puts it, so
    // relying on position would mislabel a group holding one undated issue.
    const sorted = [...years].sort();
    const earliest = sorted[0];
    const latest = sorted[sorted.length - 1];
    group.period = earliest === latest ? earliest : `${earliest}–${latest}`;
  }

  return [...groups.values()];
}
