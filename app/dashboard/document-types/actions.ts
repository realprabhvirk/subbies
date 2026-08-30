"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";

export interface DocumentTypeFormState {
  ok: boolean;
  error?: string;
  fieldErrors?: {
    name?: string;
    default_duration_months?: string;
    reminder_days?: string;
  };
}

const MAX_NAME = 80;
const MAX_DURATION_MONTHS = 120;
const MAX_REMINDER_DAY = 3650;
const MAX_REMINDERS = 10;

function parseReminderDays(raw: string): { value: number[]; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: [] };

  const parts = trimmed.split(/[\s,]+/).filter(Boolean);
  const days: number[] = [];

  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n <= 0) {
      return { value: [], error: "Use whole numbers of days, e.g. 30, 14, 7." };
    }
    if (n > MAX_REMINDER_DAY) {
      return { value: [], error: `Reminder days must be ${MAX_REMINDER_DAY} or fewer.` };
    }
    if (!days.includes(n)) days.push(n);
  }

  if (days.length > MAX_REMINDERS) {
    return { value: [], error: `At most ${MAX_REMINDERS} reminders.` };
  }

  days.sort((a, b) => b - a);
  return { value: days };
}

function validate(formData: FormData): {
  data?: { name: string; default_duration_months: number; reminder_days: number[] };
  state?: DocumentTypeFormState;
} {
  const name = String(formData.get("name") ?? "").trim();
  const durationRaw = String(formData.get("default_duration_months") ?? "").trim();
  const reminderRaw = String(formData.get("reminder_days") ?? "");

  const fieldErrors: DocumentTypeFormState["fieldErrors"] = {};

  if (!name) fieldErrors.name = "Give this document type a name.";
  else if (name.length > MAX_NAME)
    fieldErrors.name = `Keep the name under ${MAX_NAME} characters.`;

  const duration = Number(durationRaw);
  if (!Number.isInteger(duration) || duration < 1 || duration > MAX_DURATION_MONTHS) {
    fieldErrors.default_duration_months = `Enter a whole number of months between 1 and ${MAX_DURATION_MONTHS}.`;
  }

  const reminders = parseReminderDays(reminderRaw);
  if (reminders.error) fieldErrors.reminder_days = reminders.error;

  if (Object.keys(fieldErrors).length > 0) {
    return { state: { ok: false, fieldErrors } };
  }

  return {
    data: {
      name,
      default_duration_months: duration,
      reminder_days: reminders.value,
    },
  };
}

export async function createDocumentType(
  _prev: DocumentTypeFormState | null,
  formData: FormData,
): Promise<DocumentTypeFormState> {
  const company = await getCompany();
  if (!company) return { ok: false, error: "Your session has expired. Reload and try again." };

  const { data, state } = validate(formData);
  if (state) return state;

  const supabase = await createClient();
  const { error } = await supabase.from("document_types").insert({
    company_id: company.id,
    name: data!.name,
    default_duration_months: data!.default_duration_months,
    reminder_days: data!.reminder_days,
  });

  if (error) {
    console.error("createDocumentType failed", error);
    return { ok: false, error: "Something went wrong saving this document type." };
  }

  revalidatePath("/dashboard/document-types");
  return { ok: true };
}

export async function updateDocumentType(
  _prev: DocumentTypeFormState | null,
  formData: FormData,
): Promise<DocumentTypeFormState> {
  const company = await getCompany();
  if (!company) return { ok: false, error: "Your session has expired. Reload and try again." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing document type reference." };

  const { data, state } = validate(formData);
  if (state) return state;

  const supabase = await createClient();
  const { error } = await supabase
    .from("document_types")
    .update({
      name: data!.name,
      default_duration_months: data!.default_duration_months,
      reminder_days: data!.reminder_days,
    })
    .eq("id", id)
    .eq("company_id", company.id);

  if (error) {
    console.error("updateDocumentType failed", error);
    return { ok: false, error: "Something went wrong updating this document type." };
  }

  revalidatePath("/dashboard/document-types");
  return { ok: true };
}

export async function deleteDocumentType(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const company = await getCompany();
  if (!company) return { ok: false, error: "Your session has expired. Reload and try again." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("document_types")
    .delete()
    .eq("id", id)
    .eq("company_id", company.id);

  if (error) {
    console.error("deleteDocumentType failed", error);
    return {
      ok: false,
      error:
        "Couldn't delete this document type. It may be in use by a contractor request.",
    };
  }

  revalidatePath("/dashboard/document-types");
  return { ok: true };
}
