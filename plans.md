# frontend/plans.md
> Living checklist scoped to the `frontend/` repo only (Next.js 16, shadcn, chat UI, viewer).
> Read at session start. Remove items when actually done. Add confirmed decisions/tasks immediately.
> Never create other planning `.md` files — this is the only one for this repo.
> NOTE: this repo is on Next.js 16 (not 15) — read `node_modules/next/dist/docs/` before writing Next code; APIs differ from training data (async params, proxy.ts, etc). See AGENTS.md.

---

## ⚠️ DEPLOYING THIS REPO — pushing to `main` publishes NOTHING (found 2026-08-31)

**Vercel is not connected to this GitHub repo.** Unlike the backend (which has real push-to-deploy
CI/CD), a merge here reaches GitHub and stops there. This was found by shipping the CHUNK 11 fixes
and then checking: **the live production deploy was 20 days old** while the code sat on GitHub
looking shipped. Git history reading as "done" is exactly what makes this bite.

**So: after any frontend change, deploy it yourself —**

```
cd frontend && npx vercel --prod --yes      # ~30s
```

Prod alias: `https://frontend-theta-bay-62.vercel.app`. **Verify on that URL, not localhost**, before
calling frontend work shipped. Tracked as **I3** in `infra/plans.md`; the real
fix (connecting the repo in the Vercel dashboard) needs Shakib and is not something a session can do.

---

## READ FIRST — this file is authoritative for the frontend; root `plans.md` is RETIRED

**Root `plans.md` was retired 2026-09-16** and is no longer read at session start. It is not the
cross-repo tiebreaker any more — there is no tiebreaker above the per-repo files, and where they
disagree, the repo that owns the code owns the answer. Anything still open in root was moved into the
owning repo in that same pass (the **D-series** pipeline audit and **C5** went to `backend/plans.md`);
the archived copy is `plans.archive.md` at the root, kept for history only. Do not restore a
dependency on it.

**Frontend owns CHUNK 2 (the reader), CHUNK 3 (images + front door), and part of CHUNK 6.** All CHUNK
work is complete — "THE CHUNKS" had zero open items at retirement, so nothing was carried across.

**Next.js 16, not 15** — `params` is async in route handlers and pages
(`const { documentId } = await params`). Read `node_modules/next/dist/docs/` before writing Next
code; APIs differ from training data. See AGENTS.md.

---

## CHUNK 2 — ✅ DONE 2026-08-29. The document reader exists.

Shakib on the live site, 2026-08-28: *"no way to just click and see the document nor click and see
all the images … the document viewer isn't clean view so the vision i had for a perfectly online
reader (text + images stitched) isn't there."*

**The reader half of that is now built and verified in a real browser against the live Oracle
backend.** (The "all the images" half — a scan grid and a figure gallery — is CHUNK 3 and is still
open.)

- [x] **2c — `src/app/document/[documentId]/page.tsx`.** Async `params` *and* `searchParams`
      (Next 16 — both are promises; confirmed against `node_modules/next/dist/docs/`).
      `?page=` is parsed with `/^\d+$/` rather than `parseInt`, which would accept `7abc` and `7.9`.
      An unusable value yields null, and the reader resolves that against the pages that actually
      exist — a stale shared link opens the issue rather than a dead end.
- [x] **2d — `SourceViewerBody` reused unchanged.** Not forked, not modified, not copied. The reader
      is chrome *around* it: text/scan tabs, inline figures at `text_anchor`, the figure overlay and
      the honest blank-page note all come from the component that was already verified. What was
      missing was never the renderer — it was knowing an issue has 16 pages.
- [x] **2e — Page navigation.** Prev/next, "Page N of M", keyboard ←/→, and a page jump. All three
      controls measure **exactly 44×44** in the browser at 375px, and all three are hit-testable
      (`elementFromPoint` returns the control itself, not an overlay).
- [x] **2f — Deep-linkable `/document/<id>?page=N`.** The URL is written on every turn with
      `router.replace`, not `push` — 16 pages of history between the reader and where they came from
      would turn Back into "previous page" instead of "leave".
- [x] **2g — Prefetch the neighbours on idle.** Both directions, behind a **400ms settle** — see the
      bug below, which is the reason the delay exists.
- [x] **2h — Blank pages render the honest note AND the scan**, and are marked in the jump *before*
      anyone navigates in (`Page 5 — blank`). Verified on *The Chilian Times* 1891-12-30 p5: the note
      renders, and the Scan tab serves a real **1630×2138** image of a genuine blank endpaper.

**Where citations go, and why the chip does NOT navigate.** The plan said "repoint citation chips
… here". Chips deliberately still open the viewer in place; a **`ReadIssueLink` ("Read the whole
issue", 44px, deep-linked to the page already open)** was added to both the mobile sheet and the
docked panel instead. Two reasons, both load-bearing: Phase 1 chat is **stateless and in-memory**,
so a chip that routed away would trade the reader's entire conversation for one page — and it would
discard the **passage highlight**, which is the whole reason a citation opens a viewer rather than a
link. Verified still intact after the change: opening an `earthquake` hit renders **9 `<mark>`
elements**, first one `earthquake`, and the link points at `?page=2` — the cited page, not page 1.

**Archive catalogue rows DO navigate** (`<Link href="/document/<id>">`). Browsing has no conversation
to lose and no passage to preserve, and the old behaviour — open page 1 in a panel that cannot reach
page 2 — was the dead end this chunk exists to remove.

### Definition of Done — measured in a real browser, production build, live Oracle backend

| check | result |
|---|---|
| all 16 pages of *The Star of Chile* 1904-12-03 read in sequence | **16/16**, no search used, **0 failures** |
| horizontal scroll at 375px | **none**, on every one of the 16 pages and on the blank-page issue |
| `?page=9` deep link | lands on the **football-team photo** — "THE CHAMPION FOOTBALL TEAM OF SANTIAGO" + "GROUP OF ARAUCANIAN INDIANS", **2 figures**, both loading real pixels (868×568, 1516×1191) |
| inline figures across the issue | 1,3,1,5,1,0,0,3,2,0,0,2,0,0,0,1 — matching the backend's per-page `figure_count` |
| blank pages | note + scan + `Page N — blank` in the jump, verified on 1891-12-30 p5 |
| tap targets (prev / jump / next) | **44×44 each**, all hit-testable in the production build |
| keyboard | ← → both page and update the URL (16→15→16) |
| page jump | 16 → 4 lands on page 4 with its 5 figures |
| desktop 1440px | header, tabs and nav all centred at 336–1104; article at `.measure` width |
| console errors, clean sweep | **0** |
| nginx `limiting requests` during clean sweep | **0** |

### The bug this chunk found in its own first version — prefetch vs the rate limiter

The first 16-page sweep produced **9 × HTTP 502** and one page rendering "That page could not be
loaded". It was not a backend fault and not a bad page: nginx's `api_general` zone (60r/m, burst 30,
CHUNK 0) was rejecting the requests, confirmed in the server log —
`limiting requests, excess: 30.8 by zone "api_general"`.

**The cause was mine.** `usePagePrefetch` fired immediately on every page change, so each turn cost
*three* requests (the page + both neighbours). Paging quickly — a held arrow key, repeated taps, the
jump control — multiplies straight into the limiter, and the reader sees 502s on pages that are
perfectly healthy. Fixed with a **400ms settle**: the pages a reader *skips past* are now never
fetched at all, so the request rate tracks pages actually read rather than buttons pressed. Re-run at
reading pace: **16/16 pages, 0 failures, 0 console errors, 0 nginx limiting events.**

Worth keeping, because it will recur: **any speculative fetch added to this app is multiplied by the
reader's impatience and lands on a shared 60r/m budget.** Prefetching is not free here.

---

## Vercel deploy check — corrected 2026-08-29, same session

Wrongly reported this chunk as blocked on deploy, based on `vercel ls`/`vercel inspect` from the
CLI showing the newest Production deployment as 18 days old. **That CLI output was wrong or stale
— the dashboard (`vercel.com/khandokar-shakibs-projects/frontend`) shows Production `● Ready`,
deployed from `c50c026` on `main`, and `GET https://frontend-gamma-dun-82.vercel.app
/api/documents/<id>/pages` returns real live data.** Auto-deploy-on-push works exactly as documented
elsewhere in this file. Root-caused only as far as: `vercel ls`/`vercel inspect` cannot be trusted to
reflect current Production state on this project — check the dashboard, not the CLI listing, before
concluding a deploy did not happen.

---

## CHUNK 3 — ✅ DONE 2026-08-29. Images are a first-class surface; the archive has a front door.

Answered the other half of the complaint: *"no way to click and see all the images"* and
*"archive and ask is literally the same"*.

**What governed every call, and still should:** the users are academic historians who do **not**
arrive knowing the search term — not knowing it is the reason they came. The site demanded a query
before showing anything, which is backwards. One sentence drove the whole chunk: a researcher should
browse the collection, open any issue, see its pictures, and search inside it — without ever
guessing a keyword. That is now true.

**NOW VERIFIED IN A REAL BROWSER — 2026-08-29, follow-up pass.** The original ship was `tsc`/`eslint`/
`next build` clean plus live backend measurement, with no browser check. That gap is now closed:
dev server on 3417, Playwright at **375px and 1440px**, live Oracle backend. Everything in the chunk
works. Measured:

| surface | 375px | desktop 1440px |
|---|---|---|
| `/archive` catalogue — grouped by publication, year-spans ("1904–1905 · 2 issues"), page counts | ✅ no h-scroll (sw 375) | ✅ rail + catalogue + docked panel |
| catalogue dual filter — `Mercury` → "3 issues match" (cards) **+** "25 passages inside the pages" (full-text), both labelled | ✅ | ✅ |
| reader tabs **Read / Scans 8 / Figures 10** | ✅ all **44px** tall, hit-testable | ✅ |
| Scans grid — 2-col mobile / 4-col desktop, `object-cover object-top`, lazy, per-page figure-count marks, masthead not cropped | ✅ no reflow, no h-scroll | ✅ |
| Figures gallery — real ~33KB crops, sequential fill, "N figures were found", "region on the page" only on `Text`/`ComplexRegion`/`Table` bbox figures (4 of 20 on Star p1/p2), honest empty state | ✅ | ✅ |
| within-issue search — `steamer` → "9 passages on 5 pages", rank-ordered jump chips (p.12 · p.1 · p.2 · p.6 · p.5), `?q=` in URL, passage highlighted via `findPassage`, page-jump shows "Page N — match" | ✅ no h-scroll | ✅ |
| nav relabel "Ask" / "Browse", active-state underline | ✅ | ✅ |
| console errors across the sweep | **0** (one 404 was a bad test-harness `fetch`, not the app) | — |

**Nothing needed fixing.** Two pre-existing, out-of-scope notes confirmed still true, not touched:
- ~~Within-issue / catalogue search **snippets print raw markdown**~~ → ✅ **FIXED 2026-08-31
  (CHUNK 11)**, and fixed in the *frontend*, not the backend as this line guessed: stored text must
  keep its markdown (the section prefix is load-bearing for retrieval), so flattening is a rendering
  concern. `src/lib/snippet-text.ts` → `flattenSnippetMarkdown()`, applied inside `Snippet`.
  Note the surfaces differ from what this line assumed: the within-issue search renders **page
  chips**, not text snippets, so it had no raw-markdown surface at all — checked, not assumed.
- ~~**Text / Scan sub-tabs and nav links measure 40px**~~ → ✅ **FIXED 2026-08-31 (CHUNK 6b/6c)**,
  both now 44px and measured in-browser.
- The docked viewer panel on `/archive` shows "Tap a citation number to read the original page here."
  even though Browse has no citations — cosmetic, pre-dates this chunk (it's the shared shell from
  the 2026-08-11 redesign), left as-is.

**The two indistinguishable `The Chilian Times 14 Mar 1891` rows render identically** in both the
catalogue and the desktop Collections rail — confirmed here, and **fixed by CHUNK 4 on 2026-08-29**:
both surfaces now carry a `Source: <stem>` label, shown only for a same-day pair. See the CHUNK 4
section below.

**Measured live 2026-08-29 against the Oracle box before building anything** — these superseded
guesses, and all agreed with what the plan already recorded:
- 9 issues, 3 publications, 71 pages, spanning 1843-12-16 → 1905-01-14.
- **66 figures**, per-issue **20, 16, 10, 5, 5, 4, 4, 2, 0** — *Valparaiso English Mercury
  1844-01-27* really does have **zero**, so the empty state is real and is handled honestly.
- A page scan is **~496–552KB** WebP; a figure crop is **~33KB**. Confirms crops can be gridded
  directly and full scans cannot be used as catalogue covers.
- Document-scoped search works and needed **no backend change**: `steamer` scoped to *The Star of
  Chile* 1904-12-03 → 9 passages across 5 pages, all in scope. `total` is a true `count(*)`, not a
  capped number — but a common word can genuinely hit the 50-row ceiling (`Valparaiso` in that same
  issue matches **exactly 50** chunks), which is why the UI says "showing the strongest 50" rather
  than quietly truncating.

- [x] **3a — Document image view.** `components/archive/document-scans.tsx` — every sheet as a grid,
      `loading="lazy"`, click opens that page. Tiles hold a 1:1.4 aspect box so the grid does not
      reflow as scans arrive, and `object-top` keeps the masthead (the only part that identifies a
      sheet at tile size) from being cropped away.
- [x] **3b — Document figure gallery.** `components/archive/document-figures.tsx` +
      `hooks/use-document-figures.ts` — every crop in the issue, each linking back to its page.
      Empty state is honest and the tab is never hidden or disabled for the zero-figure Mercury.
- [x] **3c — Separate Ask from Archive.** `/archive` is now a catalogue **first**: cards grouped by
      publication and year-span, with one field filtering them. It is no longer buried in the search
      box's `idle` state.
- [x] **3d — Nav labels.** "Ask" / **"Browse"**. The old pair named the *content* of both pages;
      the new pair names the two verbs, which is the actual distinction. Route stays `/archive` —
      renaming a label is free, renaming a URL breaks every link already shared.

### 3e — SEARCH EVERYWHERE — done, and it added no endpoint

- [x] **3e-1 — Search inside the open issue.** `hooks/use-document-search.ts` +
      `components/archive/document-search.tsx`. **No new endpoint**, as `backend/plans.md` asked:
      `GET /search` already took a repeatable `document_id`. The only plumbing needed was
      `app/api/search/route.ts`, which was **dropping the param** — it now forwards it, validates
      the UUID shape (so a hand-edited link is a clear 400, not an opaque 502 relayed from FastAPI's
      422), and caps the list at `MAX_SCOPE_DOCUMENTS`.
- [x] **3e-2 — Hits as page numbers, and jump to them.** Chunk results are folded into *pages* —
      "9 passages on 5 pages" — kept in **rank order, not page order**, so the strongest match is
      the first destination offered. Matching pages are marked in three places: the search row's
      chips, the scan grid's tiles, and the page-jump `<select>`'s option text (a `<select>` cannot
      be styled per option across platforms, so the mark has to be in the words).
- [x] **3e-3 — Query survives navigation.** Carried in the URL as `?q=`, so it also survives a
      refresh, a shared link and the back button — no store needed. Highlighting **reuses
      `findPassage`** (the existing ladder) by handing it the matched chunk's text: a search
      highlight and a citation highlight are now literally the same mechanism, which is what stops
      the two from drifting.
- [x] **3e-4 — The filter narrows cards, not only chunks.** One field runs both `GET /documents?q=`
      (substring over publication/title → narrows the *cards*) and `GET /search` (full text →
      passages listed below). Both results are shown and labelled. Two fields would have made the
      reader guess which index their word belonged to — the same mistake as demanding a search term.
- [x] **3e-5 — Citations open the whole issue.** Already satisfied by CHUNK 2's `ReadIssueLink`;
      this pass only added `?q=` to it so the term rides along from a search hit.

### 3f — BUILT FOR ~600 ISSUES, NOT THE 9 ON THE BOX

- [x] **3f-1 — Catalogue is grouped**, by publication then year-span (`groupIssues` in
      `hooks/use-catalogue.ts`). Decade-derived but narrowed to the years actually present, so a
      heading reads "1904–1905" rather than a mostly-empty "1900s". Group headers describe the rows
      beneath them and never claim a corpus-wide count.
- [x] **3f-2 — Server-side paging and filtering.** `limit`/`offset`/`q` on `GET /documents`, 24 per
      page, "Show more" appends. Nothing is fetched whole and filtered in the browser.
- [x] **3f-3 — Cover thumbnails: NOT BUILT, deliberately, and the catalogue is designed not to need
      them.** Confirmed with Shakib 2026-08-29 before building. Nothing in the pipeline emits a
      thumbnail (`render.py` produces exactly one size; no backend route resizes anything — Pillow
      is a declared dep but unused in `app/`). A cover would therefore be the full ~552KB scan:
      merely wasteful for 9 cards, **~330MB for 600** and unshippable. Building a real thumbnail
      path is backend work — route, resize, cache dir, re-render pass — and outside this chunk's
      frontend-only scope. **So catalogue cards carry no images at all**: publication, date, page
      count. The imagery lives in the scan grid one tap inside an issue, where lazy-loading and the
      one-year `immutable` cache header make full-size tiles acceptable (worst case ~8.5MB for the
      16-page issue, and only for tiles actually scrolled into view).
      **A figure count per card is also absent, same reasoning** — `DocumentSummary` does not carry
      one and there is no per-document figures endpoint, so showing it would mean fetching every
      issue's page list (9 requests today, 600 later) to decorate a card. It is shown on the
      reader's Figures tab instead, where the page list is already loaded.
- [x] **3f-4 — Nothing is keyed on title+date.** Cards, links, groups and React keys all use
      `document_id`. The two indistinguishable `The Chilian Times 1891-03-14` rows both render;
      labelling them was CHUNK 4's job and **landed 2026-08-29** — see the CHUNK 4 section below.
      The `document_id` keying is what made that a pure addition rather than a rewrite.

**Not built, on purpose (scope discipline, per the plan):** saved searches, search history, user
accounts, or anything needing persistence. Phase 1 is stateless; Phase 3 owns accounts.

**Two things a reviewer should know, because they are not obvious from the diff:**
1. **The figure sweep is sequential, not parallel.** nginx applies `api_general` at 60r/m with burst
   30 to every `/api/` call, and a 16-page issue with figures on 12 pages would otherwise fire 12
   parallel requests the instant a tab opened. `usePagePrefetch` already learned this the expensive
   way (9 × 502 on a 16-page sweep, all the limiter, 2026-08-29). The gallery also fills in
   progressively as a result, which is better anyway.
2. **Resets happen during render, not in effects** — `use-source-page`'s established pattern, and
   React 19's `react-hooks/set-state-in-effect` and `react-hooks/refs` rules force the issue. The
   in-flight abort deliberately stays in effect cleanup: a ref cannot be touched during render, and
   the debounce means a superseded request usually never went out.

**Definition of Done — now fully met.** Verified in a real browser at 375px and 1440px on
2026-08-29 (follow-up pass, see the table above): from the front page, any issue's full scan set and
figure set are reachable in ≤2 taps with no query typed; within-issue search jumps to matching pages;
both surfaces are visually distinct; no horizontal scroll at 375px anywhere checked.

---

## CHUNK 4 (frontend half) — ✅ DONE 2026-08-29. The two identical rows are labelled.

**Was:** `The Chilian Times 1891-03-14` rendered as two byte-identical rows — same publication, same
date, nothing to tell them apart — in the catalogue *and* in the desktop Collections rail. Per
Shakib's 2026-08-13 decision this is the legitimate *supplement* case, so it had to be **labelled**,
not deduplicated.

**Shipped.** The backend now sends `edition_label` on `DocumentSummary` and `DocumentPagesResponse`,
non-null **only** when another document shares the publication and date, so every surface renders it
unconditionally and the eight unambiguous issues stay clean. Four surfaces carry it:

| surface | why it needed it |
|---|---|
| `/archive` catalogue card | the two cards were identical; `IssueMeta` so both the openable and the no-pages variant get it |
| desktop **Collections** rail | shows publication + date and nothing else — the surface where the pair is *most* alike, two identical rows stacked |
| document reader header | the header *is* a publication and a date, so opening one issue looked exactly like opening the other |
| chat **scope picker** | the sharpest one: it drives a checkbox, so scoping a question to one 1891-03-14 issue could silently answer about the other |

**It is rendered as `Source: <stem>`, never as an edition number** — deliberate, and the reason is
worth keeping. Reading "2" out of `Chilean Times 2` and printing "Edition 2" would be inventing a
bibliographic fact in a citation-traceable archive, *and it would be wrong*: that stem is the
**supplement** (its page 1 reads `Supplement to "The Chilian Times"`) while `Chilean TImes 1` is the
main issue. The stem is a true, checkable statement about provenance; an edition number is not.

Small layout decisions, so they are not re-litigated: the rail truncates rather than wraps (fixed
240px column, a wrapping stem would make rows uneven); the reader puts it on **its own line** rather
than as another `·`-separated item, since burying the one distinguishing fact in a run of page and
figure counts defeats the purpose.

**Verified in a real browser 2026-08-29** — headless Chromium against the live Oracle backend, at
**375px and 1440px**, plus a screenshot read back at 375px:

| check | 375px | 1440px |
|---|---|---|
| catalogue cards carrying a `Source` label | **2 of 9** — the 1891-03-14 pair only | **2 of 9** |
| the two labels | `Chilean Times 2` / `Chilean TImes 1` | same |
| Collections rail rows | n/a (rail is `lg:` and up) | `14 Mar 1891 · Chilean Times 2` and `14 Mar 1891 · Chilean TImes 1`; the other 4 rows unchanged |
| reader header, `184a87a6…` | `Source Chilean Times 2` | same |
| reader header, `bcbe1b94…` | `Source Chilean TImes 1` | same |
| horizontal scroll | **none** — `scrollWidth 375 === innerWidth 375` on catalogue and both readers | none |
| console errors | **0** | **0** |

`tsc --noEmit`, `eslint src`, and `next build` all clean (Next 16.2.10).

**A note on which is which, because the names are actively misleading.** Stem `Chilean Times 2` is
the **supplement** — its page 1 reads `# Supplement to "The Chilian Times"` — and `Chilean TImes 1`
(sic, the typo is in the real filename) is the main issue. The root plan had guessed the pair was
"Chilean Times 2" / "Chilean Times short"; it is not — `Chilean Times short` is a different issue
entirely, 1891-02-07. This is exactly why the label shows the stem rather than a derived edition
number: any inference from those names would have been backwards.

---

## CHUNK 6 (frontend half) — ✅ DONE 2026-08-31. Two were real; the third was a mis-measurement.

- [x] **6b — `site-header.tsx`** — nav links `min-h-[40px]` → `min-h-[44px]`. Real height is correct
      here: the header is `h-14` (56px), so a 44px child fits with room to spare.
- [x] **6c — `source-viewer-body.tsx`** — Text/Scan tabs `min-h-[40px]` → `min-h-[44px]`. Same
      reasoning — block-level flex children in their own row.
- [x] **6d — `citation-chip.tsx` — NOT A DEFECT. This entry was wrong.** The chip already carried a
      44×44px hit area via an `::after` pseudo-element. The "15×12px" figure measured the *visible*
      chip, not the tap target — a wrong-layer measurement, the exact error CLAUDE.md's MEASURE THE
      THING ITSELF rule describes. Confirmed by reading the computed `::after` style directly:
      visible 16×13px, **hit area 44×44px**. It must *keep* using a pseudo-element rather than real
      height, because real size on an inline element breaks the answer's line box — so "fixing" this
      as originally written would have caused a regression.
- [ ] **6e — Re-check the header wordmark centring** (recorded further down this file) — **still
      open**, not touched in this pass.

**Verified in a real browser at 375px after the change**, not inferred from the classes: nav links
44px tall, viewer tabs 172×44px, `scrollWidth == clientWidth == 375` (no horizontal overflow).

**Clean, verified 2026-08-28 — do not re-audit:** no `any` types, no `console.log`, loading/error
states present on every fetching surface.

---

## CHUNK 7 (frontend half) — DONE 2026-08-31. Next.js 16.2.10 → 16.3.3 (security).

The July and August 2026 Next.js security releases patched an **unauthenticated RCE via AVIF image
optimization** (a libheif flaw reached through `sharp`; the patched releases disable AVIF
optimization until upstream propagates) and a **critical Windows path traversal**, CVE-2026-75604
(CVSS 9.0), affecting apps using both routers on a Windows filesystem.

**Real exposure here was low, and it is worth writing down why rather than just bumping:** this app
uses `next/image` **nowhere** — every image is a plain `<img>` (`document-scans.tsx`,
`document-figures.tsx`, `page-figures.tsx`, `source-viewer-body.tsx`), because scans are served
through our own Route Handler proxy from Oracle — so the AVIF optimizer is never invoked. Deploys are
Linux/Vercel, so the Windows traversal does not apply either. Bumped anyway: it is free, and
"we happen not to use the vulnerable path" is a weaker position than "we are patched".

`tsc --noEmit`, `npm run lint` and `next build` all clean on 16.3.3 (`eslint-config-next` bumped to
match). **Note for measurement:** run the repo's own `npm run lint`; a bare `npx eslint src` resolves
a different binary here and reports phantom errors.

---

## Done (kept for context — do not re-do)
- create-next-app scaffold: Next.js 16, TS, App Router, Tailwind v4, Turbopack, src-dir, `@/*` alias
- shadcn init (base-nova preset) + components: button, card, input, avatar, badge, separator, scroll-area, skeleton, sonner, dialog, sheet, tabs, tooltip, dropdown-menu
- Deps: ai, @ai-sdk/react, @ai-sdk/google, @ai-sdk/anthropic, react-pdf, motion, next-auth@beta
- `layout.tsx`: Playfair Display (display) + Lora (reading) + Inter (UI), TooltipProvider, Toaster
- `globals.css` `@theme inline`: --font-sans→inter, --font-heading→playfair, --font-serif→lora
- Live on Vercel with auto-deploy on push to main (Hobby, repo public)

## CI/CD — how deploys actually happen (verified 2026-08-11)
Two independent systems, and the distinction matters:
- **GitHub Actions** (`.github/workflows/ci.yml`) — runs `npm run lint`, `tsc --noEmit`, `npm run
  build` on every push/PR to `main`. Quality gate only. It does **not** deploy anything.
- **Vercel** — deploys via its own GitHub integration, independently, on push to `main`. Project
  `prj_MM8t8QobAWJnuDba9CmZ9tvW6w92`, org `team_4g2iLkOnKTKR2R7quL1cwne4`.

So yes, pushing to `main` auto-deploys with no manual step. **But the two don't talk to each other:
Vercel does not wait for Actions to go green, so a commit that fails CI still ships to production.**
That's acceptable at Phase 1 with one engineer who runs the same three checks locally before pushing,
and it's why those local checks aren't optional.
- [ ] Consider gating Vercel on CI (Vercel's "Ignored Build Step" or moving deploys into Actions) if
      the project ever gains a second contributor. Not worth the complexity today — noted so the gap
      is a known trade-off rather than an oversight.

## Phase 1 — built this pass (2026-07-28)
The whole public surface now exists and runs. Verified against a mock backend that
speaks the real SSE protocol — tsc, eslint and `next build` all clean.

- [x] Design system in `globals.css`: academic paper/ink palette (warm bone, not white),
      purple as a *restrained accent only* — links, active states, chips, focus rings, never a
      gradient. CSS-generated newsprint grain (no image asset). Motion tokens capped at 120-180ms.
      Light + dark, `prefers-reduced-motion` honored.
- [x] App shell: `h-dvh` + `overflow-hidden` so the shell owns scrolling and the composer
      stays put when the mobile keyboard opens. Sticky header, safe-area padding, inline nav
      (two destinations don't justify a hamburger).
- [x] Chat UI end-to-end: streaming answer, "Searching the archive…" retrieval state, caret
      indicator, transcript that follows the stream but stops the moment you scroll up to read.
- [x] Citation chips: `[CITE:id]` parsed into tappable chips, repeats share an ordinal, unknown
      ids dropped rather than rendered dead. Partial markers hidden mid-stream so you never see
      `[CITE:8f2` flicker. ~44px tap targets via pseudo-element (doesn't break the line box).
- [x] Source viewer: bottom sheet on mobile, right panel from `sm` — same component, so the
      two can't drift. Text default, exact-substring passage highlight + scroll-to.
- [x] Archive browser: full-text search, ranked results with publication/date/snippet,
      query-term highlighting, load-more pagination.
- [x] Route Handlers proxying FastAPI: `/api/chat` is a byte-level SSE passthrough (verified
      incremental, not buffered), plus `/api/search`, `/api/pages/[id]`, `/api/pages/[id]/image`.
      The bare-IP Oracle origin never reaches the browser.
- [x] Real archive copy throughout — empty states, no-match, error states. No lorem ipsum.

**Decision (2026-07-28): dropped `useChat` for a custom `useArchiveChat` hook.** The backend
speaks its own SSE protocol where `sources` arrives as a first-class event *before* any text.
Bending that into the AI SDK's wire format meant smuggling citations through data parts and
maintaining a protocol shim on every request. Reading the stream directly keeps sources
first-class, which is exactly what the chips need. `ai`/`@ai-sdk/*` stay in package.json —
harmless, and Phase 2 may want them.

## Phase 1 — remaining
- [x] **Verified against the real backend (2026-07-29).** Ran the built frontend with
      `BACKEND_API_URL=http://129.80.3.40/api/v1`: `/api/search` proxied through to Oracle and
      returned a valid empty result; `/api/chat` streamed real SSE frames (sources → delta → done)
      from the live FastAPI. Both pages rendered. So the proxy layer is proven against reality, not
      just the mock.
      Still unexercised: the *populated* path. Every citation feature — chips, ordinals,
      viewer highlight — has only ever seen mock chunks. Expect the first real run to surface
      quirks the mock can't (model inventing chunk ids, markers landing mid-word, OCR text that
      doesn't substring-match the stored chunk so the viewer highlight silently misses).
- [x] **Vercel project confirmed real (2026-08-11).** Live at
      `vercel.com/khandokar-shakibs-projects/frontend`, org `team_4g2iLkOnKTKR2R7quL1cwne4`,
      project `prj_MM8t8QobAWJnuDba9CmZ9tvW6w92`. GitHub-connected, auto-deploys `main` on push —
      last deploy before this was `081ef66` (the document-scoped chat commit), status Ready.
      This had gone unverified for weeks; local `.vercel/project.json` (filesystem timestamp
      2026-07-15) was the only proof until Shakib screenshotted the dashboard directly.
- [x] **Local `BACKEND_API_URL` set (2026-08-11).** `frontend/.env.local` had no `BACKEND_API_URL` at
      all — every Route Handler call was throwing (`BACKEND_API_URL is not set`), caught, and
      rendered as ordinary empty state, which is why local dev looked identically "empty" everywhere
      and was hard to distinguish from a real design problem. Added
      `BACKEND_API_URL="http://129.80.3.40/api/v1"` to `.env.local`; `/api/documents` now returns a
      real `200 {"total":0,"results":[]}` instead of a 500. Deliberately **not** `NEXT_PUBLIC_` — only
      the server should know the origin IP.
- [x] **DONE — `BACKEND_API_URL` IS SET IN VERCEL, since 2026-08-11. Do not re-raise this.**
      Re-verified live 2026-08-12 and again 2026-08-13: the deployed site returns both real documents
      through `/api/documents`. The "still open / unverified" text that sat here was stale from the
      day it was set and caused the same non-issue to be raised at Shakib in two separate sessions —
      the exact failure the docs-update-same-turn rule exists to prevent. Vercel is HTTPS and Oracle
      is plain HTTP, but that is a *server-to-server* call, so there is no browser mixed-content
      warning; it is simply unencrypted origin-side, the accepted Phase 1 trade-off from the
      no-domain/no-Cloudflare decision.
- [ ] Date/publication filters on the archive browser — the backend `/search` doesn't accept
      those params yet, so it's a two-repo change, not frontend-only.
- [ ] react-pdf viewer: currently the viewer shows extracted text + scan image. Nothing renders
      actual PDFs, and per the ingestion contract PDFs never reach the server — so this item
      may simply be wrong. Revisit after the OCR pilot shows what the images actually look like.
- [ ] Cloudflare Turnstile widget on chat input — blocked, no Cloudflare (see `infra/plans.md`).
- [ ] Empty/error states exist but haven't been seen on a real slow connection or a real 502.

## Phase 1 addition (confirmed 2026-08-08) — Document-scoped chat
- [x] **Built 2026-08-08.** tsc, eslint and `next build` all clean. Three new pieces:
      `scope-picker.tsx` (the document list), `scope-bar.tsx` (the always-visible scope control), and
      an `/api/documents` Route Handler proxying the new backend endpoint the same way `/api/search`
      does — bounds checked here, origin IP never leaves the server.
      **Picker follows the `SourceViewer` precedent rather than inventing a third pattern:** bottom
      sheet on mobile, right panel from `sm`. A persistent sidebar was considered and rejected — the
      shell is `h-dvh` + `overflow-hidden` so the composer survives the mobile keyboard, and a third
      column would either break that or become a desktop-only affordance, which the mobile-first rule
      forbids outright.
      **The scope bar sits above the composer and is always visible**, stating the scope in words
      ("Asking within *El Mercurio, 12 Mar 1853*" / "Asking the whole archive · pick a document").
      That's what makes the mode discoverable without a tooltip or a tour — and "which pages can this
      answer draw from" is the single most consequential fact about a research assistant's reply, so
      it shouldn't be hidden behind an icon whose meaning has to be guessed. It disables while a turn
      streams: the answer in flight was already retrieved under the old scope.
      **Scope is stamped on each turn, not read from current state at render.** A reader can change
      scope between questions, and a transcript that relabelled old answers to match the *current*
      scope would be lying about where those answers came from. Same reasoning drives the two
      no-match messages — "nothing in the archive" is false when only one document was searched.
      Composer gave up its own `rule-t`/background to the wrapper so the bar and input read as one
      region instead of showing a seam.
      Empty state gained an "Ask within a single issue" entry, phrased as a capability rather than a
      promise about content — nothing is ingested yet, and the picker says so plainly when opened
      ("No documents in the archive yet"). A document with `page_count: 0` is labelled "no text yet"
      rather than being silently offered as if it could answer something.
      Verified inline: the request-body branch logic across all id cases (absent / null / `[]` /
      valid / malformed / over-cap). **The unscoped body is byte-identical to what it was before this
      change** — `{"message": "..."}`, key omitted entirely — so corpus-wide chat is provably
      untouched.
      **Unverified against real documents.** The picker has never rendered a row, the scope bar has
      never named a real issue, and no scoped answer has ever been generated, because the DB is
      empty. Expect the first populated run to surface the usual things a mock can't: titles far
      longer than the truncation assumes, and issues whose `publication` is null so the row falls
      back to `title`.

## Phase 1 — visual redesign — DONE 2026-08-11
Rebuilt after the first live look was rejected outright. Design-only: the SSE hook, Route Handlers,
citation parsing, scope logic and search ranking were not touched, and the diff proves it — the
changes are CSS, markup, typography and layout, plus new shell components.

**Direction: Kotaemon's structure, this project's own look.** Shakib picked it from two mockups
(the other was InsightsLM's three-column sources/chat/studio). Kotaemon won because it's the
cheapest honest evolution of what already existed: `SourceViewer` was already "opens on citation
click", so docking it as a standing column and adding a session rail is a layout change, not a
rewrite. Their *structure* only — Gradio grey and Google Sans never entered the picture.

- [x] **The palette was never broken — it was never being shown.** `defaultTheme="system"` with no
      in-UI toggle meant every OS-dark visitor silently got the secondary `.dark` palette instead of
      the paper/ink identity the whole design is specified around. Now `forcedTheme="light"`, with a
      note to revisit if a real toggle ever ships. This single line explains most of "it looks like
      flat dark mode".
- [x] Grain now reads: `mix-blend-mode: multiply` in light so the noise *darkens* paper into texture
      rather than laying flat grey haze over it (dark mode stays `normal` — multiply on near-black
      crushes to nothing). Opacity nudged 0.055→0.08 light, 0.09→0.11 dark. The blend mode was the
      missing piece, not the number.
- [x] **Type audit done, per-context not one-font-everywhere.** Added Lora (`--font-serif`,
      `.font-text-serif`) for anything read at length — chat questions, answers, extracted page text.
      Playfair is now display-only: wordmark, page H1s, publication names, empty-state titles. Inter
      keeps all UI chrome. The actual bug was `transcript.tsx` rendering the user's typed question as
      an `<h2>`, which the global `h1,h2,h3 { font-heading }` rule then set in Playfair — a display
      face on live user text. It's a `<p>` now.
      Lora was picked over Source Serif 4 after seeing both: Source Serif read "vertically squashed"
      at chat sizes.
- [x] **Turn structure.** A "You asked" eyebrow + hairline rule + left ink border on the question;
      the answer sits on its own `--card-answer` surface with an accent left-rule and an "Answer from
      the archive" label. Question and answer now have distinct visual roles instead of being two
      stacked paragraphs. Structure borrowed from ChatGPT/Claude transcripts, dressed editorially.
- [x] **Rail + docked panel** (`document-rail.tsx`, `source-viewer-panel.tsx`), `lg`+ only, on both
      Ask and Archive so the two pages read as one shell. Rail holds this-session questions (in
      memory only — Phase 1 is stateless, no persistence, nothing survives reload) and a short
      Collections list into the scope picker. On Archive there's no chat state, so that block is
      omitted rather than shown fake-empty, and Collections rows link to Ask.
- [x] **One fetch path, not two.** Rather than duplicate the viewer for docked vs sheet, the fetch
      moved to `use-source-page.ts` and the body to `source-viewer-body.tsx`; the sheet (`<lg`) and
      the docked panel (`lg`+) are thin wrappers over both. They cannot drift.
- [x] **The layout bug that took three rounds to catch.** `ChatEmptyState` used `justify-center` on a
      flex child inside the scroll container. Once content exceeded the container, `justify-center`
      split the overflow to *both* ends — the top became unreachable by scrolling (eyebrow hidden
      under the header) and the bottom slid under the composer. Only reproduced at ~710px viewport
      height, which is why 900–1254px testing kept coming back clean; Shakib's window was a 1352×710
      CSS viewport behind a Retina screenshot. Fixed with `my-auto`, which centres only when there's
      spare room and collapses to zero when there isn't. An earlier `min-h-0` "fix" made it worse and
      was reverted.
      Lesson worth keeping: match the reporter's actual viewport before concluding "can't reproduce".

Verified at 375 / 710 / 900 / 1100 / 1254px, both pages, plus tsc + eslint + `next build` clean.
Mobile is untouched by design — no rail, no docked panel, same sheet-based picker and viewer as before.

**Still unseen against real data.** Every citation feature here has only ever rendered mock or empty
states: no chip has resolved to a real page, the docked panel has never shown a scan, the rail's
Collections list has only ever said "No documents in the archive yet". The empty-archive path is
genuinely proven; the populated one is not.

- [ ] Header wordmark centres on the full viewport while content centres within the chat column, so
      it sits slightly off-axis next to the rail. Cosmetic, noticed 2026-08-11, not yet fixed.
- [x] **Playfair headings had no font-weight, so they rendered as a generic system serif
      (2026-08-11).** The `h1,h2,h3 { @apply font-heading }` rule in `globals.css` never set
      `font-weight`, and several components style spans/paragraphs as headings via the
      `.font-heading` utility directly (wordmark in `site-header.tsx`, publication names, source
      titles) — none of those picked up any weight either. At the browser default, Playfair's
      contrast barely reads and it looks like Georgia/Times, which is what made the live site look
      nothing like the approved mockup even though the same font file was loading correctly (verified
      the woff2 itself was served fine — this was a CSS-weight bug, not a font-loading bug). Fixed by
      adding `font-weight: 600` to `h1, h2, h3, .font-heading` as one rule in `globals.css`'s base
      layer, so both real heading elements and the utility class are covered without touching every
      call site individually.

## Local dev port — fixed at 3417 (2026-08-11)
`package.json`'s `dev`/`start` scripts now pin `next dev -p 3417` / `next start -p 3417` — see the
hard rule in root `CLAUDE.md` and the Antigravity mirror. Shakib runs multiple unrelated projects on
this Mac; the default 3000/3001 collided with something else and made a correctly-updated build look
stale. Always check local UI at `http://localhost:3417`, never bare `localhost:3000`.

## AUDIT FIXES 2026-08-11 — do these in order, A1 first

> A1, A2, A3 and **A4** are all done — A4 (2026-08-13, with backend B5) closed the citation→highlight
> loop, which was the last item breaking the core research journey. **No frontend audit items remain.**
>
> **The next work is deliberately not in this repo.** Per the 2026-08-13 sequencing decision, the
> website stops here and attention moves to the OCR pipeline audit — the **D-series, now in
> `backend/plans.md`** (migrated there 2026-09-16 when root `plans.md` was retired; the C-series it
> followed is complete).
>
> **Root's old W2/W3/W4 are gone and were NOT lost — they were already resolved here under different
> names, which is why they were dropped rather than migrated.** Root W2 (citation-chip tap targets)
> was answered by **CHUNK 6d**: not a defect, the chip already had a 44×44 `::after` hit area and the
> "15×12px" figure measured the visible chip — a wrong-layer measurement. Root W3 (honest-miss note on
> the chat path) was closed by **A2**, re-verified 2026-08-15 against the 9-issue corpus. Root W4
> (unobserved empty/error/slow states) survives as the open item further down this file. **Beware the
> label collision:** this file has its *own* later W2/W3/W4 (2026-09-04 onward) that are unrelated work
> reusing the same names — if an old note cites "W2" without a date, check which file it meant.

> **`src/instrumentation.ts` lives here but is tracked as backend B2** (done 2026-08-12) — that is
> not a filing mistake. B2 is "connection reuse to Oracle", and the connection is opened by *this*
> repo's Route Handlers, so the fix had to land here. Full write-up and measurements are in
> `backend/plans.md` B2. What matters if you touch it: it pins undici's idle-socket timeout to
> **60s**, deliberately just under nginx's `keepalive_timeout 65` on Oracle. **Those two numbers are
> a pair** — raising this one without raising nginx's first causes intermittent `ECONNRESET`, because
> undici would hand out a socket the server had already closed. Node's `fetch` pools connections on
> its own; the timeout was the whole bug, so do not "simplify" this into a per-request agent.

Each item below is self-contained: the symptom, the measured evidence, the exact file, the reason
the obvious fix is wrong, and how to know it worked. Pick the first unchecked one and finish it.
Do not batch them — A1 alone is a visible win.

### A1 — Citation highlight silently misses on 78% of chunks — DONE 2026-08-11
- [x] **Fixed. 22% → 100%** on the same 112-chunk live sample the audit measured. New file
      `src/lib/passage-match.ts` holds the ladder; `source-viewer-body.tsx` calls it instead of the
      one-shot `indexOf`. tsc + eslint + `next build` all clean.

      **The plan predicted 61% and the two extra rungs closed the rest.** Rungs 1–3 landed as
      written in the spec below (22% → 61% → 85%). The remaining 39% was *not* only "table rewrites"
      as the audit guessed — measuring where each failure diverged showed a second, unrecorded
      cause: `_merge_tiny()` in `chunking.py` folds a short chunk into its predecessor with `\n\n`
      and **drops the heading that separated them**, so the page carries a `### SOLE AGENTS FOR THE
      FAMOUS WHISKY` that the chunk never had. Two rungs handle it:
      - **rung 4, heading-skipping** — allow `#` inside the inter-word gap. Recovers 8 (→92%).
      - **rung 5, leading anchor** — the last 9 drop whole heading *words*, not just markers, so no
        gap pattern can bridge them. Anchors on the first 80 non-whitespace chars and highlights to
        the end of that paragraph. Measured spans are 18–70% of the chunk, so it never runs away.

      **Verified beyond the match count**, because a matcher that highlights the *wrong* paragraph
      would also score 100%: all 112 highlights were checked to begin on the correct text (0 wrong
      starts), all 112 produce a real non-trivial `<mark>` when pushed through the actual
      `parsePageBlocks` + `Highlighted` offset mapping (0 empty marks), 0 invalid offsets, 0.45ms
      per chunk.

      **VERIFIED IN A REAL BROWSER 2026-08-13 — and it found something the data-path check could
      not.** The chip was clicked at 375px against the live Oracle backend: it opened the correct
      page (Valparaiso English Mercury, Page 4 of 4, the MARITIME INTELLIGENCE / DEPARTURES columns
      the answer cited). No raw `[CITE:` or UUID leaked into the prose, and there is no horizontal
      scroll. **But zero `<mark>` elements rendered, and no MatchNote either** — see A4 below. The
      ladder itself is not at fault; it is never given a passage on the chat path.

      **Why the two-session blocker was never actually a locked profile.** Both previous sessions
      reported "Browser is already in use" and moved on. The real cause was an **orphaned Chrome
      (PID 62005) left running since Tue Aug 11 13:38**, parented to a `playwright-mcp` node process
      from the A1/A2 session that was never torn down. It held the profile for two days. `ps aux |
      grep -i chrome` misses it — the process name is `Google Chrome for Testing`. The reliable
      check is `lsof +D ~/Library/Caches/ms-playwright-mcp/<profile>`, which names the holding PID;
      killing the parent MCP process releases it. Not a stale lock file — do not delete
      `SingletonLock` and assume that fixes it.

      `infra/scripts/audit_metrics.py highlight` now reports all five rungs separately rather than
      one blurry percentage, so a future regression names the rung that lost ground. It mirrors the
      TypeScript rung-for-rung and both were confirmed to agree.

<details>
<summary>Original spec, kept for context</summary>

- **Symptom Shakib reported:** "the reference links are not always clear, I'm pretty sure there
      are issues with references when clicked on." Clicking a citation opens the right page, but
      nothing is highlighted and the page does not scroll to the passage, so it looks like the
      citation pointed nowhere.

  **Measured, not assumed (2026-08-11, 112 real chunks sampled across the live corpus):**
  - exact whole-chunk match — what the code requires today: **25/112 = 22%**
  - would match if the section prefix were stripped: **+43 = 61% total**
  - still unmatched after that (table rewrites): 44/112 = 39%

  **Root cause — the stored chunk is deliberately not a copy of the page text.** In
  `infra/scripts/batch_ocr/chunking.py`, `chunk_page()` builds each chunk as
  `f"{section}\n\n{body}"` — it prepends the section heading (e.g. `DEPARTURES.`) so the heading
  lands in `ts_vector` and the LLM can see where a citation came from. That is correct for
  retrieval and must not be reverted. But it means `pages.raw_text.indexOf(chunk)` fails whenever
  the heading did not immediately precede the body on the page. Separately, `_segment()` turns
  prose blocks into `" ".join(lines)` and keeps table rows verbatim, so whitespace diverges too.

  The viewer does an exact `indexOf` in
  [source-viewer-body.tsx:129](frontend/src/components/archive/source-viewer-body.tsx#L129):
  `const index = text.indexOf(needle);` — one shot, no fallback. `-1` means no highlight, silently.

  **Fix, in `frontend/src/components/archive/source-viewer-body.tsx`, in the `range` `useMemo`.**
  Make matching a ladder, stopping at the first hit:
  1. exact `indexOf(passage.trim())` — keep, it is the cheap common case
  2. **strip the section prefix**: if the passage contains `\n\n`, retry with everything after the
     first `\n\n`. This is the single highest-value step — it is the 22%→61% jump on its own.
  3. **whitespace-insensitive match**: build a regex from the passage where every run of whitespace
     becomes `\s+`, and `RegExp.escape` (or a manual escape) every other char. This recovers the
     prose blocks the chunker re-joined. Match against the raw text and use `match.index` /
     `match[0].length` so the returned offsets still index the raw string.
  4. **anchor fallback**: match only the first ~80 non-whitespace characters of the body and
     highlight from there to the end of that paragraph. Better to highlight approximately and
     scroll to the right place than to highlight nothing.
  5. give up → render with no highlight (current behaviour, now genuinely rare).

  **Do not** "fix" this by storing a second copy of the text, and do not change the chunker to stop
  prefixing the section — that would degrade `ts_rank_cd` for every query to fix a display bug.
  The offsets returned must stay offsets into the raw string, because
  `parsePageBlocks` in [page-blocks.ts](frontend/src/lib/page-blocks.ts) carries `start`/`end` per
  block and `Highlighted` maps them; that contract is what keeps rendering and highlighting from
  disagreeing.

  **Done when:** clicking a citation chip highlights and scrolls on a clear majority of sources.
  **Verify with:** `python3 infra/scripts/audit_metrics.py highlight` — it samples 112 real chunks
  and prints the exact-match rate against the 22% baseline. The number is the deliverable, not a
  vibe. Note the script measures the *data*, so it shows what is achievable; also cross-check at
  least 3 chips by hand in the browser at 375px and at `lg`, since only that proves the ladder in
  the component actually fires.

</details>

### A2 — Nothing tells the reader when a highlight could not be found — DONE 2026-08-11
- [x] **Done in the same pass as A1**, because the ladder already knows which rung matched — the
      honest note was one `MatchNote` component away, and splitting it into its own session would
      have meant re-deriving that context for nothing.

      **Deliberately more nuanced than the spec asked for.** The spec assumed two states (matched /
      not matched), but the ladder produces three meaningfully different ones, and collapsing them
      would itself be a small dishonesty:
      - `exact` / `prefix` / `whitespace` — verbatim match. **No note.** The highlight is the
        message; a "found it" banner on the common case is noise.
      - `heading` / `anchor` — approximate. *"Showing the full page — the highlight below marks
        approximately where the citation begins."* Tells the reader not to over-trust the span.
      - no match — *"Showing the full page — the exact cited passage could not be located on it."*

      So the note's presence always means "trust this a little less", which is the property that
      makes it worth reading at all. Muted, one line, no icon, no colour, hairline left rule —
      follows the existing `EmptyNote` voice. Only rendered when a `passage` was actually requested,
      so opening a page from a search result (no citation) correctly shows nothing.

      **Caveat RESOLVED 2026-08-15 — the harder corpus arrived and the branch is reachable.** The
      old caveat here said the *no-match* string had never rendered against real data because the
      2-document corpus matched 100%. Re-measured over **all 1231 chunks of the 9-issue / 71-page
      corpus: 99.9%, with exactly 1 unmatched chunk** — so the no-match branch now has a real row
      that reaches it. The approximate rungs are also better represented (heading 55 + anchor 32 =
      87 chunks) than the 17-of-112 the original sample showed.

### A3 — There is still no way to browse documents without searching first — DONE 2026-08-12
- [x] **Done.** `/archive` now lists the archive before anything is typed, via a new
      `document-catalogue.tsx`. Both issues render as rows (publication, issue date, page count) and
      each opens page 1 in the existing viewer. tsc + eslint + `next build` clean.

      **The plan's premise was wrong, and this is the part worth remembering.** A3 said "reuse
      `/api/documents`, do not add an endpoint" *and* "clicking one opens page 1 in the viewer".
      Those two cannot both hold: `/documents` returned only `document_id`, while the viewer is
      keyed on a page id — `GET /pages/{id}` takes a page UUID. Verified against the live API before
      writing anything: passing a `document_id` there returns **404**. So A3 was never
      frontend-only. Shakib chose adding `first_page_id` to the existing response over a new
      `/documents/{id}/pages` endpoint — cheapest correct fix, one aggregate on a join the query
      already did, no migration, no second round trip on click. See `backend/plans.md` for that half
      and the two wrong SQL spellings it ruled out.

      **`page_number` is passed as `null`, not `1`, and that is deliberate.** Both viewers render
      `source.page_number ?? page.page_number` — they *prefer* what the caller passes. Hardcoding 1
      would print "Page 1" confidently even for an issue whose lowest ingested page is 3, overriding
      the fetched page's own number. Null makes the viewer fall through to the value it actually
      loaded. This forced a small type split: a new `ViewerSource` (`ChatSource` with a nullable
      `page_number`) used by the two viewers and `use-source-page`, while `ChatSource` stays an
      exact mirror of the backend wire schema. Loosening `ChatSource` itself would have been the
      lazy fix and would have made the wire type lie.

      **Styling stayed inside the existing `ResultRow` pattern as instructed** — same rule, padding,
      hover, type scale — so the pre-search and post-search lists read as one thing rather than two
      row styles on one page. Rows compute to ~76px, well over the 44px tap minimum. No `sm:`/`lg:`
      classes in the new file at all: it inherits the container's responsive layout, so there is no
      breakpoint at which it can go desktop-only.
      A document with `page_count: 0` (`first_page_id: null`) renders as static text saying "No
      pages ingested yet — nothing to open", not as a control that looks tappable and then does
      nothing.
      Past the first 50 issues the catalogue says so in one line and points at the search field,
      rather than growing a "load more" button — paging a flat list is a worse journey than
      searching, and guessing otherwise before the corpus is large would be inventing a need.

      **Verified end-to-end against the live backend, not mocked:** through the local Route Handler,
      both rows carry real `first_page_id`s, and fetching them returns **page 1 of 16** (The Star of
      Chile) and **page 1 of 4** (Valparaiso English Mercury) with real masthead text (5188 / 8392
      chars) and `has_image: true`. Both scans serve as `image/webp` (I2 intact). `/archive`'s
      initial HTML carries the catalogue's loading state, confirming it is mounted on the idle path.

      **Deployed and verified in production on `frontend-gamma-dun-82`:** the catalogue is in the
      served HTML, `/api/documents` returns both `first_page_id`s, and the full path resolves to
      page 1 of 16 with a `image/webp` scan. **`frontend-theta-bay-62` was still serving the older
      build at the time of checking** — worth a glance at which host is canonical, since the plans
      have quoted both as "the deployed site" before. Separately, `npx vercel ls` in this repo
      resolves to a *different* project (`khandokar-shakibs-projects-7b70d891`, newest deploy 22h
      old) than the one recorded above (`team_4g2iLkOnKTKR2R7quL1cwne4`) — so the CLI's local link
      does not match the project the plans document. Not chased down here; noted so it is not
      mistaken for a deploy failure next time.

      **VERIFIED IN A REAL BROWSER 2026-08-13.** `/archive` at 375px against the live backend: both
      issues listed, rows measure **343×77 and 343×97** (comfortably over the 44px tap minimum),
      **no horizontal scroll** (`scrollWidth === clientWidth === 375`), and clicking the Mercury row
      opened it in the viewer with real 1844 tariff text at a readable measure. A3 is now seen, not
      just inferred. The nav links (`Ask` 43×40, `Archive` 67×40) are **40px tall, marginally under
      the 44px rule** — cosmetic, not filed as a bug, but noted so it is a decision rather than an
      oversight.

### A4 — Chat citations now highlight: the SSE `sources` frame carries chunk text — DONE 2026-08-13
- [x] **Done, with the backend half (B5).** Shakib chose full chunk `content` over a ~200-char
      excerpt. The chip now opens the page *and* marks the cited passage, so A1's ladder finally
      runs on the path most readers actually use.

      **This was not the "one prop" the plan predicted, and the extra work is the interesting part.**
      Passing `active?.content ?? null` in `chat-view.tsx` was indeed one line. But:
      - **`ViewerSource` had to explicitly `Omit<..., "content">`.** It derives from `ChatSource`,
        and `archive-browser.tsx` hand-builds one for the catalogue/browse path, where there is no
        chunk and no cited text. Inheriting a required `content` would have forced that call site to
        invent chunk text — a fake-data shape the no-placeholders rule forbids outright. The viewers
        take `passage` as a separate prop and never read `source.content`, so the omission is free
        and keeps the browse path honest. This mirrors exactly why `page_number` was made nullable
        here in A3: the wire type stays a true mirror, the viewer type describes the viewer's needs.
      - **The `ChatSource` doc comment said "`SearchResult` minus `content`", which the backend
        change made false.** Corrected in the same pass. A wire type whose comment lies is how the
        next session gets misled about the contract.

      **A real defect found while doing this, not in any plan.** `isChatSource` in `lib/api/sse.ts`
      is the runtime guard between untrusted SSE payloads and code that trusts the declared types.
      It checked four fields, so an object with **no `content`** would pass as a `ChatSource` and
      TypeScript would then believe a `string` was present where there was `undefined` — the
      highlight failing at the point of use, far from the cause. It now checks `content` too, so
      such a source is dropped at the boundary: "no chip" rather than "a chip that opens and marks
      nothing", which is the precise failure A4 exists to remove.

      Verified: `tsc --noEmit`, `eslint` and `next build` all clean.

      **Measured live against the deployed Oracle backend, on the chat path specifically.** Four
      questions → 19 unique chunks across 12 pages, all 19 carrying real `content`; A1's five-rung
      ladder run over them gives **100%, 0 unmatched** — exact 21% · +prefix 58% · +whitespace 74% ·
      +heading 79% · +anchor 100%. The rung split independently reproduces the search-path shape A1
      measured (22% / 61%), which is why this reads as the ladder behaving identically on both paths
      rather than a coincidental total.
      **So the old caveat is retired: the 100% is no longer search-path only.** Both paths are now
      measured separately and both are 100% — but keep quoting them *as two numbers*, since they
      came from two different samples.

      **That last unproven state is now proven — corrected 2026-08-15.** When this was written, 0 of
      19 chat chunks failed, so A2's *no-match* note was unreachable against real data. C3's nine
      PDFs did exactly what this note predicted they would: over the full 1231-chunk corpus the
      ladder matches **99.9% with 1 genuine miss**, so the branch fires on a real row. The
      accompanying full-corpus check also confirmed **0 empty marks** — every match renders a real
      `<mark>`, not a zero-length one.

<details>
<summary>Original A4 write-up, kept for the diagnosis</summary>

- **Found 2026-08-13 by the browser cross-check that A1/A2 twice could not run** — which is
      precisely the bug class those checks exist to catch, and it survived two passes of data-path
      verification because every piece works correctly in isolation.

      **Measured:** clicking a chat citation chip opens the right page, but renders **zero `<mark>`
      elements and no MatchNote**. Neither of A2's three states appears — not "approximately", not
      "could not be located", not the silent verbatim case.

      **Cause, confirmed against the live server, not inferred from code.** `chat-view.tsx` passes
      `passage={null}` to both `SourceViewer` (line ~114) and `SourceViewerPanel` (line ~119), and
      `source-viewer-body.tsx` gates the note on `{passage && <MatchNote …/>}` — so a null passage
      produces silence rather than an honest miss. The prop is hardcoded because there is genuinely
      nothing to pass: `curl`ing `POST /api/v1/chat` shows the `sources` frame carries exactly
      `chunk_id`, `page_id`, `document_id`, `page_number`, `publication`, `issue_date` — **no
      `content`**. The existing code comment at line 106 says this and is accurate.
      `archive-browser.tsx` passes a real passage because `/search` results *do* carry content,
      which is why highlighting works there and only there.

      **So A1's 22%→100% ladder never runs on the chat path** — the primary way anyone reaches a
      citation. The measured 100% was against search-result passages, and that number does not
      describe chat at all. Do not quote it as if it covers both.

      **The fix is backend-side and is one line**, but it is not mine to take: `_event_stream` in
      `backend/app/api/v1/chat.py` builds the sources dict from `SearchResult`, which **already
      carries `content`** — it is simply omitted. Adding it costs roughly 3KB per chat response
      (6 chunks of chunk text) on every request, and it changes the SSE contract that
      `frontend/src/lib/citations.ts` consumes. **Shakib's call** — this is a real payload/latency
      trade against B2's whole purpose, so it is written down rather than decided unilaterally.
      Cheaper alternative if the payload matters: send a short leading excerpt (~200 chars) instead
      of full content, which is all the match ladder's first rung actually needs.

</details>

## A5 — Figures and tables render in the viewer — DONE 2026-08-15

- [x] **The frontend half of the C4/B3 figure contract, plus the table rendering that was waiting on
      the same contract.** Both are the same job — showing structure the OCR genuinely found — so
      they shipped together. tsc, eslint and `next build` all clean; verified in a real browser at
      375px and 1280px against the live Oracle backend.

      **New:** `src/app/api/figures/[figureId]/image/route.ts` (proxy, so the Oracle IP still never
      reaches the browser), `src/components/archive/page-figures.tsx`, `PageFigure` in
      `lib/api/types.ts`, and table support in `lib/page-blocks.ts` +
      `components/archive/source-viewer-body.tsx`.

      ### Figures: overlay on the scan, gallery under the text — and why not inline

      **Shakib chose this over interleaving crops into the transcription, after the measurement
      below changed the recommendation.** The brief offered "at their recorded position over the
      scan, **or** inline in the text flow". Inline turned out not to be buildable honestly:

      **`raw_text` carried no image anchors at all when this was written — verified across all 71
      pages, zero contained a markdown image ref or an `<img>`.** `normalize.py`'s `_IMAGE_REF_RE`
      strips them at ingest. So there was no recorded point in the text where a figure belonged, and
      choosing a slot from the bbox's y-coordinate would have been inventing placement — on a
      multi-column sheet, vertical position and reading order are different things. **This is now
      stale: C6 (below) added a real anchor to 57 of 66 figures the same day, and D5 (2026-08-16,
      below) built the interleaving this section originally ruled out.** `page-figures.tsx`'s
      docstring was corrected in the D5 commit.

      **The ordering DOES exist upstream, and this is the actionable finding (asked by Shakib,
      2026-08-15).** `blocks.json` for Star of Chile p9 reads `SectionHeader` → `Picture` →
      `Caption` ("GROUP OF ARAUCANIAN INDIANS.") → `Picture` → `Caption` ("THE CHAMPION FOOTBALL
      TEAM…") — exact reading order, captions correctly paired with their own photograph. Chandra
      resolves it; ingest used to discard it when the block tree was flattened to a string.
      **DONE the same day as C6:** the fix was a re-ingest, not a re-OCR (no GPU hour, no API credit),
      and it shipped as an ingest-contract change before the ~5,000-page run, same reasoning as C4.
      Full record in `infra/plans.md`. **The frontend half — interleaving crops into the transcription
      at their true position — is DONE, D5, 2026-08-16 (see that section below).** The overlay/gallery
      behavior described below is unaffected on the Scan tab and for the 9 unanchored figures; D5 only
      changed how anchored figures render on the Text tab.

      **What the bbox is genuinely good for is position on the sheet, and that is verified.** The
      two p9 boxes render at 0.295/0.104 and 0.145/0.486 — identical at 375px and 1280px, since a
      percentage overlay is resolution-independent, which is exactly what page-relative fractions
      were stored for. Visually they land tight on the Araucanian group and the football team.

      **`block_type` is read before anything is sized**, per the contract's warning. `Picture` and
      `Figure` (56 of 66) get a solid box — their bbox matches the crop's aspect ratio to a median
      0.6%. The other 10 (`Text`, `ComplexRegion`, `Table`) bound the enclosing *region* and diverge
      by a median ~56%, so they get a dashed box labelled "region on the page" and the crop is never
      stretched to fill one. The explanatory line under the scan only appears when a dashed box is
      actually on screen.

      ### The two blank slivers, and a threshold picked from data rather than guessed

      Star of Chile p13 carries two `Table`-typed "figures" that are **65×30px crops of a blank
      horizontal rule**, while their bboxes claim an 863×563px railway timetable. Shakib chose to
      hide them. The timetable itself is captured correctly in the page text and now renders as a
      real 18-column table, so nothing is lost.

      **The first threshold was wrong and the browser caught it** — 0.0004 of page area = 1434px²,
      just *under* the slivers' 1950px², so both still rendered. Re-derived from the actual
      distribution of all 66 crops: the slivers are 1,885 and 1,950 px², and **the next smallest
      crop is 7,009 px²** (a genuine advertiser nameplate). A 3.6× gap separates artefact from
      content, so the cut sits at **4,000 px²** with room either side. Confirmed in the browser: the
      p13 gallery now collapses to nothing instead of showing two empty boxes.
      Measured on the loaded image's natural size, because the API carries no crop dimensions and
      the bbox is precisely the unreliable half for these two.

      ### Tables

      82 blocks → 1195 rows across the corpus, 0 prose fallbacks, **0 offset errors** — the offset
      contract that citation highlighting depends on is intact, which was the main regression risk
      of touching `page-blocks.ts`. Highlighting is **per row**, since the chunker splits a long
      table across chunks; marking whole blocks would claim a citation covered rows it never did.
      An 18-column timetable scrolls inside its own container at 375px with no page-level
      horizontal scroll.

      ### Re-measured while here: the stale highlight number

      The 100% rate quoted everywhere was from the old 20-page archive. Re-run over **all 1231
      chunks of the current 9-issue corpus: 99.9%, 1 unmatched, 0 empty marks** (exact 446 · prefix
      520 · whitespace 177 · heading 55 · anchor 32). That single miss is the first real row that
      reaches A2's *no-match* note, which had been unprovable until now.

      **Known and deliberately not fixed:** `/search` snippets still print raw `|` rows, because
      they render `chunks.content` directly. Different surface, not in the ask — but it is the first
      thing a reader sees, so it is worth a follow-up.

## D5 — Figure crops render inline in the transcription, at their real position — DONE 2026-08-16

- [x] **The payoff C6 (`infra/plans.md`) was built for.** C6 computed `text_anchor` — a character
      offset into `pages.raw_text` — for 57 of 66 live figures, but nothing consumed it until now: the
      viewer only drew the scan overlay and a gallery underneath. D5 renders the crop *inline* in the
      Text tab, between the real text on either side, at its true position in reading order.

      **Three decisions, confirmed by Shakib before writing any code:**
      1. Inline placement is Text-tab only. The scan-overlay (`FigureOverlay`) only ever draws over
         the `<img>` on the Scan tab — there was never an image to overlay on the Text tab, so nothing
         there needed replacing.
      2. The 9 unanchored figures (`text_anchor: null`) keep the pre-D5 gallery-only treatment. No
         figure disappears from the Text tab either way.
      3. Splice mechanism: a new synthetic `figure` block kind added to `PageBlock`
         (`src/lib/page-blocks.ts`), inserted by a new `splicePageFigures()` function — a second pass
         over `parsePageBlocks`' output, not a change to the parser. Every existing block keeps
         exactly the `[start, end)` it had before splicing runs, so citation highlighting's offset
         contract (`Highlighted`, `findPassage`) is untouched by construction.

      **A real bug found building it, not caught by tsc/eslint/`next build` (all stayed clean
      throughout) — only the Playwright browser check caught it.** `text_anchor` is defined
      backend-side as "the end of the block a figure follows," so on the Star of Chile p9 motivating
      example (anchors 22 and 52) the heading block ends at offset 22 while the next paragraph starts
      at 24 — the anchor sits in the blank-line *gap* between two blocks, not strictly inside either.
      The first implementation's containment check (`anchor >= block.start && anchor < block.end`)
      matched no block for either anchor and silently dropped both figures; `splicePageFigures`
      returned its input unchanged. Fixed by walking the block list once and inserting a figure
      immediately after the last block whose `end <= anchor`, rather than requiring strict interior
      containment. Only an anchor that genuinely falls inside a block's own text (rare) still splits
      that block. A table is never split mid-row — a mid-table anchor snaps to the nearest row
      boundary so a row's own `[start, end)`, which per-row highlighting matches against, is never
      divided.

      **Verified live against the Oracle backend, real browser, 375px.** Star of Chile p9's Text tab
      now renders "THE STAR OF CHILE." → **Figure 1** (the Araucanian group photo) → "GROUP OF
      ARAUCANIAN INDIANS." → **Figure 2** (the football team photo) → "THE CHAMPION FOOTBALL TEAM…" —
      exactly the `blocks.json` reading order the plan named as the target, captions correctly paired
      with their own photograph, no gallery duplication of either figure, citation `<mark>` still
      landing correctly across the interleaved blocks. The Scan tab's bbox overlay on the same page
      was screenshotted and is pixel-identical to pre-D5 behavior. A second, mixed page (The Chilian
      Times, 30 Dec 1891 p1 — one anchored figure, one not) confirmed the fallback: the anchored
      figure rendered inline mid-article, the unanchored one still appeared in the "Figure on this
      page" gallery at the bottom (singular heading, correctly reflecting the one figure left there).

      **`page-figures.tsx`'s stale docstring corrected in the same commit** — it no longer claims
      `raw_text` carries no image anchors, and now explains the overlay/inline/gallery three-way split.

      tsc, eslint and `next build` all clean, including after the placement-rule fix.

## W2 — the reader made to look like a newspaper (2026-09-04, DONE)

Shakib's report: literal hashtags on the page, "UI/UX massive confusion", "no animation smoothness
at all", no zoom in/out, images not centred, and captions not tagged under the image the way an
actual newspaper sets them. Studied the code first, then verified every single one in a real browser
before changing anything. All five were real, and one extra bug fell out of the audit.

**1. Literal `#` / `##` / `###` on the page — fixed.** `HEADING_RE` was `/^(#{1,6})\s+(.*)$/`, which
*requires* whitespace after the hashes. The OCR pipeline emits genuinely empty headings — a bare
`###` on its own line, used as a separator between boxed advertisements — so those failed the match,
fell through to the paragraph branch, and printed as literal hash characters. **14 of them on the
front page of The Star of Chile 1905-01-14**, i.e. the first thing a reader sees. Made the body
capture optional so a bare `###` now matches as an empty heading and hits the existing `if (!body)
continue` drop. Measured after: **14 → 0 literal hash paragraphs, with all 23 real headings still
rendering** — the fix drops separators, never content. Chose the parser layer over `normalize.py`
(Shakib's call): no re-ingest, works on all 9 issues immediately, and `pages.raw_text` stays a
faithful record of what the pipeline actually produced.

**2. No zoom, and a scan whose detail was being thrown away — fixed, and this was the worst of them.**
The stored sheets are 1630×2225 but were painted at whatever width the column happened to be:
measured live at **728px on a 1440px desktop and 343px at 375px — 2.24× and 4.75× of already-
downloaded detail discarded**, with *zero* zoom controls anywhere on the page. A reader could see
that print existed and could not read it, which for an archive whose entire point is reading the
primary source is the central failure, not a polish item. New `zoomable-image.tsx`: pinch, double-tap,
drag-to-pan, Ctrl/⌘-wheel, and three 44×44 discrete controls. **The ceiling is derived, never a round
number** — `naturalWidth / fittedWidth`, so zoom stops exactly at 1:1 with the file rather than
magnifying JPEG artefacts into something a reader might mistake for print. Verified: clicking "Zoom
to full detail" gives `scale(2.245)` → 1630px displayed from a 1630px file, ratio 1.00. Hand-rolled
rather than a dependency: it is one transform on one `<img>`, and `motion` is *already* in
package.json imported nowhere — adding a second unused animation dep would be the wrong direction.

**3. Images not centred — fixed.** Every figure was `block w-full max-w-sm`, pinned hard left.
Measured: **0px gap left against 249px right in a 633px column.** Now centred via the new `Plate`
component — measured after at 163/163 and 316/316.

**4. Captions not formally tagged — fixed.** The whole reader contained **zero `<figure>` and zero
`<figcaption>` elements**; every caption was a `<span>` reading "Figure 3". Now a real
`<figure>`/`<figcaption>` with the period newspaper cut line: hairline rule, centred, letter-spaced
small caps. **Deliberate limit, and it must stay:** the API carries no caption text (`PageFigure` has
only `figure_index`, `block_type`, `bbox`, `text_anchor`) and OCR captioning is disabled on purpose,
because model-invented caption text next to a scan would be fabrication in an archive whose value is
traceability. So the slot is *styled* like a cut line but filled only with what the archive actually
knows — plate number, page, and an honest "region of the sheet" note when the bbox is loose. The
typography is editorial; the words stay honest. Renamed Figure → **Plate** (period-correct, and it
distinguishes the archive's numbering from anything the paper printed). Issue-wide gallery numbers
run across the issue, because `figure_index` is page-relative and printed "Plate 1" twice.

**5. "No animation smoothness at all" — fixed, and the measurement was damning.** Of 155 elements on
the page, **17 had any transition and every single one was a colour/border-colour hover**. Not one
transform, opacity or layout transition existed in the entire reader. Both tab rows hard-coded
`border-b-2` per button, so the active rule was a property of whichever button was selected — two
different elements, which makes an animation between them structurally impossible. New `tab-rail.tsx`
owns **one** absolutely-positioned rule moved by transform. Verified travelling 512px over 160ms
instead of snapping. Page turns now play a 150ms `turn-page` entrance, keyed by page id so it
actually replays on mount. After: 23 transitions, 3 of them real transform transitions.

**6. Bonus, found during the audit: the lightbox was a broken modal.** It declared `role="dialog"`
`aria-modal="true"` with **no Escape handler, no focus move, and no focus restore** — confirmed by
dispatching a real keydown at the live page, which left it mounted. Also `w-full max-w-3xl`
*upscaled* a 306px crop to 736px, **2.41× past its own pixels**, and called the blur "full size".
All fixed; verified opens → focus lands on Close → Escape closes.

**Verification:** tsc clean, eslint clean, `next build` clean. At 375px: no horizontal scroll
(scrollWidth === clientWidth === 375), every control I added ≥44px. Two pre-existing sub-44px targets
remain in `site-header.tsx` (wordmark 15px tall; "Ask" 43px wide, one pixel under) — **untouched,
out of this pass's scope, and left here so they are not lost.**

Two lint findings during the work were real and fixed rather than suppressed: a ref read during
render in the zoom component (which would genuinely have failed to re-render, letting the transition
lag the fingers through a pinch) and a dead `items` array left behind in the view switch.

## W3 — the reader's UI/UX flow, which W2 measured and then failed to fix (2026-09-04, DONE)

**This is a miss being corrected, and the miss should be recorded honestly.** W2's own audit wrote
down "two stacked tab rows" and "~330px of chrome before a word of newspaper", then fixed the other
five complaints and never came back to it. Shakib had listed "UI/UX massive confusion" explicitly.
He raised it again — "did you do the UI/UX flow correction so that it follows an intuitive tabs and
links? It feels classy but kinda cluttered sometimes" — and he was right both times.

**The clutter, measured before touching anything (375x812):** the newspaper did not begin until
**325px down**, leaving a 413px reading window — **49% of a phone screen was chrome**, in five
stacked bands: site header 57px, issue header 115px, tab row 1 44px, search 46px, tab row 2 45px.

**The real bug underneath it was information architecture, not spacing.** There were two independent
states — a `view` of `read|scans|figures` and a `tab` of `text|image` — rendered as two tab rows
stacked ~100px apart. That put **five controls on screen for three destinations**, and produced a
genuine collision: row 1 offered **"Scans"** and row 2 offered **"Scan"**, one word apart. Verified
live that they serve **the identical image URL** — `/pages/c9420422…/image` came back from both the
grid's third tile and the Scan tab. No reader can distinguish those by name; that is the confusion,
and no amount of restyling would have fixed it.

**What changed.** The two axes are now one: `text | scan | plates`, one row, three genuinely parallel
ways of looking at the sheet you are on. The all-sheets grid was never a *view* — choosing which
sheet to read is **navigation** — so it moved to an "All 15 sheets" link in the header, opening as an
overlay (Escape closes, focus moves to Close and returns to the opener). `SourceViewerBody` gained
`showTabs`, false only in the reader; the citation sheet and the docked desktop panel keep their own
Text/Scan switch, **verified unregressed** by opening a corpus search result at 1440px and confirming
the panel still renders both tabs.

The search box was a permanent 46px band for an occasional act, on a screen where reading — the
constant act — was being squeezed. It is now an icon that expands on tap and **stays pinned open
while a term is active**, so collapsing is never destructive. Results render only when there are
some. The issue header was compacted from 115px: the back arrow is inline with the title instead of
owning a 44px line, and the metadata is one row. Nothing was dropped.

**Measured after:** chrome **49% → 34%**, newspaper begins **325px → 223px**, reading window
**413px → 516px (+25%)**, tab rows **2 → 1**, "Scans"/"Scan" collision **gone**.

**Vocabulary unified.** The tab said "Plates" while the page-jump list said "5 figures" and the scan
note said "figures". One word for one thing, everywhere: plates.

**Two tap-target regressions caught and fixed in the same pass, one of them self-inflicted:** the
compacted back arrow came out 36px wide (mine, fixed to 44x44), and the pre-existing "Ask" header
link was 43px — one pixel under, which is still under. The wordmark, previously a 15px line of type,
is now a real 44px row. **At 375px there are now zero sub-44px controls in the reader**, against
three before. No horizontal scroll. tsc, eslint and `next build` all clean.

*(A `2x2px` reading on four plates during verification was pre-decode lazy-loaded images, not a
defect — re-measured after scrolling each into view: 244–343px wide, all `complete`. Recorded because
the first measurement looked like a bug and was not.)*

## ⚠️ DEPLOYMENT — Vercel is NOT auto-deploying. Manual deploy required (found 2026-09-17)

**A git push to `main` does not put frontend changes live.** Verified 2026-09-17 while checking W4
on production: the newest **Production** deployment was **12 days old**, so six commits — W4
(`1be9e59`), the W4 plan (`dea7ebc`, `299ec3e`), `5099f61`, the reader tab-row collapse (`3f77c12`)
and the newspaper-reading pass (`535f181`) — had never been public. They were on GitHub the whole
time, which is exactly why nobody noticed.

The backend *does* have real CI/CD (push → GHCR → auto-redeploy), which makes this easy to assume
about the frontend too. It is not true here: Vercel's git integration is not firing, and this repo's
own workflow only lints and builds.

**Until the hook is reconnected in the Vercel dashboard, deploy by hand after any frontend change:**

```
npx vercel --prod --yes
```

**Two traps when verifying afterwards:**
- **`curl` gets HTTP 403 "Vercel Security Checkpoint" on `frontend-theta-bay-62.vercel.app`; a real
  browser passes it transparently.** That is bot mitigation (`x-vercel-mitigated: challenge`), not
  deployment protection, and it is not caused by deploying. **Do not read a curl 403 there as the
  site being down** — check in a browser first.
- Direct `frontend-<hash>-….vercel.app` URLs return **302** to auth. Normal, and true of the old
  deployment too. The alias is the public URL.

Fixing the git→Vercel hook properly is a dashboard task for Shakib, not something doable from here.

---

## W4 — "where am I and what does this do" (PLANNED 2026-09-16; W4a + W4d/W4e empty-state slice DONE 2026-09-17; W4b, W4e-Browse still open)

> **MERGED 2026-09-16 at Shakib's instruction: the old W5 (surface plain keyword search) is now
> W4e.** They were filed separately and were each too small to stand alone, but they are the same
> problem seen from two sides — *a reader cannot tell what mode they are in or what the site can
> do.* They also collide in code: old-W5's highest-value slice and W4d's deferred explainer both
> edit `chat-empty-state.tsx`, so building them apart would mean touching that file twice and
> risking two competing bits of copy in the same empty state. Do W4e's link and W4d's explainer as
> **one** edit to that file, or the page ends up nagging the reader twice.

Shakib's report, verified against the live prod screenshots and the code before writing any of this
down (MEASURE THE THING ITSELF): scoping a chat to one document has "no clear indication besides the
top bar" above the composer, the left rail gives no highlight or indication of anything, "Plates" is
confusing unexplained vocabulary to a first-time reader, and the Plates tab is very likely counting
ghost/blank crops (screenshotted live: Plate 13 on *The Star of Chile* 3 Dec 1904 p8 is a blank,
foxed scrap of paper, no image at all). Reference point Shakib asked for: NotebookLM's source-list
pattern (a persistent left list where each source has a real selected/active state) — studied from
existing knowledge only, **not** a clone or a redesign. This is explicitly an improve-the-current-
layout pass, not an overhaul: the three-pane shell, the ScopeBar-above-composer pattern, and the
reader's `text|scan|plates` tab row all stay as they are.

### W4a — the rail literally cannot show scope (root cause, confirmed in code) — ✅ DONE 2026-09-17

**This is not a styling gap, it's a wiring gap.** `chat-view.tsx` holds `scope: DocumentSummary[]` as
its own state and passes it to `ScopeBar` and `ScopePicker` — but `DocumentRail` is called as
`<DocumentRail turns={turns} onNewChat={startNewChat} onOpenPicker={...} />`, with no `scope` prop at
all. `document-rail.tsx`'s `RecentDocuments` does its own independent `fetch('/api/documents?limit=6')`
and has no concept of "currently scoped" to compare against — there is no state in that component
capable of rendering a highlight even if we wanted one. So "the left side doesn't have indication or
highlight or anything" is architecturally true today, not a CSS oversight: the data the rail would
need to highlight a row was never threaded through.

Fix: thread `scope` (and `onOpenPicker`'s selection) down into `DocumentRail` → `RecentDocuments` as
a prop, mark any row whose `document_id` is in the current scope with the same accent-bordered /
checked treatment `ScopePicker`'s own `DocumentRow` already uses (reuse the pattern, do not invent a
second one), and add a persistent "Asking within ▸ {name}" chip at the top of the rail itself when
scoped — so the scope is legible in two places at once (rail + the existing ScopeBar), matching
NotebookLM's own redundancy (its source list *is* the primary indication of what's in context, not a
secondary echo of a bar above the input). On Archive/Browse, `DocumentRail` is called with zero props
today — Browse has no scope concept at all currently (browsing is corpus-wide by design), so nothing
changes there except that the rail's recent-documents rows gain the same visual language for
consistency, with no active state to show since Browse never scopes.

**✅ BUILT 2026-09-17, exactly as diagnosed above.** `scope?: DocumentSummary[]` is threaded
`ChatView` → `DocumentRail` → `RecentDocuments` (as a `Set` of ids), so all three surfaces read the
same array and cannot disagree. A scoped row gets the accent left-border + 6% accent tint + a check
glyph — `ScopePicker`'s existing vocabulary, reused rather than reinvented — plus `aria-current`,
with the glyph `aria-hidden` so it is not announced twice. The "Asking within" chip sits at the top
of the rail and renders **only when scoped**; an always-present "whole archive" chip would be chrome
restating the default, which `ScopeBar` already says in its idle state.

**Verified live at 1440px, not asserted:** selecting *The Star of Chile, 14 Jan 1905* in the picker
produced the chip, **exactly one** row with `aria-current="true"` (the matching one), a 2px accent
border and 6% tint on that row only, and transparent/borderless inactive rows. Browse re-checked in
the same pass: rail present, **0** active rows, no chip, no horizontal scroll — correct, and nothing
faked. `tsc` clean, eslint clean, production build passes, 0 console errors.

### W4b — "Plates" needs a first-encounter explainer, not a rename

W2/W3 already deliberately chose "Plate" as the period-correct term for an engraving and unified it
everywhere (tab label, page-jump marks, scan grid marks, figure captions) — confirmed still true
reading `plate.tsx`, `document-figures.tsx`, `document-scans.tsx` live. Renaming it would undo real,
considered work and reintroduce the inconsistency W3 fixed. The actual problem is that the word is
introduced with zero context: a first-time reader hits a tab labelled "Plates 20" with no definition
anywhere on the page. NotebookLM's own pattern for this is a one-line descriptor directly under any
non-obvious section label, not a tooltip that has to be discovered by hovering (hover has no mobile
equivalent anyway, and this is a mobile-first product).

Fix: add one small `text-muted-foreground` line directly under the `text|scan|plates` tab row, shown
only when the Plates tab is active for the first time this session (a `sessionStorage`-backed
"seen" flag, per-viewer, same category of convenience the design skill already treats as fair game for
browser storage) — something like "Plates are the engravings, photographs and illustrations printed
in this issue — the archive's own numbering, not the paper's." Same treatment applies to the
`DocumentFigures` gallery's own intro line, which already exists (`"N plates were found across this
issue"`) but could gain the same one-time definition on first visit rather than assuming the word is
already understood.

### W4c — ghost/blank plates (real gap, confirmed, explicitly NOT fixed this pass)

Confirmed by reading `use-document-figures.ts` and `plate.tsx`: there is **no quality or content
filtering anywhere in the figure pipeline** — every block the OCR engine tagged as an image-bearing
type becomes a "Plate" in the gallery and the scan-tile counts, full stop. Screenshotted live: Plate
13 on Star of Chile 3 Dec 1904 p8 is a faded, foxed blank scrap — no photograph, no engraving,
nothing printed on it, and it gets a plate number and a spot in the gallery exactly like Plate 14 (a
real harbor photograph) sitting right next to it. Shakib's call, stated directly: fine to leave as-is
for now, but track it rather than silently accept it, because "20 plates found" is currently an
inflated, partly-wrong count that will only get worse across the full 5,000-page corpus.

This is a **backend/pipeline problem, not a frontend one** — the frontend has no way to distinguish a
blank scrap from a photograph without either (a) a quality signal from the OCR/detection stage (e.g.
an ink-coverage or contrast heuristic on the crop) or (b) a human/RA review step (Phase 3 territory,
RAs uploading and curating). Noting it here because it was found during a frontend UX audit, but the
actual fix belongs in `backend/plans.md` or the OCR pipeline scripts — **cross-reference added there
in the same session this plan entry was written**, per the Claude⇄Antigravity / cross-repo sync rule.
Do not silently drop plates client-side as a workaround (that would be exactly the kind of unverified,
looks-real-but-isn't cleanup the no-placeholders rule forbids — a dropped plate with no server-side
signal behind it is a guess dressed up as a filter).

### W4d — smaller clarity items surfaced by the same audit, bundled here rather than filed separately

- **Scans-tab "no scan" tiles and blank pages already say so honestly** (`document-scans.tsx`,
  `pageJumpLabel`) — confirmed still correct, no action needed, listed only so it isn't re-flagged.
- **`ScopeBar`'s idle-state copy** (`"Asking the whole archive · pick a document"`) is good and stays;
  the gap was never the bar's own wording, it was the rail having nothing to echo it with. W4a is the
  actual fix; this line is here so nobody re-diagnoses the bar itself next time.
- ~~**Consider, not yet decided:** a short first-visit-only explainer band on `ChatEmptyState`~~
  — **✅ RESOLVED 2026-09-17, and reading the file first changed the answer.** The instruction was
  to read `chat-empty-state.tsx` properly before building, because nobody had. Doing that settled it:
  **the empty state already introduces the scoped mode.** The "Ask within a single issue" button
  carries its own descriptor line — *"Pin the assistant to one document so it answers only from
  those pages."* — which is precisely what the proposed two-mode explainer would have said.

  **So the explainer band was NOT built, deliberately.** Adding it would have stated the same thing
  twice on the first screen a reader ever sees, which is the exact "wall of competing hints" the
  merge note above warned about — arrived at from the opposite direction than expected. Only the
  genuinely missing half was added: W4e's keyword-search escape hatch. Recorded rather than quietly
  dropped, because "we decided not to build the thing the plan listed" is the kind of divergence that
  otherwise looks like an oversight later.

**Order of work when this is picked up:** ~~W4a first~~ ✅, then ~~W4e's empty-state link with W4d's
explainer as a single edit~~ ✅ — **both done 2026-09-17** (W4a in `document-rail.tsx` +
`chat-view.tsx`; the empty-state edit in `chat-empty-state.tsx`, where the explainer was dropped
after reading the file, see W4d). Each was verified live at 375px before moving on, per the
mobile-responsive hard rule, which is what caught the 30px tap target.

**Still open in W4, in order:**
1. **W4b** — the first-encounter "Plates" explainer (one new small component + a `sessionStorage`
   seen-flag, no data changes).
2. **W4e's remaining Browse-page work** — give the Browse search field real weight as that page's
   primary control (type scale and spacing rhythm, *not* a coloured box or a hero banner), and check
   that the query + result count survive a back-navigation from a document, since search → read →
   return is the actual research loop.
3. **W4c** — cross-reference in `backend/plans.md`. Confirmed already present there (the
   blank/ghost-plate entry cross-referenced from here, 2026-09-16), so this is a verify-not-write
   item. W4c itself stays deliberately unfixed: it is a pipeline problem, not a frontend one.

No new dependencies needed for any of this.

### W4e — surface plain keyword search properly (raised by Shakib 2026-09-16; was W5) — first slice ✅ DONE 2026-09-17

**The feature is not missing — the affordance is.** Verified by reading the code this session, not
assumed: corpus-wide keyword search already exists in `archive-browser.tsx`, within-issue search
exists in `document-search.tsx`, both go straight to `GET /api/v1/search` through
`src/app/api/search/route.ts`, and **neither touches the LLM at all** (grepped: no chat/stream/gemini
import anywhere in that path). Timed against the live endpoint the same session: **0.68s and 1.02s**
for `cholera` and `shipping`. So it is already lightweight, already fast, already non-AI.

The problem is purely one of presence. `site-header.tsx` offers exactly two destinations — "Ask" and
"Browse" — and `/` is Ask. A reader landing on this site is put in front of a chat composer and has to
*know* that the second tab contains a plain search box. Shakib's own read of the site was that a
simple no-AI search did not exist, which is the clearest possible evidence that the current
presentation hides it. For a corpus of 1800s newspapers, plenty of research sessions start with
"does the word *nitrate* appear anywhere" and never want a generated sentence at all — that reader
should not have to find a tab first.

**Explicitly NOT the fix:** adding a second search box to the Ask page, or a global search overlay
bolted over the chat view. Both recreate the exact "two surfaces that look like two search boxes"
confusion CHUNK 3 removed when it renamed Archive→Browse and inverted the browse page. Do not undo
that inversion. The header staying two-verb ("Ask" / "Browse") is correct and stays.

**The move instead: make Browse's search box *look* like the tool it is, and make the Ask page admit
it exists.** Concretely, in rough order of value:

- ✅ **DONE 2026-09-17 — the one-line link out of the Ask empty state.** Shipped as
  *"Looking for a word rather than an answer? **Search the archive** for it directly."* —
  `text-muted-foreground`, no card, no icon, a plain `next/link` to `/archive`, sitting under the
  same rule as the scope affordance so the two ways out of "ask a question" read as one short list.
  Done as a **single edit** with W4d's explainer decision, as instructed; see W4d above for why the
  explainer itself was not built.

  **Explicitly not a second search box on the Ask page** — that constraint was honoured; CHUNK 3's
  inversion is untouched and the header stays two-verb.

  **One thing measured rather than assumed, and it needed a fix:** at 375px the inline link's own box
  was **30px**, under the 44px tap minimum (the first attempt using `inline-block` + negative margin
  made it *worse*, not better — 34px → 30px, because `inline-block` collapsed the line-height
  contribution). Fixed with `inline-flex min-h-[44px] items-center` plus a matching negative block
  margin so the sentence's line rhythm is preserved. **Re-measured after the fix: 44px exactly, no
  horizontal page scroll at 375px, link right edge well inside the viewport.** The paragraph box grew
  39px → 50px, which is the honest cost of a compliant target.
- **Give the Browse search field real weight as the page's primary control.** It currently sits above
  the catalogue as one element among several; it should read as *the* thing that page is for, without
  becoming a hero banner. Type scale and spacing rhythm do this, not a coloured box and not a
  gradient — the archive is editorial, and a search field that shouts is exactly the AI-slop tell the
  design rules forbid. Purple stays an accent on the focus ring only.
- **Persist and show the query state honestly** — the result count and the term already render; check
  they survive a back-navigation from a document, because the research loop is *search → read →
  return to the same result list*, and losing the list on return is the quiet failure that makes
  people stop using a search box.

**Non-negotiables this must satisfy, same as every other frontend slice here:**
- **375px first.** The search field, its clear/submit control and every result row are verified at
  375px before this is considered done, with no horizontal page scroll and ≥44px tap targets on the
  field, the clear button and each result row. `document-search.tsx` already gets this right — match
  it rather than inventing a second pattern.
- **Motion stays sharp and short** — 120–180ms, transform/opacity only, `prefers-reduced-motion`
  honored. Results appearing should feel immediate; no staggered entrance choreography on a result
  list, no skeleton shimmer pretending to be slower than the 0.7s the endpoint actually takes. A
  spinner that outlives the request is a lie about performance.
- **Classy, restrained, non-generic.** Paper/bone neutrals, ink near-blacks, Playfair for any heading,
  Inter for the field and rows. No emoji iconography, no decorative filler, nothing that reads as a
  SaaS template.

**What this does NOT include, deliberately:** no typo tolerance, no search-as-you-type, no new
search engine. Meilisearch and Elasticsearch were both re-examined this session against the real
numbers — the entire text index is **2.8 MB** and the chunks table **6.6 MB**, on a box with 11 GB
shared by Postgres + FastAPI + Nginx. Elasticsearch alone wants ~8 GB with a 4 GB JVM heap, which is
absurd at this scale. Meilisearch is genuinely light and its typo tolerance is a real answer to the
OCR-noise gap `backend/plans.md` CHUNK 15 §6 already flags — but it would replace only the *lexical*
arm, which is the half that already works, while adding a second datastore and a dual-write sync
problem (the precise reason Qdrant was dropped 2026-09-16). If fuzzy matching becomes the priority,
`pg_trgm` is **already installed** in this Postgres and is the thing to reach for first. Recorded
here so this is not re-litigated from scratch next time it comes up.

## W6 — chat answers rendered raw markdown as literal text (2026-09-17, DONE)

Shakib caught this live in prod (screenshot: `### 1. Diplomatic Relations`, `**bold**` literally
on screen instead of a heading and bold text) and called it urgent. Root cause, confirmed by
reading the code before touching anything (MEASURE THE THING ITSELF): `answer-text.tsx` never
parsed markdown at all. It split the answer into citation markers vs. plain text runs and dumped
the plain runs into a `whitespace-pre-wrap` div — so every `#`, `*`, `-` the LLM wrote landed on
screen verbatim. There was no markdown library in `package.json` to begin with; this wasn't a
regression in a working renderer, it never existed.

**Fix — installed a real markdown renderer instead of extending the hand-rolled splitter:**
`react-markdown` (v10, React 19-compatible) + `remark-gfm` for GFM tables/strikethrough/etc. The
tricky part was citations: `[CITE:chunk_id]` markers can land mid-sentence or inside a list item,
so they can't be a separate pass that runs before/after markdown parsing without breaking on those
cases. Solved with a small custom remark plugin, `src/lib/remark-cite.ts`, using `unist-util-visit`
to walk the mdast tree and split any text node containing `[CITE:...]` into a `cite` node — that
node is a first-class part of the markdown tree, so it composes correctly with bold/lists/headings
around it. `answer-text.tsx` registers a `cite` component override on `<ReactMarkdown>` that
resolves the chunk id against `sources` and renders the existing `CitationChip`, unchanged.

`src/lib/citations.ts` lost `parseAnswer`/`AnswerSegment` (the old splitter, now dead — nothing
else referenced them) and kept `trimPartialMarker` (still needed: hides an unclosed `[CITE:8f2`
tail while a token is mid-arrival) plus a new `assignCitationOrdinals` helper, since the ordinal
numbering ("citation 1, 2, 3...", shared across repeats of the same chunk) still needs computing
once per answer regardless of how the text gets split.

**Editorial styling, not default browser prose:** added `.prose-answer` to `globals.css` —
headings in Inter/`--font-sans` (contrast against the Lora/`--font-serif` body, matching the
existing `.font-heading`-vs-`.font-text-serif` split elsewhere in the app), tight spacing rhythm
(0.85em paragraph margins, not Tailwind Typography's default looseness), accent-subtle blockquote
rule and inline-code background using the existing `--accent-subtle` token, no decorative filler.
GFM tables get borders from `--border`. This is deliberately not `@tailwindcss/typography` — that
plugin's defaults are the generic-SaaS look this project's design rule explicitly bans, and hand
writing ~15 rules against tokens already in the palette was less work than fighting a prose plugin's
overrides.

**Verified live, not just type-checked** (`npx tsc --noEmit` and `npm run build` both clean, but
per the testing rule that's not enough for a UI fix): ran the actual dev server on 3417 against the
real Oracle backend, asked "What did the papers report about the nitrate trade?" through the real
UI. Confirmed via Playwright accessibility snapshot — not just a screenshot — that the response
contains a real `heading [level=3]`, real `strong`/`emphasis` nodes, and a resolved citation chip
button, none of it literal `#`/`*` text. Also caught a real (separate, pre-existing) bug live during
this test: an upstream stream cutoff left a dangling unclosed `[CITE:a5e33292-ac9a-478e-8b2d-2658b`
at the very end of one answer once `status` had already flipped to `complete` — `trimPartialMarker`
was previously only applied while `isStreaming`, so a hung-up stream let the raw fragment leak into
the rendered output. Fixed in the same pass: `answer-text.tsx` now trims the dangling marker
unconditionally, streaming or not.

**What this does NOT fix, and isn't meant to:** citation coverage itself (whether the model bothers
to emit `[CITE:]` markers at all) is a separate, already-tracked, already-measured issue — see
`CLAUDE.md`'s "LLM choice is COST-FIRST" section, the 2026-08-31 Valparaiso measurement. One of the
two live test answers in this session had zero citation markers in the raw text at all; that's
model behavior, not a rendering defect, and is explicitly out of scope here. The upstream
stream-cutoff itself (why the SSE connection hung up mid-token) is also not investigated — only the
rendering-side symptom (a leaked raw fragment) was fixed.

### W6 correction (2026-09-18) — the "DONE" verification above missed a real defect: stray `<div>`s inline

Shakib caught this the next day from a live production screenshot: sentences ending with an
isolated `.` alone on its own line, e.g. "...at 49,500 tons\n." — a forced line break appearing
mid-sentence, right around where a citation number would sit. The original W6 verification checked
that headings/bold/citations *appeared correctly* via an accessibility snapshot, but never inspected
the actual rendered HTML — so it missed that every citation chip was sitting next to an invalid,
invisible block element.

**Root cause, confirmed by reading the actual DOM (`innerHTML`), not the accessibility tree:**
`mdast-util-to-hast` (the step `react-markdown` uses internally to convert the markdown tree to an
HTML tree, before `remark-cite`'s `cite` node ever reaches a React component) has a
`defaultUnknownHandler` for any mdast node type it doesn't recognize. That handler's fallback for a
node with no `value` field — which is exactly what `{ type: "cite", chunkId }` is — wraps it in a
block-level `<div>`. So every single citation marker was silently becoming an empty `<div></div>`
sitting *inline*, mid-paragraph, mid-list-item. A block element inside inline text forces the
browser to break the line around it — that's the literal cause of the "period on its own line"
symptom. It also meant the `components.cite` override in `answer-text.tsx` was **dead code the
whole time**: react-markdown's component matching keys off the final hast *tag name*, and the tag
name here was `"div"`, never `"cite"` — so the override never fired, for any citation, ever. Every
citation chip visible in the W6 screenshots was rendering through a different mechanism (the chip
still worked because `<CitationChip>` itself renders fine once mounted — but it was being invoked via
whatever fallback path applies to bare `<div>`s in `components`, not the intended `cite` matching).

**Fix:** give `mdast-util-to-hast` an explicit handler for the `cite` node type instead of relying on
its unknown-node fallback. Added `citeHastHandlers` to `src/lib/remark-cite.ts` — converts the `cite`
mdast node into a real *inline* hast element, `<cite-chunk chunkId="...">`, with no children. Passed
into `<ReactMarkdown remarkRehypeOptions={{ handlers: citeHastHandlers }}>` in `answer-text.tsx`, and
the component override renamed from `cite` to `"cite-chunk"` to match the tag name that's now
actually produced. Verified the mdast→hast handoff directly with a throwaway Node script (parsed
"hello X world" through the same `unified()` pipeline, dumped the hast tree as JSON) before trusting
it in the browser — confirmed `cite-chunk` lands as a sibling inline node, not a wrapping block.

**TypeScript wrinkle:** `react-markdown`'s `Components` type and `mdast-util-to-hast`'s `Handlers`
type are both closed unions of markdown's built-in node/tag names, built from each package's own
bundled types — the `declare module "mdast" { interface StaticPhrasingContentMap { cite: ... } }`
augmentation (needed anyway, for the remark plugin itself) does not propagate through to widen
those two specific closed unions. Rather than fight cross-package generic resolution further, used
targeted `as unknown as Components` / `as ReactMarkdownOptions["remarkRehypeOptions"]` casts at the
two call sites — justified because the actual hast output was verified correct by the Node script
above, not asserted on faith.

**Verified properly this time — by inspecting rendered HTML, not just the accessibility tree:**
built a temporary test route (`src/app/debugmarkdowntest/page.tsx`, deleted after — never committed)
rendering `<AnswerText>` directly with hardcoded markdown covering the exact failure case (a citation
immediately before a sentence-ending period) **plus a real GFM table**, since tables specifically
had never been checked — the two live prod test answers in the original W6 pass happened not to
contain one. `document.querySelector('.prose-answer').innerHTML` confirmed: citation buttons sit
correctly inline with no wrapping element, the GFM table produces a real `<table><thead>...` (not
literal pipe characters), and a citation inside a list item (`<li>Item one [CITE:...]</li>`) resolves
correctly too. All three had been unverified assumptions in the original pass.

**Lesson for next time a custom remark node type is added:** a custom mdast node needs its own
`mdast-util-to-hast` handler up front, registered via `remarkRehypeOptions.handlers` — it cannot be
left to fall through to the default unknown-node handler and "matched" later by a same-named
component override, because the override matches on the *hast tag name after conversion*, not the
mdast type before it. And "the accessibility snapshot looks right" is not sufficient verification
for markdown rendering — invalid nesting (block-in-inline) is invisible to the a11y tree but visibly
wrong in the actual rendered page.

## Phase 2+
- [ ] Semantic search UI, "similar passages" panel in viewer
- [ ] Cross-document pattern discovery UI (confirmed 2026-08-08) — surfaces connections/patterns
      found across multiple documents once the backend's cross-document feature (see
      `backend/plans.md` Phase 2+) exists. Dedicated feature, not just multi-doc citations in one
      answer.
- [ ] NextAuth v5 activation (Phase 3, currently dormant shell only)
