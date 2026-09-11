"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { Field, fieldClasses } from "@/app/components/input";
import { Chip } from "@/app/components/chip";
import {
  PRESETS,
  matchPreset,
  daysForPreset,
  removeDay,
  addDay,
} from "@/lib/document-types/reminder-schedule-logic";

/**
 * Reminder-schedule editor: a preset dropdown plus removable day chips.
 *
 * The chips are the actual source of truth — the dropdown is only a shortcut
 * for filling them in, and reflects rather than drives that state: it shows
 * whichever preset the current chips exactly match, or "Custom" the moment
 * they don't (a chip removed, a day added by hand). Picking "Custom" from the
 * dropdown is therefore a no-op; it can only ever be reached by editing, and
 * there's nothing to set. The decision logic itself (matching, validating,
 * inserting) lives in reminder-schedule-logic.ts and is unit-tested there —
 * this component only wires it to state and markup.
 *
 * Submits through a single hidden `<input>` serialized back to the same
 * comma-separated string the server's parseReminderDays() has always parsed
 * (app/dashboard/document-types/actions.ts) — the storage column is already
 * a plain array (`data!.reminder_days` is a `number[]`, inserted directly
 * with no join/stringify), so the comma-string only ever exists in transit
 * across this form. Nothing server-side changes.
 */
export function ReminderScheduleField({
  name,
  defaultValue,
  error,
}: {
  name: string;
  defaultValue: number[];
  error?: string;
}) {
  // Defensively sorted on the way in: the server always writes these
  // descending, but this stays correct even against a hand-edited row.
  const [days, setDays] = useState<number[]>(() =>
    [...defaultValue].sort((a, b) => b - a),
  );
  const [adding, setAdding] = useState(false);
  const [addValue, setAddValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const presetKey = useMemo(() => matchPreset(days), [days]);

  const applyPreset = (key: string) => {
    const preset = daysForPreset(key);
    if (preset) setDays(preset); // null (== "custom") — leave the chips untouched
  };

  const startAdding = () => {
    setAddValue("");
    setAddError(null);
    setAdding(true);
  };

  /** Returns true if there's nothing left to do (added, or nothing typed). */
  const commitAdd = (): boolean => {
    const result = addDay(days, addValue);
    if (result.ok) {
      setDays(result.days);
      return true;
    }
    if (result.error) setAddError(result.error);
    return !result.error; // empty input: nothing to add, but nothing wrong either
  };

  const handleAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Only close on success — an invalid entry stays open with its error
      // showing, since pressing Enter is a deliberate "add this" attempt.
      if (commitAdd()) setAdding(false);
    } else if (e.key === "Escape") {
      setAdding(false);
      setAddError(null);
    }
  };

  const handleAddBlur = () => {
    // Blur is as often "clicked away" as it is "done typing" — try to add
    // what's there, but never leave an error hanging once the input's gone.
    commitAdd();
    setAdding(false);
    setAddError(null);
  };

  return (
    <Field
      label="Reminder schedule (days before expiry)"
      htmlFor="reminder_preset"
      error={error}
    >
      <input type="hidden" name={name} value={days.join(", ")} />

      <select
        id="reminder_preset"
        value={presetKey}
        onChange={(e) => applyPreset(e.target.value)}
        className={fieldClasses()}
      >
        {PRESETS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
        {presetKey === "custom" && <option value="custom">Custom</option>}
      </select>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {days.map((day) => (
          <Chip
            key={day}
            onRemove={() => setDays((prev) => removeDay(prev, day))}
            removeLabel={`Remove ${day} days`}
          >
            {day} {day === 1 ? "day" : "days"}
          </Chip>
        ))}

        {adding ? (
          <input
            type="number"
            inputMode="numeric"
            min={1}
            autoFocus
            value={addValue}
            onChange={(e) => setAddValue(e.target.value)}
            onKeyDown={handleAddKeyDown}
            onBlur={handleAddBlur}
            placeholder="Days"
            aria-label="New reminder, days before expiry"
            className="w-16 rounded-full border border-line-strong bg-surface px-2.5 py-1 text-xs outline-none focus:border-brand"
          />
        ) : (
          <button
            type="button"
            onClick={startAdding}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-line-strong px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:border-brand hover:text-brand"
          >
            <Plus className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            Add day
          </button>
        )}
      </div>

      {addError && <p className="mt-1.5 text-xs text-expired">{addError}</p>}

      {days.length === 0 && !adding && !addError && (
        <p className="mt-1.5 text-xs text-ink-subtle">No expiry reminders.</p>
      )}
    </Field>
  );
}
