import type { ArchiveFilterState } from "@/lib/api/types";
import { formatIssueDateShort } from "@/lib/citations";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True for a real calendar date in YYYY-MM-DD form. The pattern alone accepts
 * "2020-99-99", which the backend rejects with a 422 and the catalogue then
 * shows as "the archive service did not respond": a hand-edited URL should be
 * ignored, not read as an outage.
 */
export function isIsoDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
  );
}

function isTruthy(value: string | null): boolean {
  return value === "1" || value === "true";
}

/** Safe regex escaping for any user/data strings. */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Parse filter state from either URLSearchParams or Next.js page searchParams object. */
export function parseFilterParams(
  params: URLSearchParams | Record<string, string | string[] | undefined> | null | undefined,
): ArchiveFilterState {
  if (!params) {
    return { publications: [], dateFrom: null, dateTo: null, undated: false };
  }

  const publications: string[] = [];
  let dateFrom: string | null = null;
  let dateTo: string | null = null;
  let undated = false;

  if (params instanceof URLSearchParams) {
    const rawPubs = params.getAll("pub").concat(params.getAll("publication"));
    for (const p of rawPubs) {
      const trimmed = p.trim();
      if (trimmed.length > 0 && !publications.includes(trimmed)) {
        publications.push(trimmed);
      }
    }
    const rawFrom = params.get("from") ?? params.get("date_from");
    if (rawFrom && isIsoDate(rawFrom)) {
      dateFrom = rawFrom;
    }
    const rawTo = params.get("to") ?? params.get("date_to");
    if (rawTo && isIsoDate(rawTo)) {
      dateTo = rawTo;
    }
    undated = isTruthy(params.get("undated"));
  } else {
    // Record<string, string | string[] | undefined>
    const pubVal = params.pub ?? params.publication;
    if (Array.isArray(pubVal)) {
      for (const p of pubVal) {
        if (typeof p === "string" && p.trim()) {
          const trimmed = p.trim();
          if (!publications.includes(trimmed)) publications.push(trimmed);
        }
      }
    } else if (typeof pubVal === "string" && pubVal.trim()) {
      publications.push(pubVal.trim());
    }

    const fromVal = params.from ?? params.date_from;
    if (typeof fromVal === "string" && isIsoDate(fromVal)) {
      dateFrom = fromVal;
    }

    const toVal = params.to ?? params.date_to;
    if (typeof toVal === "string" && isIsoDate(toVal)) {
      dateTo = toVal;
    }

    const undatedVal = params.undated;
    undated = typeof undatedVal === "string" && isTruthy(undatedVal);
  }

  // "Undated" is a set of its own: a paper or a date range cannot apply to it.
  if (undated) return { publications: [], dateFrom: null, dateTo: null, undated: true };
  return { publications, dateFrom, dateTo, undated: false };
}

/** Serialize filter state to URLSearchParams (omitting empty filters). */
export function serializeFilterParams(
  filters: ArchiveFilterState,
  baseParams?: URLSearchParams,
): URLSearchParams {
  const params = new URLSearchParams(baseParams ? baseParams.toString() : "");

  // Clear existing filter keys
  params.delete("pub");
  params.delete("publication");
  params.delete("from");
  params.delete("date_from");
  params.delete("to");
  params.delete("date_to");
  params.delete("undated");

  if (filters.undated) {
    params.set("undated", "1");
    return params;
  }
  for (const pub of filters.publications) {
    params.append("pub", pub);
  }
  if (filters.dateFrom) {
    params.set("from", filters.dateFrom);
  }
  if (filters.dateTo) {
    params.set("to", filters.dateTo);
  }

  return params;
}

/** Check if any newspaper or date filter is active. */
export function hasActiveFilters(filters: ArchiveFilterState): boolean {
  return (
    filters.undated ||
    filters.publications.length > 0 ||
    filters.dateFrom !== null ||
    filters.dateTo !== null
  );
}

/**
 * Format a human-readable label for the active filters scope.
 * Examples:
 * - "The Star of Chile, 1904–1905"
 * - "The Chilian Times"
 * - "1891–1904"
 * - "All newspapers"
 */
export function formatScopeLabel(filters: ArchiveFilterState): string {
  if (!hasActiveFilters(filters)) {
    return "All newspapers";
  }

  if (filters.undated) return "Undated issues";

  const parts: string[] = [];

  if (filters.publications.length === 1) {
    parts.push(filters.publications[0]);
  } else if (filters.publications.length > 1) {
    parts.push(`${filters.publications.length} newspapers`);
  }

  const range = formatDateChipLabel(filters.dateFrom, filters.dateTo);
  if (range) parts.push(range);

  return parts.join(", ") || "Filtered archive";
}

/**
 * Read a date range the way a person would say it. Whole years read as "1904"
 * or "1904–1905"; anything else keeps its day and month ("1 Jun 1904 – 31 Dec
 * 1904"), so a half-year range is never mislabelled as a whole year.
 */
export function formatDateChipLabel(dateFrom: string | null, dateTo: string | null): string {
  const short = (iso: string) => formatIssueDateShort(iso) ?? iso;
  if (dateFrom && dateTo) {
    const fromYear = dateFrom.slice(0, 4);
    const toYear = dateTo.slice(0, 4);
    if (dateFrom === `${fromYear}-01-01` && dateTo === `${toYear}-12-31`) {
      return fromYear === toYear ? fromYear : `${fromYear}–${toYear}`;
    }
    return `${short(dateFrom)} – ${short(dateTo)}`;
  }
  if (dateFrom) return `From ${short(dateFrom)}`;
  if (dateTo) return `Until ${short(dateTo)}`;
  return "";
}
