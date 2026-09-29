import type { ArchiveFilterState } from "@/lib/api/types";

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

/** Safe regex escaping for any user/data strings. */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Parse filter state from either URLSearchParams or Next.js page searchParams object. */
export function parseFilterParams(
  params: URLSearchParams | Record<string, string | string[] | undefined> | null | undefined,
): ArchiveFilterState {
  if (!params) {
    return { publications: [], dateFrom: null, dateTo: null };
  }

  const publications: string[] = [];
  let dateFrom: string | null = null;
  let dateTo: string | null = null;

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
  }

  return { publications, dateFrom, dateTo };
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

  const parts: string[] = [];

  if (filters.publications.length === 1) {
    parts.push(filters.publications[0]);
  } else if (filters.publications.length > 1) {
    parts.push(`${filters.publications.length} newspapers`);
  }

  if (filters.dateFrom && filters.dateTo) {
    const fromYear = filters.dateFrom.slice(0, 4);
    const toYear = filters.dateTo.slice(0, 4);
    if (fromYear === toYear) {
      parts.push(fromYear);
    } else {
      parts.push(`${fromYear}–${toYear}`);
    }
  } else if (filters.dateFrom) {
    parts.push(`from ${filters.dateFrom.slice(0, 4)}`);
  } else if (filters.dateTo) {
    parts.push(`until ${filters.dateTo.slice(0, 4)}`);
  }

  return parts.join(", ") || "Filtered archive";
}

/** Format a friendly label for the date filter chip. */
export function formatDateChipLabel(dateFrom: string | null, dateTo: string | null): string {
  if (dateFrom && dateTo) {
    const fromYear = dateFrom.slice(0, 4);
    const toYear = dateTo.slice(0, 4);
    if (dateFrom === `${fromYear}-01-01` && dateTo === `${fromYear}-12-31`) {
      return fromYear;
    }
    if (fromYear === toYear) {
      return `${dateFrom} to ${dateTo}`;
    }
    if (dateFrom === `${fromYear}-01-01` && dateTo === `${toYear}-12-31`) {
      return `${fromYear}–${toYear}`;
    }
    return `${dateFrom} to ${dateTo}`;
  }
  if (dateFrom) return `From ${dateFrom}`;
  if (dateTo) return `To ${dateTo}`;
  return "";
}
