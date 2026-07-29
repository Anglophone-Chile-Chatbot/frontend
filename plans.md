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

## Phase 2+
- [ ] Semantic search UI, "similar passages" panel in viewer
- [ ] NextAuth v5 activation (Phase 3, currently dormant shell only)
