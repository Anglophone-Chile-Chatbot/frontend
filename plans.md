# frontend/plans.md
> Living checklist scoped to the `frontend/` repo only (Next.js 16, shadcn, chat UI, viewer).
> Read at session start. Remove items when actually done. Add confirmed decisions/tasks immediately.
> Never create other planning `.md` files — this is the only one for this repo.
> NOTE: this repo is on Next.js 16 (not 15) — read `node_modules/next/dist/docs/` before writing Next code; APIs differ from training data (async params, proxy.ts, etc). See AGENTS.md.

---

## ✅ DEPLOYING THIS REPO — pushing to `main` DOES deploy. (Corrected 2026-09-18; the 2026-08-31 and 2026-09-17 claims to the contrary were both wrong)

**Vercel is connected to this repo and auto-deploys `main`.** Dashboard shows
*Anglophone-Chile-Chatbot/frontend, Connected Jul 15*, and every recent commit carries a
`Vercel` / `success` GitHub commit status — which only exists when the git integration is live.
Full evidence, method and the retraction is in the **DEPLOYMENT** section further down this file;
read that before ever re-raising this.

`npx vercel --prod --yes` still works and is harmless, but it is **not required**. Do not tell
Shakib the site needs a manual deploy.

Prod alias: `https://frontend-gamma-dun-82.vercel.app`. **To check a deploy: one `gh` commit-status call, then one `curl` of a new route here. Never a wait loop.** **Verify on that URL, not localhost**, before
calling frontend work shipped — and note a `curl` 403 there is bot mitigation, not a broken deploy
(see the traps in the DEPLOYMENT section).

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

## Open verification items (2026-09-29)

- [ ] Look at the newspapers folder rail, filters, the "See every match" link and the By-issue list on a real phone and on the live site once the backend deploy carrying per-issue counts is up (2026-10-03: checked at 375px/1352px locally only).

---


## WHAT'S NEXT, in order (2026-10-03). Start here.

Pruned 2026-10-03 to open work only (1,591 lines → 179). Finished chunks (2, 3, 4, 6, 7, the 2026-08-11 audit,
A5, D5, W2, W3, W4a/d/e, W6, W7) are in git history (`git show 660afe3:plans.md`) and `infra/BUILT.md`.

1. **Research-assistant feedback.** He works through `TESTING.md`. Fix what he reports; keep `TESTING.md`
   current in the same turn as any change a reader would see (hard rule in CLAUDE.md).
2. **"Find all", second half** (with backend CHUNK 22): show the junk filter's result in the Browse list once the
   backend has it; replace the front-end phrase match (`lib/sweep-intent.ts`) with the backend's `intent` field.
3. **W4b: one-line "what is a Plate" explainer** (below). Small.
4. **W4c: blank or foxed plates** (below). Waits on a backend signal.
5. **Small items:** the header wordmark sits off-centre next to the rail on desktop (noticed 2026-08-11);
   check it, fix if still true.
6. **Later:** react-pdf is probably the wrong item (PDFs never reach the server) — drop unless the RA asks for
   it; Turnstile is blocked on having no Cloudflare; gate Vercel on CI only if a second contributor joins.

---

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


---

## ✅ DEPLOYMENT — Vercel DOES auto-deploy on push to `main`. The 2026-09-17 "manual deploy required" claim was WRONG and is retracted (corrected 2026-09-18)

**Pushing to `main` deploys the frontend automatically. It always has.** Do not add a manual
`vercel --prod` step, and do not tell Shakib the site needs a hand-deploy — he connected the repo
(Vercel dashboard → Project → Settings → Git shows *Anglophone-Chile-Chatbot/frontend, Connected
Jul 15*) and was made to re-verify it repeatedly because of this entry.

**The evidence that settles it, re-derived 2026-09-18 with commands, not inference:**

```
gh api repos/Anglophone-Chile-Chatbot/frontend/commits/<sha>/status
```

Every recent commit carries a **`Vercel` / `success`** commit status, which only exists when the git
integration is live and deploying:

| commit | Vercel status posted |
|---|---|
| `dd005f7` | 2026-09-18T10:27:02Z |
| `a223698` | 2026-09-17T17:35:42Z |
| `2a02375` | 2026-09-16T22:08:17Z |
| `1be9e59` | 2026-09-16T21:44:27Z |
| `dea7ebc` | 2026-09-15T23:05:31Z |
| `5099f61` | 2026-09-04T20:43:22Z |

`git reflog show origin/main --date=iso` cross-checks it: `1be9e59` was **pushed 09-17 03:44:02**
(+06), and a production deployment was **created 09-17 04:04:47** — with nothing manual run in
between. `.github/workflows/ci.yml` only lints/typechecks/builds and has no deploy step, so that
deployment could only have come from Vercel's git hook.

**Why the wrong entry happened, because the failure mode matters more than the fact.** The
2026-09-17 session saw "newest Production deployment is 12 days old, six commits aren't live" and
concluded *the integration is broken*. That was **an inference presented as a measurement** — the
exact trap `CLAUDE.md`'s "A MEASUREMENT IS NOT A STORY" rule describes. The staleness was real; the
cause was not checked. It then wrote the conclusion into five files, and every later session
(including 2026-09-18's) read it, believed it, and made Shakib re-prove his own dashboard — the same
stale-blocker loop `BACKEND_API_URL` caused on 2026-08-12, which the docs rule exists to prevent.
Worse, the wrong entry was *load-bearing*: it closed the question, so nobody ran the one `gh api`
command that would have refuted it in ten seconds.

**Rules going forward:**
1. **Never claim a deploy path is broken without checking the commit status / deployment source.**
   "Prod looks stale" is a symptom with several causes (propagation, a failed build, a cached
   browser, looking at the wrong alias) — the integration being off is only one of them.
2. `npx vercel --prod --yes` still *works* and is harmless, but it is **not required** and must not
   be described as required. Prefer letting the push deploy.
3. **The two verification traps below are real and still apply** — they were the only correct part
   of the retracted entry, and misreading them is probably what produced the false conclusion.

**Two traps when verifying a deployment:**
- **`curl` gets HTTP 403 "Vercel Security Checkpoint" on `frontend-gamma-dun-82.vercel.app`; a real
  browser passes it transparently.** That is bot mitigation (`x-vercel-mitigated: challenge`), not
  deployment protection, and it is not caused by deploying. **Do not read a curl 403 there as the
  site being down** — check in a browser first.
- Direct `frontend-<hash>-….vercel.app` URLs return **302** to auth. Normal. The alias is the
  public URL.

---

## Phase 2+
- [ ] Semantic search UI, "similar passages" panel in viewer
- [ ] Cross-document pattern discovery UI (confirmed 2026-08-08) — surfaces connections/patterns
      found across multiple documents once the backend's cross-document feature (see
      `backend/plans.md` Phase 2+) exists. Dedicated feature, not just multi-doc citations in one
      answer.
- [ ] NextAuth v5 activation (Phase 3, currently dormant shell only)
