/**
 * Input validation shared by the chat Route Handler and the composer UI.
 *
 * Mirrors the backend's `max_prompt_chars` setting. Validating in both places
 * is deliberate: the client uses it for live affordances (counter, disabled
 * send), the server enforces it, since the client is not trustworthy.
 */

/** Matches `max_prompt_chars` in `backend/app/core/config.py`. */
export const MAX_PROMPT_CHARS = 2000;

/** Point at which the composer starts showing a character counter. */
export const PROMPT_COUNTER_THRESHOLD = 1700;

/**
 * Strip control characters and trim surrounding whitespace.
 *
 * Keeps `\n` and `\t` (a user may paste a quoted passage) and drops the rest
 * of the C0/C1 ranges, which have no business in a search query and can
 * corrupt SSE framing downstream.
 */
export function sanitizeMessage(input: string): string {
  return input
    .split("")
    .filter((char) => {
      const code = char.charCodeAt(0);
      if (char === "\n" || char === "\t") return true;
      const isC0 = code <= 0x1f;
      const isC1 = code >= 0x7f && code <= 0x9f;
      return !isC0 && !isC1;
    })
    .join("")
    .trim();
}
