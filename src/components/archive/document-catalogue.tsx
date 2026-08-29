"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";

import type { CatalogueGroup } from "@/hooks/use-catalogue";
import type { DocumentSummary } from "@/lib/api/types";
import { formatIssueDateShort } from "@/lib/citations";
import { cn } from "@/lib/utils";

/**
 * The archive's catalogue — what exists, before anyone types anything.
 *
 * **This is the front door, not a fallback.** The users are academic
 * historians, and they do not arrive knowing the search term — not knowing it
 * is the reason they came. The site used to demand a query before showing
 * anything, and the catalogue appeared only in the search box's idle state,
 * which is why it was effectively invisible. Now the catalogue is the page and
 * search is a filter within it.
 *
 * **No cover images, and that is a decision rather than an omission.** Nothing
 * in the pipeline emits a thumbnail: `render.py` produces exactly one size, and
 * no backend route resizes anything. A cover would therefore be the full
 * 1630px scan — ~496-552KB measured live — which is merely wasteful for nine
 * cards and unshippable for the ~600 the bulk run will produce: **600 × 552KB ≈
 * 330MB on one page.** Building a real thumbnail path is backend work
 * (a route, a resize, a cache, a re-render pass) and is explicitly outside this
 * chunk's frontend-only scope, so the catalogue is designed not to need one.
 * What a card shows instead is what a card is actually for: the publication,
 * the date and how long the issue is. The scan grid inside an issue is where
 * the imagery lives, one tap away.
 *
 * A **figure count per issue is deliberately absent** for the same
 * do-not-invent-work reason. `DocumentSummary` does not carry one, and there is
 * no per-document figures endpoint; deriving it would mean fetching every
 * issue's page list — nine requests today, six hundred later — to decorate a
 * card. The count is shown where it is already known for free: on the reader's
 * Figures tab, from the page list that view has to load anyway.
 *
 * Rows navigate to `/document/<id>` rather than opening the viewer in place.
 * They used to open page 1 in the side panel, which was a dead end: the panel
 * shows one page and cannot reach page 2, so browsing a 16-page issue was
 * impossible from here. Browsing has no conversation to lose and no highlighted
 * passage to preserve — unlike a citation, which still opens the viewer in
 * place — so a real route is strictly better: shareable, back-buttonable, and
 * able to page.
 */
export function DocumentCatalogue({
  groups,
  total,
  shown,
  applied,
  status,
  isLoadingMore,
  hasMore,
  onLoadMore,
}: {
  groups: CatalogueGroup[];
  /** Issues matching the current filter, corpus-wide — not `shown`. */
  total: number;
  /** Issues actually loaded, which is `total` only until paging begins. */
  shown: number;
  /** The filter the loaded rows answer, for the empty state. */
  applied: string;
  status: "loading" | "loaded" | "error";
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}) {
  if (status === "loading") return <CatalogueLoadingNote />;
  if (status === "error") return <CatalogueErrorNote />;
  if (groups.length === 0) return <CatalogueEmptyNote filter={applied} />;

  return (
    <>
      <p className="eyebrow mb-4">
        {applied.length > 0
          ? `${total} ${total === 1 ? "issue matches" : "issues match"} “${applied}”`
          : `${total} ${total === 1 ? "issue" : "issues"} in the archive`}
      </p>

      <div className="flex flex-col gap-7">
        {groups.map((group) => (
          <section key={group.key}>
            <div className="rule-b flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 pb-1.5">
              <h2 className="font-heading text-[1.0625rem] leading-snug text-foreground">
                {group.publication}
              </h2>
              <p className="numeric text-[0.75rem] text-muted-foreground">
                {group.period}
                {" · "}
                {group.issues.length === 1
                  ? "1 issue"
                  : `${group.issues.length} issues`}
              </p>
            </div>

            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {group.issues.map((issue) => (
                <IssueCard key={issue.document_id} issue={issue} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={isLoadingMore}
          className={cn(
            "mt-6 flex min-h-[44px] w-full items-center justify-center gap-2",
            "rounded-md border text-[0.8125rem] text-foreground",
            "transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
            "hover:bg-secondary disabled:opacity-60",
          )}
        >
          {isLoadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isLoadingMore
            ? "Loading…"
            : `Show more — ${shown} of ${total} shown`}
        </button>
      )}
    </>
  );
}

/**
 * One issue.
 *
 * A card rather than a row, because a row of text is a search result and this
 * is a *thing on a shelf* — the whole point of the catalogue is that an issue
 * of a newspaper is an object a historian picks up. It carries what is worth
 * knowing before picking it up: how long it runs, and whether it has pictures.
 *
 * Keyed and linked on `document_id` alone. `The Chilian Times 1891-03-14`
 * already appears twice in the live corpus with nothing to distinguish the
 * pair; telling them apart is CHUNK 4's job, but nothing here may assume a
 * title and a date identify an issue.
 */
function IssueCard({ issue }: { issue: DocumentSummary }) {
  const date = formatIssueDateShort(issue.issue_date);

  // A document with no pages ingested cannot be opened. It is still listed —
  // it is genuinely in the archive — but as static text rather than a control
  // that looks tappable and then does nothing when tapped.
  if (issue.page_count === 0) {
    return (
      <li className="animate-rise">
        <div className="rounded-md border border-dashed bg-card/50 px-3 py-2.5">
          <IssueMeta issue={issue} date={date} />
          <p className="mt-1 text-[0.75rem] text-muted-foreground">
            No pages ingested yet — nothing to open.
          </p>
        </div>
      </li>
    );
  }

  return (
    <li className="animate-rise">
      <Link
        href={`/document/${issue.document_id}`}
        className={cn(
          "flex min-h-[44px] flex-col justify-center rounded-md border bg-card px-3 py-2.5",
          "transition-colors duration-[120ms] ease-[var(--ease-crisp)]",
          "hover:border-[var(--accent)]/60 hover:bg-secondary",
          "focus-visible:outline-2 focus-visible:outline-offset-2",
          "focus-visible:outline-[var(--accent)]",
        )}
      >
        <IssueMeta issue={issue} date={date} />
        <p className="numeric mt-1 text-[0.75rem] text-muted-foreground">
          {issue.page_count === 1 ? "1 page" : `${issue.page_count} pages`}
        </p>
      </Link>
    </li>
  );
}

/** The issue's identity line — the date is what distinguishes it on the shelf. */
function IssueMeta({
  issue,
  date,
}: {
  issue: DocumentSummary;
  date: string | null;
}) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      {date ? (
        <time className="numeric text-[0.875rem] leading-snug text-foreground">
          {date}
        </time>
      ) : (
        // Falls back to the title rather than to a placeholder: an unreadable
        // masthead leaves both `publication` and `issue_date` null, and the
        // title is always set and usually still names the issue.
        <span className="text-[0.875rem] leading-snug text-foreground">
          {issue.title}
        </span>
      )}
    </p>
  );
}

/** Shown while the first page of the catalogue is in flight. */
function CatalogueLoadingNote() {
  return (
    <p className="flex items-center gap-2 text-[0.875rem] text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      Loading the archive…
    </p>
  );
}

function CatalogueEmptyNote({ filter }: { filter: string }) {
  if (filter.length > 0) {
    return (
      <div className="measure">
        <h2 className="font-heading text-[0.9375rem] text-foreground">
          No issue is titled “{filter}”
        </h2>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
          This filter matches publication names and issue titles. To find the
          word inside the pages themselves, search the full text below.
        </p>
      </div>
    );
  }

  return (
    <div className="measure">
      <h2 className="font-heading text-[0.9375rem] text-foreground">
        No issues in the archive yet
      </h2>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
        Scanned pages appear here as they are added.
      </p>
    </div>
  );
}

function CatalogueErrorNote() {
  return (
    <div className="measure">
      <h2 className="font-heading text-[0.9375rem] text-foreground">
        The archive could not be listed
      </h2>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
        The archive service did not respond. Try again in a moment.
      </p>
    </div>
  );
}
