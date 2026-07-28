import type { ChatSource, ChatStreamEvent } from "./types";

/**
 * Incremental parser for the backend's Server-Sent Event stream.
 *
 * A network chunk carries no alignment guarantee — one frame can arrive split
 * across two reads, and two frames can arrive in one read. So bytes are
 * buffered and only split on the blank-line frame terminator.
 */
export class SseParser {
  private buffer = "";

  /** Feed a decoded chunk; returns whatever complete frames it completed. */
  push(chunk: string): ChatStreamEvent[] {
    this.buffer += chunk;
    const events: ChatStreamEvent[] = [];

    // Frames are separated by a blank line. Normalize CRLF first so a proxy
    // that rewrites line endings doesn't break framing.
    const normalized = this.buffer.replace(/\r\n/g, "\n");
    const parts = normalized.split("\n\n");

    // The trailing part is either empty (clean frame boundary) or a partial
    // frame that must wait for more bytes.
    this.buffer = parts.pop() ?? "";

    for (const part of parts) {
      const event = parseFrame(part);
      if (event) events.push(event);
    }
    return events;
  }
}

/** Parse one `event: <name>\ndata: <json>` frame into a typed event. */
function parseFrame(frame: string): ChatStreamEvent | null {
  let name = "";
  const dataLines: string[] = [];

  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) {
      name = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
    // Comment lines (`:`) and unknown fields are ignored, per the SSE spec.
  }

  if (!name || dataLines.length === 0) return null;

  let data: unknown;
  try {
    data = JSON.parse(dataLines.join("\n"));
  } catch {
    return null;
  }
  return toEvent(name, data);
}

/** Structural check for one entry of the `sources` array. */
function isChatSource(value: unknown): value is ChatSource {
  if (typeof value !== "object" || value === null) return false;
  const source = value as Record<string, unknown>;
  return (
    typeof source.chunk_id === "string" &&
    typeof source.page_id === "string" &&
    typeof source.document_id === "string" &&
    typeof source.page_number === "number"
  );
}

/** Narrow an untrusted parsed payload into a `ChatStreamEvent`. */
function toEvent(name: string, data: unknown): ChatStreamEvent | null {
  if (typeof data !== "object" || data === null) return null;
  const payload = data as Record<string, unknown>;

  switch (name) {
    case "sources": {
      const sources = payload.sources;
      if (!Array.isArray(sources)) return null;
      return { type: "sources", sources: sources.filter(isChatSource) };
    }
    case "delta": {
      const text = payload.text;
      return typeof text === "string" ? { type: "delta", text } : null;
    }
    case "done":
      return { type: "done" };
    case "error": {
      const message = payload.message;
      return {
        type: "error",
        message: typeof message === "string" ? message : "generation_failed",
      };
    }
    default:
      return null;
  }
}
