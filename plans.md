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

> **Cross-repo order lives in the root `plans.md`** ("THE ORDER TO DO THESE IN"). A1, A2, A3 and
> **A4** are all done — A4 (2026-08-13, with backend B5) closed the citation→highlight loop, which
> was the last item breaking the core research journey. **No frontend audit items remain.**
>
> **The next work is deliberately not in this repo.** Per the 2026-08-13 sequencing decision, the
> website stops here and attention moves to the OCR pipeline audit (C-series, then D-series, in the
> root `plans.md`). W2/W3/W4 in the root's WEB CLOSEOUT stay written up and ready, but they are
> polish on a surface whose *content contract* is about to change — tables, figures and possibly
> page furniture are all about to start existing — so doing them now risks doing them twice.

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

      **Caveat:** on the current 2-document corpus the ladder matches 100%, so the *no-match* string
      has never rendered against real data — only the approximate one (17 of 112 chunks) is
      reachable today. That branch is one ternary and fires whenever `findPassage` returns null, but
      it is honest to call it unproven on real rows until a harder corpus arrives.

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
      **Live browser re-check and the re-quoted chat-path highlight rate are in W3 below** — the
      100% from A1 is search-path only and must not be quoted as covering chat.

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

## Phase 2+
- [ ] Semantic search UI, "similar passages" panel in viewer
- [ ] Cross-document pattern discovery UI (confirmed 2026-08-08) — surfaces connections/patterns
      found across multiple documents once the backend's cross-document feature (see
      `backend/plans.md` Phase 2+) exists. Dedicated feature, not just multi-doc citations in one
      answer.
- [ ] NextAuth v5 activation (Phase 3, currently dormant shell only)
