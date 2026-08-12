# frontend/plans.md
> Living checklist scoped to the `frontend/` repo only (Next.js 16, shadcn, chat UI, viewer).
> Read at session start. Remove items when actually done. Add confirmed decisions/tasks immediately.
> Never create other planning `.md` files — this is the only one for this repo.
> NOTE: this repo is on Next.js 16 (not 15) — read `node_modules/next/dist/docs/` before writing Next code; APIs differ from training data (async params, proxy.ts, etc). See AGENTS.md.

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
- [ ] **Still open: same var in Vercel.** Production scope, `http://129.80.3.40/api/v1`, then
      redeploy — unverified whether it's already set there. Vercel is HTTPS and Oracle is plain HTTP,
      but that's a *server-to-server* call, so no browser mixed-content warning; it's just not
      encrypted origin-side, the accepted Phase 1 trade-off from the no-domain/no-Cloudflare decision.
      Every question will keep answering "nothing in the archive" until the OCR pilot below lands
      real rows — that's correct behaviour against an empty DB, not a bug.
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

> **Cross-repo order lives in the root `plans.md`** ("THE ORDER TO DO THESE IN"). Backend **B1**
> is ranked ahead of A1 globally. A1 is the first *frontend* item, not necessarily the next thing
> to do overall — check the root table first.

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

      **Not verified in a real browser.** The Playwright MCP profile was locked by another session
      all pass, so the "cross-check 3 chips by hand at 375px and lg" step never ran. The component
      path was exercised by rendering `parsePageBlocks` + the `Highlighted` offset logic against
      real corpus data instead, which covers the same failure mode, but it is not the same as
      seeing a chip clicked. **Worth one manual look next session.**

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

      **Caveat:** on the current 2-document corpus the ladder matches 100%, so the *no-match* string
      has never rendered against real data — only the approximate one (17 of 112 chunks) is
      reachable today. That branch is one ternary and fires whenever `findPassage` returns null, but
      it is honest to call it unproven on real rows until a harder corpus arrives.

### A3 — There is still no way to browse documents without searching first
- [ ] Raised twice before and still true: the **only** paths into the viewer are (a) clicking a
      search result in `archive-browser.tsx` or (b) clicking a citation chip. `document-rail.tsx`
      is `lg`+ only and its "Collections" rows open the *scope picker* or link to `/` — they never
      open a document. So a first-time visitor on a phone must guess a search term to see anything,
      and the archive appears empty even though it has 2 issues and 20 pages.

  **Fix:** on `/archive`, when the search query is empty, render the document list from the existing
  `/api/documents` Route Handler (already built for the scope picker — reuse it, do not add an
  endpoint) as browsable rows: publication, issue date, page count. Clicking one opens page 1 in the
  viewer. Mobile-first, ~44px rows.

  **Done when:** loading `/archive` on a 375px viewport with an empty query lists both issues and
  each opens the viewer. **Ask Shakib before styling beyond the existing `ResultRow` pattern** —
  this adds a visible surface, and the design bar is his call.

## Phase 2+
- [ ] Semantic search UI, "similar passages" panel in viewer
- [ ] Cross-document pattern discovery UI (confirmed 2026-08-08) — surfaces connections/patterns
      found across multiple documents once the backend's cross-document feature (see
      `backend/plans.md` Phase 2+) exists. Dedicated feature, not just multi-doc citations in one
      answer.
- [ ] NextAuth v5 activation (Phase 3, currently dormant shell only)
