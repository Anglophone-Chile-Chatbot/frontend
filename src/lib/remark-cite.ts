import type { Root, Text } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

/**
 * Remark plugin: turns `[CITE:chunk_id]` markers inside text nodes into a
 * custom `cite` mdast node, so citation chips compose with real markdown
 * (bold, headings, lists) instead of needing a separate text-splitting pass
 * that runs before/after markdown parsing.
 *
 * The backend instructs the LLM to emit these markers inline; resolving the
 * id against retrieved sources happens later, in the React renderer.
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
        children.push({ type: "text", value: node.value.slice(cursor, start) });
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
