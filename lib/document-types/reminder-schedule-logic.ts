/**
 * Pure decision logic for the reminder-schedule field — no React, no DOM —
 * so it's directly unit-testable. reminder-schedule-field.tsx imports these
 * rather than re-deriving them inline, so what's tested here is exactly what
 * runs when someone picks a preset, removes a chip, or adds a custom day.
 *
 * Mirrors app/dashboard/document-types/actions.ts's parseReminderDays limits
 * exactly, so the client never accepts something the server would reject.
 */

export const MAX_REMINDER_DAY = 3650;
export const MAX_REMINDERS = 10;

export const PRESETS = [
  { key: "standard", label: "Standard", days: [30, 14, 7] },
  { key: "aggressive", label: "Aggressive", days: [30, 14, 7, 3, 1] },
  { key: "minimal", label: "Minimal", days: [7] },
  { key: "none", label: "No reminders", days: [] },
] as const;

export type PresetKey = (typeof PRESETS)[number]["key"];
export type MatchedPreset = PresetKey | "custom";

function sameDays(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Which preset the current chip set exactly matches, or "custom" if none do.
 * This is what the dropdown displays — it reflects the chips, it never drives
 * them, so there is nothing to compute the other direction.
 */
export function matchPreset(days: readonly number[]): MatchedPreset {
  return PRESETS.find((p) => sameDays(p.days, days))?.key ?? "custom";
}

/** The days for a given preset key, sorted descending, or null for "custom" (a no-op). */
export function daysForPreset(key: string): number[] | null {
  const preset = PRESETS.find((p) => p.key === key);
  return preset ? [...preset.days] : null;
}

export function removeDay(days: readonly number[], day: number): number[] {
  return days.filter((d) => d !== day);
}

export type AddDayResult =
  | { ok: true; days: number[] }
  | { ok: false; error: string };

/**
 * Validates and inserts one new reminder day, sorted-descending like every
 * preset and like the server's own parseReminderDays. `raw` is exactly what a
 * text input would hold — untrimmed, possibly empty, possibly not a number.
 */
export function addDay(days: readonly number[], raw: string): AddDayResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "" }; // nothing typed — not an error, just nothing to do

  const n = Number(trimmed);
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, error: "Whole numbers only, e.g. 45." };
  }
  if (n > MAX_REMINDER_DAY) {
    return { ok: false, error: `Use ${MAX_REMINDER_DAY} or fewer.` };
  }
  if (days.includes(n)) {
    return { ok: false, error: "Already on the list." };
  }
  if (days.length >= MAX_REMINDERS) {
    return { ok: false, error: `At most ${MAX_REMINDERS} reminders.` };
  }

  return { ok: true, days: [...days, n].sort((a, b) => b - a) };
}
