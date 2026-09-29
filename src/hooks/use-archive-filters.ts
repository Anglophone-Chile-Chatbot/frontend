"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ArchiveFilterState } from "@/lib/api/types";
import {
  formatScopeLabel,
  hasActiveFilters,
  parseFilterParams,
  serializeFilterParams,
} from "@/lib/archive-filters";

export function useArchiveFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read current filters from URL search parameters
  const filters: ArchiveFilterState = useMemo(() => {
    return parseFilterParams(searchParams);
  }, [searchParams]);

  const isFiltered = useMemo(() => hasActiveFilters(filters), [filters]);
  const scopeLabel = useMemo(() => formatScopeLabel(filters), [filters]);

  const updateUrl = useCallback(
    (newFilters: ArchiveFilterState) => {
      const current = new URLSearchParams(searchParams ? searchParams.toString() : "");
      const updated = serializeFilterParams(newFilters, current);
      // Keep other params like `q` intact
      const queryStr = updated.toString();
      router.replace(queryStr ? `${pathname}?${queryStr}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setPublication = useCallback(
    (pub: string | null) => {
      updateUrl({
        ...filters,
        publications: pub ? [pub] : [],
      });
    },
    [filters, updateUrl],
  );

  const togglePublication = useCallback(
    (pub: string) => {
      const exists = filters.publications.includes(pub);
      const nextPubs = exists
        ? filters.publications.filter((p) => p !== pub)
        : [...filters.publications, pub];
      updateUrl({
        ...filters,
        publications: nextPubs,
      });
    },
    [filters, updateUrl],
  );

  const setDateRange = useCallback(
    (from: string | null, to: string | null) => {
      updateUrl({
        ...filters,
        dateFrom: from,
        dateTo: to,
      });
    },
    [filters, updateUrl],
  );

  const setYear = useCallback(
    (year: number | null) => {
      if (year === null) {
        setDateRange(null, null);
      } else {
        setDateRange(`${year}-01-01`, `${year}-12-31`);
      }
    },
    [setDateRange],
  );

  const clearFilters = useCallback(() => {
    updateUrl({
      publications: [],
      dateFrom: null,
      dateTo: null,
    });
  }, [updateUrl]);

  const removePublication = useCallback(
    (pub: string) => {
      updateUrl({
        ...filters,
        publications: filters.publications.filter((p) => p !== pub),
      });
    },
    [filters, updateUrl],
  );

  const clearDates = useCallback(() => {
    updateUrl({
      ...filters,
      dateFrom: null,
      dateTo: null,
    });
  }, [filters, updateUrl]);

  return {
    filters,
    isFiltered,
    scopeLabel,
    setPublication,
    togglePublication,
    setDateRange,
    setYear,
    clearFilters,
    removePublication,
    clearDates,
  };
}
