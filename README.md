# Anglophone Chile Chatbot — Frontend

Public research archive and RAG chatbot for ~5,000 scanned 1800s Chilean English-language
newspaper pages. This repo is the Next.js frontend: chat interface, full-text archive search, and
document viewer. It talks to a FastAPI backend ([`backend`](https://github.com/Anglophone-Chile-Chatbot/backend))
running on a self-hosted Postgres + Gemini RAG pipeline.

Built for a professor and research assistants studying 19th-century English-language press in Chile.

## What's here

- **Chat** — ask questions across the archive (or scoped to a single document), streamed live
  from the backend with tappable citation chips linking back to source pages.
- **Archive search** — full-text search over the corpus, ranked results with publication, date,
  and snippet.
- **Document viewer** — read extracted page text or view the original scan, with cited passages
  highlighted and scrolled to automatically.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) + TypeScript
- [shadcn/ui](https://ui.shadcn.com) + Tailwind CSS v4
- Custom SSE chat hook (`useArchiveChat`) reading the backend's own citation-first stream protocol
  directly, rather than bending it into a generic chat SDK's wire format
- [Motion](https://motion.dev) for interface animation
- Playfair Display (headings) + Inter (body) via `next/font`

## Getting started

Needs Node.js 20 or newer (CI runs 20).

```bash
npm install
npm run dev
```

The dev server is pinned to **port 3417** (not 3000) — open [http://localhost:3417](http://localhost:3417).

Create `.env.local` with `BACKEND_API_URL` pointing at a running FastAPI backend: the live one
(`http://129.80.3.40/api/v1`, public reads) for front-end work, or `http://localhost:8000/api/v1` for a local one. Route
Handlers proxy every backend call — `/api/chat`, `/api/search`, `/api/pages/[id]` — so the backend
origin is never exposed to the browser.

## Status

Phase 1 (public chatbot, full-text search, document viewer) is functionally complete and verified
against the live backend: `/api/chat` streams real Server-Sent Events end-to-end, `/api/search`
proxies real Postgres full-text queries. The live corpus is a pilot of 15 issues (117 pages) from
five papers; the full ~5,000-page collection arrives after the bulk OCR run.

## Contributing

Work on a branch and open a pull request into `main`; pushing to `main` deploys to production.
The CI check (lint, type check, build) must pass. Every view is designed at 375px first.

Live deployment: [anglochile.vercel.app](https://anglochile.vercel.app) (the older frontend-gamma-dun-82.vercel.app address still works and points at the same project)

## Deploy

Deployed on [Vercel](https://vercel.com), auto-deploying `main` on push.
