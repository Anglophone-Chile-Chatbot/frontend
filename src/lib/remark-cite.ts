import type { Root, Text } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import type { State } from "mdast-util-to-hast";

/**
 * Remark plugin: turns `[CITE:chunk_id]` markers inside text nodes into a
 * custom `cite` mdast node, so citation chips compose with real markdown
 * (bold, headings, lists) instead of needing a separate text-splitting pass
 * that runs before/after markdown parsing.
 *
 * The backend instructs the LLM to emit these markers inline; resolving the
 * id against retrieved sources happens later, in the React renderer.
 *
 * `mdast-util-to-hast`'s default handler for a node type it doesn't
 * recognize wraps it in a block-level `<div>` (its only fallback for a node
 * with no `value` field) — which breaks inline flow and renders as an empty
 * `<div></div>` mid-sentence, forcing a line break around it. `citeHastHandlers`
 * must be passed to react-markdown's `remarkRehypeOptions.handlers` so the
 * `cite` node becomes a real inline hast element (`<cite-chunk>`) instead of
 * hitting that fallback.
 */

const CITE_PATTERN = /\[CITE:\s*([^\]\s]+)\s*\]/g;

export interface CiteNode {
  type: "cite";
  chunkId: string;
}

declare module "mdast" {
  interface StaticPhrasingContentMap {
    cite: CiteNode & { type: "cite" };
  }
}

export const remarkCite: Plugin<[], Root> = () => (tree) => {
  visit(tree, "text", (node: Text, index, parent) => {
    if (!parent || index === undefined) return;
    if (!node.value.includes("[CITE:")) return;

    const children: Array<Text | CiteNode> = [];
    let cursor = 0;
    for (const match of node.value.matchAll(CITE_PATTERN)) {
      const start = match.index;
      if (start > cursor) {
        // The model writes "...8s. 3d. [CITE:x]." — that space would render a
        // visible gap before the chip, and another before the period after it.
        // A citation is a footnote mark: it hugs the word it follows.
        const preceding = node.value.slice(cursor, start).replace(/[ \t]+$/, "");
        if (preceding) children.push({ type: "text", value: preceding });
      }
      children.push({ type: "cite", chunkId: match[1] });
      cursor = start + match[0].length;
    }
    if (cursor < node.value.length) {
      children.push({ type: "text", value: node.value.slice(cursor) });
    }

    parent.children.splice(index, 1, ...(children as never[]));
    return index + children.length;
  });
};

/**
 * mdast-to-hast handler for the `cite` node, keyed by node type in the
 * `handlers` map react-markdown passes through to `remark-rehype`. Emits a
 * real inline hast element (a made-up but valid custom tag name) carrying
 * `chunkId` as a property, so `hast-util-to-jsx-runtime` can match it to a
 * React component override by tag name in `answer-text.tsx`.
 */
export const citeHastHandlers = {
  cite(_state: State, node: CiteNode) {
    return {
      type: "element" as const,
      tagName: "cite-chunk",
      properties: { chunkId: node.chunkId },
      children: [],
    };
  },
};
