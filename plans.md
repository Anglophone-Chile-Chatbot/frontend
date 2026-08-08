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
- `layout.tsx`: Playfair Display (headings) + Inter (body), TooltipProvider, Toaster
- `globals.css` `@theme inline`: --font-sans→inter, --font-heading→playfair
- CI workflow (lint + tsc + build)
- Live on Vercel with auto-deploy on push to main (Hobby, repo public)

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
- [ ] **THE ONE THING blocking a public URL: set `BACKEND_API_URL` in Vercel** →
      `http://129.80.3.40/api/v1`, Production scope, then redeploy.
      Deliberately **not** `NEXT_PUBLIC_` — that would ship the origin IP to the browser; the whole
      point of the Route Handler layer is that only the server knows it.
      Two things to expect and not panic about: (a) every question will answer "nothing in the
      archive" until the OCR pilot lands data — correct behaviour, empty DB; (b) Vercel is HTTPS
      and Oracle is plain HTTP, but that's a *server-to-server* call, so no browser mixed-content
      warning. It works. It's just not encrypted origin-side, which is the accepted Phase 1
      trade-off from the no-domain/no-Cloudflare decision.
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

## Phase 2+
- [ ] Semantic search UI, "similar passages" panel in viewer
- [ ] Cross-document pattern discovery UI (confirmed 2026-08-08) — surfaces connections/patterns
      found across multiple documents once the backend's cross-document feature (see
      `backend/plans.md` Phase 2+) exists. Dedicated feature, not just multi-doc citations in one
      answer.
- [ ] NextAuth v5 activation (Phase 3, currently dormant shell only)
