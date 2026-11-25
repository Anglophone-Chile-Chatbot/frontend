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

1. **W9's browser check** (built 2026-11-24; see W9 below). Then the second contributor re-runs `TESTING.md` A7/A8.
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

## W9 — built 2026-11-24 (with backend CHUNK 30). One check left

All nine items shipped: one citation numbering for chips and the Sources list ("Matched the search, not used"
for the rest), raw citation codes hidden, an honest Stop, the "Searched for" / "Treated as a new question" line,
an archive-wide Dates block, New question with a 10-second Undo, "Supplement" instead of file names (with an
"Issue 1 / Issue 2" fallback), the "Which did you mean?" chips, and `TESTING.md` A7/A8 rewritten. Record:
git history and `infra/BUILT.md`.
- Browser check done 2026-11-24 (Antigravity, 375/390/412 px and 1352 px): all flows OK; fixed what it found
  (adjacent citation chips stealing taps, the Dates panel closing on the first pick, desktop controls under 44 px).
  Code review the same day (Codex): six edge cases fixed. Not yet seen live: the "Which did you mean?" chips.
- [ ] **Small, no live case today:** the "Issue 1 / Issue 2" fallback shows in lists but not in the reader header
  (the reader only knows its own issue). Needs the sibling group passed in (or a backend field) once two same-day
  issues without an edition exist.
- [ ] **Zoom without pixelation (Shakib, 2026-11-25).** Today's scans are a 192 DPI render (~1920 px wide, about 23%
  of the library scan's pixels), so zooming blurs on an ordinary laptop. The originals are 4000 px (backend
  EXPERIMENTS run 29). **Settled (Shakib 2026-11-25, backend CHUNK 31):** 3,200 px AVIF q60, or the page's own
  width if smaller (~30% of pages are only ~1,500 px), ~1.3 MB a page on average, made in Google Colab from Drive
  and moved as bundles. Never scanner size. Frontend part (backend WHAT'S NEXT step 3): show a light preview
  (~1,000-1,200 px) first and swap in the full image as the reader zooms, so a page opens no slower than today;
  check at 375 px and on a laptop. Plan only, not built.

**Dropped / parked:** react-pdf (PDFs never reach the server; drop unless a tester asks). Turnstile waits on
Cloudflare, which waits on a domain.

## Phase 2+
- [ ] Semantic search UI, "similar passages" panel in the viewer (after embeddings, backend CHUNK 15).
- [ ] Cross-document pattern discovery UI, on top of backend CHUNK 24 R5 (entity index) and R2 (reprints).
- [ ] NextAuth v5 activation (Phase 3; dormant shell today).
