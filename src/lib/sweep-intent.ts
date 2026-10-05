/**
 * Spots a question that wants *every* mention of something, not one answer.
 *
 * Chat reads six passages, so "find all mentions of mining" is a question it
 * cannot answer in full — measured 2026-09-30: chat reached 7% of the
 * mentions of five test topics, plain search 65%. The Browse page lists every
 * match, counted, so for these questions the chat points there instead of
 * letting six passages pass as the whole picture.
 *
 * Who decides (changed 2026-10-05, CHUNK 22): the backend's query rewrite now
 * returns an `intent` verdict with the search terms it already makes, at no
 * extra request. When it is present it decides. The phrase match below is
 * the fallback for when the rewrite did not run (a timeout, or a turn saved
 * in the browser before the verdict existed). It only decides whether to
 * *offer* a link, so a miss costs nothing and a false hit costs one line.
 */

import type { QuestionIntent } from "@/lib/api/types";

const LEAD =
  /^\s*(?:please\s+)?(?:can you\s+|could you\s+)?(?:find|list|show|give|get|search for|look up|tell)(?:\s+me)?(?:\s+(?:all|every|each|any))?(?:\s+(?:of\s+)?the)?(?:\s+(?:mentions?|references?|instances?|occurrences?|articles?|passages?|stories|reports?|notices?|items?))?(?:\s+(?:of|about|on|to|regarding|concerning|for))?\s+/i;

const HOW_MANY =
  /^\s*(?:how\s+(?:many|often)(?:\s+(?:times|issues|articles|passages|reports))?|which\s+issues)(?:\s+(?:is|are|was|were|does|do|did|has|have|mention|mentions|mentioned|report|reports|cover|covers))*\s*/i;

const TRAILING = /\s+(?:is|are|was|were)?\s*(?:mentioned|reported|discussed|covered|referred to)\s*$/i;

const WANTS_EVERYTHING =
  /\b(?:all|every|each)\s+(?:the\s+)?(?:mentions?|references?|instances?|occurrences?|articles?|passages?|reports?|notices?|times?)\b|\b(?:find|list|show|give)(?:\s+me)?\s+(?:all|every)\b|\bhow (?:many|often)\b|\bwhich issues\b/i;

const END_PUNCTUATION = /[?.!]+\s*$/;

/**
 * The search words for an "everything" question, or `null` when it is an
 * ordinary one.
 *
 * @param question The reader's question as asked.
 * @param intent The backend's verdict; `null`/absent falls back to the phrase match.
 * @param topics The backend's subject terms, used when the question's wording
 *   has no lead phrase to strip ("Horse racing: every report, please").
 */
export function sweepTopic(
  question: string,
  intent?: QuestionIntent | null,
  topics: readonly string[] = [],
): string | null {
  const wantsAll = intent ? intent === "sweep" : WANTS_EVERYTHING.test(question);
  if (!wantsAll) return null;

  const whole = question.replace(END_PUNCTUATION, "").trim();
  const stripped = question
    .replace(LEAD, "")
    .replace(HOW_MANY, "")
    .replace(END_PUNCTUATION, "")
    .replace(TRAILING, "")
    .trim();
  // The reader's own words read best in the search box, but only once the
  // request part has come off. Nothing came off → the rewrite's subject terms.
  if (stripped.length >= 2 && stripped.toLowerCase() !== whole.toLowerCase()) return stripped;
  if (topics.length > 0) return topics.join(" ");
  // Left with nothing useful ("how many times?") → no honest search to offer.
  return stripped.length >= 2 ? stripped : null;
}
