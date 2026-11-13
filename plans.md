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

1. **Second contributor's test results** (`TESTING.md`, follow-ups in A7). None recorded yet as of 2026-11-13. Fix
   what comes back; keep `TESTING.md` current in the same turn as any reader-visible change.
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

**Dropped / parked:** react-pdf (PDFs never reach the server; drop unless a tester asks). Turnstile waits on
Cloudflare, which waits on a domain.

## Phase 2+
- [ ] Semantic search UI, "similar passages" panel in the viewer (after embeddings, backend CHUNK 15).
- [ ] Cross-document pattern discovery UI, on top of backend CHUNK 24 R5 (entity index) and R2 (reprints).
- [ ] NextAuth v5 activation (Phase 3; dormant shell today).
