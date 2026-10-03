/**
 * Spots a question that wants *every* mention of something, not one answer.
 *
 * Chat reads six passages, so "find all mentions of mining" is a question it
 * cannot answer in full — measured 2026-09-30: chat reached 7% of the
 * mentions of five test topics, plain search 65%. The Browse page lists every
 * match, counted, so for these questions the chat points there instead of
 * letting six passages pass as the whole picture.
 *
 * A phrase match, deliberately plain: it only decides whether to *offer* a
 * link, so a miss costs nothing and a false hit costs one dismissible line.
 */

const LEAD =
  /^\s*(?:please\s+)?(?:can you\s+|could you\s+)?(?:find|list|show|give|get|search for|look up|tell)(?:\s+me)?(?:\s+(?:all|every|each|any))?(?:\s+(?:of\s+)?the)?(?:\s+(?:mentions?|references?|instances?|occurrences?|articles?|passages?|stories|reports?|notices?|items?))?(?:\s+(?:of|about|on|to|regarding|concerning|for))?\s+/i;

const HOW_MANY =
  /^\s*(?:how\s+(?:many|often)(?:\s+(?:times|issues|articles|passages|reports))?|which\s+issues)(?:\s+(?:is|are|was|were|does|do|did|has|have|mention|mentions|mentioned|report|reports|cover|covers))*\s*/i;

const TRAILING = /\s+(?:is|are|was|were)?\s*(?:mentioned|reported|discussed|covered|referred to)\s*$/i;

const WANTS_EVERYTHING =
  /\b(?:all|every|each)\s+(?:the\s+)?(?:mentions?|references?|instances?|occurrences?|articles?|passages?|reports?|notices?|times?)\b|\b(?:find|list|show|give)(?:\s+me)?\s+(?:all|every)\b|\bhow (?:many|often)\b|\bwhich issues\b/i;

/** The search words for an "everything" question, or `null` when it is an ordinary one. */
export function sweepTopic(question: string): string | null {
  if (!WANTS_EVERYTHING.test(question)) return null;
  const stripped = question
    .replace(LEAD, "")
    .replace(HOW_MANY, "")
    .replace(/[?.!]+\s*$/, "")
    .replace(TRAILING, "")
    .trim();
  // Left with nothing useful ("how many times?") → no honest search to offer.
  return stripped.length >= 2 ? stripped : null;
}
