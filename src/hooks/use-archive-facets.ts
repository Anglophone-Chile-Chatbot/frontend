"use client";

import { useEffect, useState } from "react";
import type { DocumentFacetsResponse, PublicationFacet } from "@/lib/api/types";

let cachedFacets: DocumentFacetsResponse | null = null;
let inFlightPromise: Promise<DocumentFacetsResponse | null> | null = null;

async function fetchFacets(): Promise<DocumentFacetsResponse | null> {
  if (cachedFacets) return cachedFacets;
  if (inFlightPromise) return inFlightPromise;

  inFlightPromise = fetch("/api/documents/facets")
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Failed to load facets (${res.status})`);
      }
      const data: DocumentFacetsResponse = await res.json();
      cachedFacets = data;
      return data;
    })
    .catch((err) => {
      // Don't poison cache on failure
      inFlightPromise = null;
      throw err;
    })
    .finally(() => {
      inFlightPromise = null;
    });

  return inFlightPromise;
}

export function useArchiveFacets() {
  const [data, setData] = useState<DocumentFacetsResponse | null>(cachedFacets);
  const [isLoading, setIsLoading] = useState<boolean>(!cachedFacets);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (cachedFacets) {
      return;
    }

    fetchFacets()
      .then((res) => {
        if (!cancelled && res) {
          setData(res);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load facets");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const totalIssues =
    data?.facets.reduce((sum, f) => sum + f.issue_count, 0) ?? 0;

  return {
    facets: data?.facets ?? ([] as PublicationFacet[]),
    totalIssues,
    undatedCount: data?.undated_count ?? 0,
    isLoading,
    error,
  };
}
