"use client";

import {
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Library,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useArchiveFacets } from "@/hooks/use-archive-facets";
import type { ArchiveFilterState } from "@/lib/api/types";
import { formatDateChipLabel, hasActiveFilters } from "@/lib/archive-filters";
import { cn } from "@/lib/utils";

interface NewspaperRailProps {
  filters: ArchiveFilterState;
  onSelectPublication: (pub: string | null) => void;
  onSelectDateRange: (from: string | null, to: string | null) => void;
  /** Newspaper and dates chosen together, as one URL update. */
  onSelectPublicationDates: (pub: string, from: string | null, to: string | null) => void;
  onSelectUndated: () => void;
  onClearFilters: () => void;
  className?: string;
  onItemSelect?: () => void;
}

/**
 * Newspaper folder rail — browsing by newspaper publication and date range.
 *
 * Implements an ARIA tree (role="tree", role="treeitem", arrow navigation).
 * Publication names use Playfair Display (font-heading), numbers and years use Inter (numeric).
 * Purple accent is reserved strictly for active selection and focus rings.
 */
export function NewspaperRail({
  filters,
  onSelectPublication,
  onSelectDateRange,
  onSelectPublicationDates,
  onSelectUndated,
  onClearFilters,
  className,
  onItemSelect,
}: NewspaperRailProps) {
  const { facets, totalIssues, undatedCount, isLoading, error } = useArchiveFacets();

  // Explicit user toggles for folder expansion
  const [manualExpanded, setManualExpanded] = useState<Record<string, boolean>>({});
  const [customRangeOpen, setCustomRangeOpen] = useState<Record<string, boolean>>({});

  // Tree keyboard navigation focus management
  const treeRef = useRef<HTMLUListElement>(null);

  const toggleExpanded = useCallback((pubName: string, currentlyExpanded: boolean) => {
    setManualExpanded((prev) => ({ ...prev, [pubName]: !currentlyExpanded }));
  }, []);

  const toggleCustomRange = useCallback((pubName: string) => {
    setCustomRangeOpen((prev) => ({ ...prev, [pubName]: !prev[pubName] }));
  }, []);

  // Keyboard navigation for ARIA tree
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      const tree = treeRef.current;
      if (!tree) return;

      const items = Array.from(
        tree.querySelectorAll<HTMLElement>('[role="treeitem"]'),
      );
      const activeElement = document.activeElement as HTMLElement | null;
      const currentIndex = items.indexOf(activeElement ?? ({} as HTMLElement));

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
          items[nextIndex]?.focus();
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
          items[prevIndex]?.focus();
          break;
        }
        case "ArrowRight":
        case "ArrowLeft": {
          // Expand or collapse through the folder's own chevron, which is
          // where the toggle handler lives. Clicking the <li> did nothing.
          const want = e.key === "ArrowRight" ? "false" : "true";
          if (activeElement?.getAttribute("aria-expanded") === want) {
            e.preventDefault();
            activeElement.querySelector<HTMLElement>(":scope > [data-tree-row] button")?.click();
          }
          break;
        }
        case "Enter":
        case " ": {
          // Select the focused row. Only when the <li> itself has focus, so
          // Enter on a year chip or the date form still does its own thing.
          if (activeElement?.getAttribute("role") === "treeitem" && e.target === activeElement) {
            e.preventDefault();
            const row = activeElement.querySelector<HTMLElement>(":scope > [data-tree-row]");
            (row ?? activeElement).click();
          }
          break;
        }
        case "Home": {
          e.preventDefault();
          items[0]?.focus();
          break;
        }
        case "End": {
          e.preventDefault();
          items[items.length - 1]?.focus();
          break;
        }
      }
    },
    [],
  );

  const isAllSelected = !hasActiveFilters(filters);

  if (isLoading) {
    return <NewspaperRailSkeleton className={className} />;
  }

  if (error) {
    return (
      <aside
        className={cn(
          "w-60 shrink-0 border-r bg-[var(--sidebar)] p-4 text-[0.8125rem]",
          className,
        )}
      >
        <div className="flex items-start gap-2 text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
          <p className="leading-snug">
            Unable to load newspaper categories · showing all issues
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "flex w-60 shrink-0 flex-col overflow-y-auto bg-[var(--sidebar)]",
        className,
      )}
    >
      <div className="px-3.5 pt-4 pb-2">
        <p className="eyebrow px-1">Newspapers</p>
      </div>

      <ul
        ref={treeRef}
        role="tree"
        aria-label="Newspapers folder tree"
        onKeyDown={handleKeyDown}
        className="flex flex-1 flex-col gap-0.5 px-2 pb-6"
      >
        {/* Root Node: All Newspapers */}
        <li
          role="treeitem"
          tabIndex={isAllSelected ? 0 : -1}
          aria-selected={isAllSelected}
          onClick={() => {
            onClearFilters();
            onItemSelect?.();
          }}
          className={cn(
            "group flex min-h-[44px] cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2",
            "text-[0.8125rem] transition-colors duration-[140ms] ease-[var(--ease-crisp)]",
            "hover:bg-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
            isAllSelected
              ? "border-l-2 border-[var(--accent)] bg-[var(--accent)]/[0.06] font-medium text-foreground pl-2"
              : "text-foreground/80",
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Library
              className={cn(
                "h-4 w-4 shrink-0 transition-colors duration-[140ms]",
                isAllSelected ? "text-[var(--accent)]" : "text-muted-foreground",
              )}
            />
            <span className="font-heading truncate text-[0.875rem] text-foreground">
              All newspapers
            </span>
          </span>
          <span className="numeric text-[0.75rem] text-muted-foreground">
            {totalIssues}
          </span>
        </li>

        {/* Publication Folders */}
        {facets.map((pub) => {
          const isPubSelected = filters.publications.includes(pub.publication);
          const isExpanded = manualExpanded[pub.publication] ?? isPubSelected;
          const isRangeOpen = !!customRangeOpen[pub.publication];

          return (
            <li
              key={pub.publication}
              role="treeitem"
              tabIndex={isPubSelected ? 0 : -1}
              aria-selected={isPubSelected}
              aria-expanded={isExpanded}
              className="flex flex-col focus-visible:outline-none [&:focus-visible>[data-tree-row]]:ring-1 [&:focus-visible>[data-tree-row]]:ring-[var(--accent)]"
            >
              {/* Folder Row */}
              <div
                data-tree-row
                className={cn(
                  "group flex min-h-[44px] cursor-pointer items-center justify-between gap-1.5 rounded-md px-2 py-2",
                  "text-[0.8125rem] transition-colors duration-[140ms] ease-[var(--ease-crisp)]",
                  "hover:bg-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
                  isPubSelected
                    ? "border-l-2 border-[var(--accent)] bg-[var(--accent)]/[0.06] font-medium pl-1.5"
                    : "text-foreground/85",
                )}
                onClick={() => {
                  if (!isPubSelected) {
                    onSelectPublication(pub.publication);
                    if (!isExpanded) toggleExpanded(pub.publication, isExpanded);
                  } else {
                    // Clicking already selected publication toggles back to all or keeps it
                    onSelectPublication(pub.publication);
                  }
                  onItemSelect?.();
                }}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {/* Chevron Toggle Button */}
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={`${isExpanded ? "Collapse" : "Expand"} ${pub.publication}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(pub.publication, isExpanded);
                    }}
                    className="-my-2 flex h-11 w-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>

                  {/* Folder Icon (never emoji) */}
                  {isExpanded ? (
                    <FolderOpen
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isPubSelected ? "text-[var(--accent)]" : "text-muted-foreground",
                      )}
                    />
                  ) : (
                    <Folder
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isPubSelected ? "text-[var(--accent)]" : "text-muted-foreground",
                      )}
                    />
                  )}

                  {/* Publication Title in Playfair */}
                  <span
                    className="font-heading min-w-0 flex-1 truncate text-[0.875rem] text-foreground leading-snug"
                    title={pub.publication}
                  >
                    {pub.publication}
                  </span>
                </div>

                {/* Issue Count in Inter */}
                <span className="numeric shrink-0 pr-1 text-[0.75rem] text-muted-foreground">
                  {pub.issue_count}
                </span>
              </div>

              {/* Subtree: Years and Date Range */}
              {isExpanded && (
                <div
                  role="group"
                  className="mt-0.5 mb-1.5 flex flex-col gap-1 border-l border-border/60 pl-4 ml-4 transition-all duration-[140ms] ease-[var(--ease-crisp)]"
                >
                  {/* Year Chips */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {pub.years.map((yearFacet) => {
                      const yearStr = String(yearFacet.year);
                      const isYearSelected =
                        isPubSelected &&
                        filters.dateFrom?.startsWith(yearStr) &&
                        filters.dateTo?.startsWith(yearStr);

                      return (
                        <button
                          key={yearFacet.year}
                          type="button"
                          onClick={() => {
                            if (isYearSelected) {
                              onSelectPublicationDates(pub.publication, null, null);
                            } else {
                              onSelectPublicationDates(
                                pub.publication,
                                `${yearStr}-01-01`,
                                `${yearStr}-12-31`,
                              );
                            }
                            onItemSelect?.();
                          }}
                          className={cn(
                            "flex min-h-[44px] items-center gap-1 rounded-md border px-2.5 py-1 text-xs",
                            "transition-colors duration-[140ms] ease-[var(--ease-crisp)]",
                            isYearSelected
                              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)] font-medium"
                              : "border-border/80 bg-card text-foreground hover:bg-secondary",
                          )}
                        >
                          <span className="numeric">{yearFacet.year}</span>
                          <span
                            className={cn(
                              "numeric text-[0.6875rem]",
                              isYearSelected
                                ? "text-[var(--accent-foreground)]/80"
                                : "text-muted-foreground",
                            )}
                          >
                            ({yearFacet.issue_count})
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Range Toggle */}
                  <div className="pt-1.5">
                    <button
                      type="button"
                      onClick={() => toggleCustomRange(pub.publication)}
                      className="flex min-h-[44px] items-center gap-1.5 text-[0.75rem] text-muted-foreground hover:text-foreground"
                    >
                      <Calendar className="h-3 w-3" />
                      <span>{isRangeOpen ? "Hide custom dates" : "Custom dates…"}</span>
                    </button>

                    {isRangeOpen && (
                      <CustomDateRangePicker
                        filters={filters}
                        onApply={(from, to) => {
                          onSelectPublicationDates(pub.publication, from, to);
                          onItemSelect?.();
                        }}
                        onClear={() => {
                          onSelectDateRange(null, null);
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}

        {/* Undated issues row if facets report undated issues */}
        {undatedCount > 0 && (
          <li
            role="treeitem"
            tabIndex={filters.undated ? 0 : -1}
            aria-selected={filters.undated}
            onClick={() => {
              onSelectUndated();
              onItemSelect?.();
            }}
            className={cn(
              "mt-2 min-h-[44px] cursor-pointer rounded-md border border-dashed px-2.5 py-2 text-[0.75rem] text-muted-foreground",
              "transition-colors duration-[140ms] ease-[var(--ease-crisp)] hover:bg-secondary",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
              filters.undated
                ? "border-[var(--accent)] bg-[var(--accent)]/[0.06]"
                : "border-border/80",
            )}
          >
            <div className="flex items-center justify-between font-medium text-foreground">
              <span>Undated issues</span>
              <span className="numeric">{undatedCount}</span>
            </div>
            <p className="mt-0.5 text-[0.6875rem] leading-normal text-muted-foreground">
              Issues without a verified publication date.
            </p>
          </li>
        )}
      </ul>
    </aside>
  );
}

/** Custom date range picker using native <input type="date"> (clean mobile support). */
function CustomDateRangePicker({
  filters,
  onApply,
  onClear,
}: {
  filters: ArchiveFilterState;
  onApply: (from: string | null, to: string | null) => void;
  onClear: () => void;
}) {
  const [from, setFrom] = useState(filters.dateFrom ?? "");
  const [to, setTo] = useState(filters.dateTo ?? "");

  const hasRange = filters.dateFrom !== null || filters.dateTo !== null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onApply(from || null, to || null);
      }}
      className="mt-1 flex flex-col gap-2 rounded-md border bg-card/60 p-2.5 text-xs"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="rail-date-from" className="text-[0.6875rem] text-muted-foreground">
          From
        </label>
        <input
          id="rail-date-from"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="min-h-[44px] rounded border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="rail-date-to" className="text-[0.6875rem] text-muted-foreground">
          To
        </label>
        <input
          id="rail-date-to"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="min-h-[44px] rounded border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
        />
      </div>

      <div className="flex items-center gap-1.5 pt-1">
        <button
          type="submit"
          className="flex min-h-[44px] flex-1 items-center justify-center rounded bg-primary px-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Apply
        </button>
        {hasRange && (
          <button
            type="button"
            onClick={() => {
              setFrom("");
              setTo("");
              onClear();
            }}
            className="flex min-h-[44px] items-center justify-center rounded border px-2.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
    </form>
  );
}

/** Fixed dimension skeleton for zero layout shift during loading. */
export function NewspaperRailSkeleton({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "flex w-60 shrink-0 flex-col overflow-y-auto bg-[var(--sidebar)] p-3",
        className,
      )}
    >
      <div className="h-3 w-20 animate-pulse rounded bg-muted mb-4 ml-1" />
      <div className="flex flex-col gap-1.5">
        <div className="h-10 w-full animate-pulse rounded-md bg-muted/60" />
        <div className="h-10 w-full animate-pulse rounded-md bg-muted/60" />
        <div className="h-10 w-full animate-pulse rounded-md bg-muted/60" />
        <div className="h-10 w-full animate-pulse rounded-md bg-muted/60" />
      </div>
    </aside>
  );
}

/**
 * Mobile Sheet Drawer for the Newspaper Rail.
 * Triggered by the "Newspapers" button beside the search box at screen sizes below `lg`.
 */
export function NewspaperDrawer({
  open,
  onOpenChange,
  filters,
  onSelectPublication,
  onSelectDateRange,
  onSelectPublicationDates,
  onSelectUndated,
  onClearFilters,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ArchiveFilterState;
  onSelectPublication: (pub: string | null) => void;
  onSelectDateRange: (from: string | null, to: string | null) => void;
  onSelectPublicationDates: (pub: string, from: string | null, to: string | null) => void;
  onSelectUndated: () => void;
  onClearFilters: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[280px] p-0 sm:max-w-xs"
        aria-describedby="newspaper-drawer-description"
      >
        <SheetHeader className="rule-b px-4 py-3.5">
          <SheetTitle className="font-heading text-lg font-normal text-foreground">
            Newspapers
          </SheetTitle>
          <SheetDescription id="newspaper-drawer-description" className="sr-only">
            Filter archive documents by newspaper publication and date range.
          </SheetDescription>
        </SheetHeader>
        <div className="h-full overflow-y-auto">
          <NewspaperRail
            filters={filters}
            onSelectPublication={onSelectPublication}
            onSelectDateRange={onSelectDateRange}
            onSelectPublicationDates={onSelectPublicationDates}
            onSelectUndated={onSelectUndated}
            onClearFilters={onClearFilters}
            className="w-full border-r-0 bg-transparent"
            onItemSelect={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Removable filter chips rendered below search box when filters are active. */
export function ActiveFilterChips({
  filters,
  onRemovePublication,
  onClearDateRange,
  onClearAll,
}: {
  filters: ArchiveFilterState;
  onRemovePublication: (pub: string) => void;
  onClearDateRange: () => void;
  onClearAll: () => void;
}) {
  if (!hasActiveFilters(filters)) return null;

  const dateLabel = formatDateChipLabel(filters.dateFrom, filters.dateTo);

  if (filters.undated) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 pt-2.5">
        <span className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-3 pr-1 text-xs text-foreground shadow-xs">
          <span className="font-heading text-[0.8125rem]">Undated issues</span>
          <button
            type="button"
            onClick={onClearAll}
            aria-label="Remove undated filter"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-2.5">
      {filters.publications.map((pub) => (
        <span
          key={pub}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-card pl-3 pr-1 py-1 text-xs text-foreground shadow-xs"
        >
          <span className="font-heading text-[0.8125rem]">{pub}</span>
          <button
            type="button"
            onClick={() => onRemovePublication(pub)}
            aria-label={`Remove ${pub} filter`}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      {dateLabel && (
        <span className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-card pl-3 pr-1 py-1 text-xs text-foreground shadow-xs">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="numeric">{dateLabel}</span>
          <button
            type="button"
            onClick={onClearDateRange}
            aria-label="Remove date filter"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      )}

      {(filters.publications.length > 1 || (filters.publications.length >= 1 && dateLabel)) && (
        <button
          type="button"
          onClick={onClearAll}
          className="flex min-h-[44px] items-center px-2 text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
