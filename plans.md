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

## Phase 1 — remaining
- [ ] Mobile-first layout (375px first): sidebar + main panel shell
- [ ] Public chatbot UI: `useChat` streaming, typing indicator, citation chips (tappable on mobile)
- [ ] Citation chip → opens document viewer at correct page, highlighted
- [ ] Document viewer (react-pdf) with citation highlight overlays; text-by-default on mobile, image on tap
- [ ] Archive browser: search + filter by date/publication, results show publication name + date + snippet
- [ ] Route Handlers proxying to FastAPI backend (Oracle IP / eventual domain)
- [ ] Cloudflare Turnstile widget on chat input (invisible)
- [ ] Realistic newspaper-archive copy for empty states (no lorem ipsum)
- [ ] Wire NEXT_PUBLIC_ backend URL env var in Vercel once backend is publicly reachable

## Phase 2+
- [ ] Semantic search UI, "similar passages" panel in viewer
- [ ] NextAuth v5 activation (Phase 3, currently dormant shell only)
