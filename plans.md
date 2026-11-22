# frontend/plans.md
> Living checklist scoped to the `frontend/` repo (Next.js 16, shadcn, chat UI, viewer).
> Read at session start. Delete items when done. Add confirmed decisions immediately. No other planning `.md` files.
> **Next.js 16, not 15**: `params` is async; read `node_modules/next/dist/docs/` before writing Next code (AGENTS.md).
> **This repo is PUBLIC**: this file and `TESTING.md` are world-readable. No secrets, no private names.

**Pruned 2026-11-13.** Removed: the W4c history (done, live 2026-10-24) and the long deployment retraction. Full
pre-prune text: `git show 064ed33:plans.md`; older: `git show 660afe3:plans.md`.

---

## Deploying: a push to `main` deploys (Vercel git integration, connected 2026-07-15)

- Live address: **https://anglochile.vercel.app** (project `anglochile`; the old `frontend-gamma-dun-82.vercel.app`
  still points at the same project). Verify there, not on localhost, before calling work shipped.
- To check a deploy: one `gh api repos/Anglophone-Chile-Chatbot/frontend/commits/<sha>/status` (a `Vercel`/`success`
  status), then one `curl` of a new route. Never a wait loop. `npx vercel --prod` works but is never required.
- Traps: `curl` can get a 403 "Vercel Security Checkpoint" (bot check, a real browser passes); direct
  `frontend-<hash>-….vercel.app` URLs 302 to auth. Neither means the site is down. Never call the deploy path
  broken without checking the commit status first (the 2026-09-17 false alarm).

---

## WHAT'S NEXT, in order (2026-11-13). Start here.

Nothing on the site blocks the GPU work (backend CHUNK 29), which is the project's critical path right now.

1. **W9 below: the first tester report (2026-11-23).** Citation numbers, raw citation codes, Stop, the "Searched
   for" line, dates in the filter panel, New question, the supplement label. Goes with backend CHUNK 30 (the memory
   fixes). Keep `TESTING.md` current in the same turn as each reader-visible change.
2. **Require CI before `main` deploys**, now that a second contributor exists: branch protection on this public repo
   (require a PR and the `lint-typecheck-build` check, admins exempt). One click for Shakib in GitHub settings;
   Claude Code's permission guard blocked doing it.
3. **Small:** the header wordmark sits off-centre next to the rail on desktop (noticed 2026-08-11); check, fix if true.
4. **Open check:** the newspapers rail, filters, "See every match" and the By-issue list on a real phone and on the
   live site (checked at 375 px and 1352 px locally only). A browser check: ask first, then hand it to a helper.
5. **"Find all", the rest** (with backend CHUNK 22): the result block, relevance-filtered list, export, once the
   backend has them.
6. **Article leftovers** (with backend CHUNK 19): outline the article region over the scan; a `kind` filter so adverts
   can be left out of find-all.
7. **After the bulk run** (backend CHUNK 28 tier 3): credit line per scan source, "Also at the British Library",
   "About this paper", "Cite this issue", later place/publisher/decade filters. Mobile-first, `TESTING.md` same turn.

## W9 — answer, source and control fixes from the first tester report. PLANNED 2026-11-23

Each item was checked against the code before planning. The memory and reference bugs are backend CHUNK 30; these are
the browser's share. Every item is designed at 375 px first, with 44 px targets, and gets its `TESTING.md` line the
same turn it ships.

1. **Citation numbers must match the Sources list.** Today the chips number by first citation in the answer
   (`assignCitationOrdinals`) while `SourceList` numbers by arrival order (`index + 1`), so "[1]" and "item 1" are
   different passages whenever a passage goes unused. Fix: the list shows cited passages first, in citation order,
   with the same number as the chip; unused ones follow under a small "Matched the search, not used" heading,
   unnumbered, instead of greyed rows mixed in. Computed at render time, so chats already saved fix themselves.
2. **Never show raw citation codes.** One `normalizeCitations()` in `lib/citations.ts`, run before the ordinals,
   `remarkCite` and `classifySourceUse`, splits `[CITE:a, b]`, `[CITE:a; b]` and `[CITE:a, CITE:b]` into separate
   markers, and hides any leftover bracket of bare ids. That also stops those passages being greyed as "not used".
   The server will normalise new answers too (CHUNK 30 step 2); this covers chats saved before that.
3. **Stop says it stopped.** New turn status `stopped` (today an abort is marked `complete`). With text: keep it and
   add a quiet "You stopped this answer." Before any text: no "None of these answers the question" (which claims the
   archive has no answer); say "Stopped before an answer was written. The passages it found are below." with the
   list headed "Passages found". `session-store.ts` keeps `stopped` as is; follow-up history skips turns stopped
   before any text (already the case, since their answer is empty).
4. **The "Searched for" line on every answer.** Today it only shows when a follow-up was rewritten. Show it always,
   small and muted: a follow-up shows the rewritten question; a first or new-topic question shows the search words
   (first five terms); and a question asked mid-conversation that the server treated as a new subject says "Treated
   as a new question". That last case is the signal the tester was missing (backend CHUNK 30, finding 5).
5. **Dates are hard to find in "Newspapers and dates".** The controls exist but only inside each newspaper once it's
   expanded (year chips and "Custom dates…" per paper). Add an archive-wide "Dates" block at the top of the panel:
   from-year and to-year selects spanning the archive's years, plus custom dates, applying across all papers. Keep
   the per-paper chips. Check the chip and scope labels still read right with both kinds set.
6. **New question shouldn't silently delete the saved conversation.** Today it clears the transcript and deletes the
   saved copy at once. No confirm dialog (that's friction); instead a "Conversation cleared · Undo" bar for 10
   seconds, and the saved copy is deleted only when the bar closes or the reader asks the next question.
7. **Say "Supplement", never a file name.** The picker's edition label is the document's file name, so the 14 Mar
   1891 supplement shows as "Chilean TImes 1" (a typo from the original file). Once the backend returns `edition`
   (CHUNK 30 step 4), show "Supplement" in the picker, citation chips, the Sources list and the viewer header, and
   drop file names from anything a reader sees. Two same-day issues with no edition fall back to "Issue 1 / Issue 2"
   by page count order, never the file name.
8. **`TESTING.md` A7 rewritten** to match: the tester's conversations become the steps (wreck → first ship → topic
   switch; sports list → "the first one"; Stop before and during an answer), each marked changed.

Build: items 1-4 and 6 need nothing from the backend and can ship first. Items 5 and 7 after. A helper can build
it from this spec in its own working copy; review the diff and check at 375 px before merge.

**Dropped / parked:** react-pdf (PDFs never reach the server; drop unless a tester asks). Turnstile waits on
Cloudflare, which waits on a domain.

## Phase 2+
- [ ] Semantic search UI, "similar passages" panel in the viewer (after embeddings, backend CHUNK 15).
- [ ] Cross-document pattern discovery UI, on top of backend CHUNK 24 R5 (entity index) and R2 (reprints).
- [ ] NextAuth v5 activation (Phase 3; dormant shell today).
