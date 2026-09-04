# Graph Report - frontend  (2026-09-04)

## Corpus Check
- 70 files · ~56,036 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 171 nodes · 141 edges · 7 communities detected
- Extraction: 82% EXTRACTED · 18% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]

## God Nodes (most connected - your core abstractions)
1. `GET()` - 7 edges
2. `backendBaseUrl()` - 7 edges
3. `POST()` - 5 edges
4. `GET()` - 5 edges
5. `GET()` - 5 edges
6. `buildTable()` - 5 edges
7. `SourceViewer()` - 4 edges
8. `sanitizeMessage()` - 4 edges
9. `groupIssues()` - 3 edges
10. `parsePageBlocks()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `backendBaseUrl()`  [INFERRED]
  src/app/api/pages/[pageId]/image/route.ts → src/lib/api/backend.ts
- `onPointerMove()` --calls--> `GET()`  [INFERRED]
  src/components/archive/zoomable-image.tsx → src/app/api/pages/[pageId]/image/route.ts
- `foldToPages()` --calls--> `GET()`  [INFERRED]
  src/hooks/use-document-search.ts → src/app/api/pages/[pageId]/image/route.ts
- `parseAnswer()` --calls--> `GET()`  [INFERRED]
  src/lib/citations.ts → src/app/api/pages/[pageId]/image/route.ts
- `GET()` --calls--> `backendBaseUrl()`  [INFERRED]
  src/app/api/documents/[documentId]/pages/route.ts → src/lib/api/backend.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.14
Nodes (13): backendBaseUrl(), jsonError(), POST(), readDocumentIds(), clampInt(), GET(), jsonError(), sanitizeMessage() (+5 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (4): onPointerMove(), groupIssues(), foldToPages(), GET()

### Community 2 - "Community 2"
Cohesion: 0.21
Nodes (10): parseFrame(), SseParser, toEvent(), buildTable(), pad(), parsePageBlocks(), splicePageFigures(), splitRow() (+2 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (7): CitationChip(), SourceViewer(), useMediaQuery(), useSourcePage(), formatIssueDate(), formatIssueDateShort(), parseAnswer()

### Community 7 - "Community 7"
Cohesion: 0.4
Nodes (2): cn(), figureLabel()

### Community 8 - "Community 8"
Cohesion: 0.5
Nodes (2): cn(), Badge()

### Community 9 - "Community 9"
Cohesion: 0.67
Nodes (2): findPassage(), searchWords()

## Knowledge Gaps
- **Thin community `Community 7`** (6 nodes): `boxStyle()`, `cn()`, `drop()`, `figureLabel()`, `onKeyDown()`, `page-figures.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 8`** (4 nodes): `cn()`, `badge.tsx`, `utils.ts`, `Badge()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 9`** (4 nodes): `escapeRegExp()`, `findPassage()`, `searchWords()`, `passage-match.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GET()` connect `Community 1` to `Community 0`, `Community 3`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Why does `backendBaseUrl()` connect `Community 0` to `Community 1`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `parseAnswer()` connect `Community 3` to `Community 1`, `Community 2`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `GET()` (e.g. with `backendBaseUrl()` and `onPointerMove()`) actually correct?**
  _`GET()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `backendBaseUrl()` (e.g. with `POST()` and `GET()`) actually correct?**
  _`backendBaseUrl()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `POST()` (e.g. with `sanitizeMessage()` and `backendBaseUrl()`) actually correct?**
  _`POST()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `GET()` (e.g. with `sanitizeMessage()` and `backendBaseUrl()`) actually correct?**
  _`GET()` has 2 INFERRED edges - model-reasoned connections that need verification._