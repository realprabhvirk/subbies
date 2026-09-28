/**
 * Pure rules for contractor notes. No I/O, so the same validation runs in the
 * form (instant feedback) and the server action (the real gate).
 */

export const MAX_NOTE_LENGTH = 2000;

export type NoteResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

/** A note is trimmed, non-empty, and within the length the database enforces. */
export function validateNoteBody(raw: unknown): NoteResult {
  if (typeof raw !== "string") return { ok: false, error: "Write a note first." };
  const value = raw.trim();
  if (!value) return { ok: false, error: "Write a note first." };
  if (value.length > MAX_NOTE_LENGTH) {
    return { ok: false, error: `Keep notes under ${MAX_NOTE_LENGTH.toLocaleString("en-AU")} characters.` };
  }
  return { ok: true, value };
}

/**
 * "28 Sept 2026, 4:05 pm" in Sydney time. Pinned to a zone rather than the
 * reader's, because this is rendered on the server: an unpinned formatter
 * would print the server's clock (UTC on Vercel), which for an Australian
 * business puts a morning note on the previous day. The transactional emails
 * already use Australia/Sydney; this matches them.
 */
export function formatNoteTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Australia/Sydney",
  }).format(d);
}
