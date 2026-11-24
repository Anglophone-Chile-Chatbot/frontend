/**
 * What a reader sees for an issue's edition (W9 item 7, backend CHUNK 30).
 *
 * The 14 March 1891 Chilian Times is two documents, the issue and its
 * supplement, and the site used to tell them apart by file name ("Chilean
 * TImes 1", typo included). File names are provenance, never reader copy, so
 * nothing here ever reads `source_stem` or the old stem-valued
 * `edition_label`. The label comes only from what the paper printed
 * (`edition`), and two same-day issues with no edition fall back to "Issue 1"
 * and "Issue 2" (by page count, larger first, then id) rather than an edition
 * the paper never printed.
 */

const EDITION_NAMES: Record<string, string> = {
  supplement: "Supplement",
  extra: "Extra",
};

/** "Supplement" / "Extra", or null for the main issue (or an unknown value). */
export function editionName(edition: string | null | undefined): string | null {
  return edition ? (EDITION_NAMES[edition] ?? null) : null;
}

interface IssueLike {
  document_id: string;
  publication: string | null;
  issue_date: string | null;
  page_count: number;
  edition?: string | null;
}

/**
 * The label each issue in a list needs to be told apart, keyed by id.
 * Absent for an issue that is already unambiguous.
 */
export function issueLabels(issues: readonly IssueLike[]): Map<string, string> {
  const labels = new Map<string, string>();
  const plainByDay = new Map<string, IssueLike[]>();
  for (const issue of issues) {
    const name = editionName(issue.edition);
    if (name) {
      labels.set(issue.document_id, name);
      continue;
    }
    const key = `${issue.publication ?? ""}\u0000${issue.issue_date ?? ""}`;
    const group = plainByDay.get(key) ?? [];
    group.push(issue);
    plainByDay.set(key, group);
  }
  for (const group of plainByDay.values()) {
    if (group.length < 2) continue;
    [...group]
      .sort((a, b) => b.page_count - a.page_count || a.document_id.localeCompare(b.document_id))
      .forEach((issue, index) => labels.set(issue.document_id, `Issue ${index + 1}`));
  }
  return labels;
}
