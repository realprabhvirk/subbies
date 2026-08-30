import "server-only";

import { Resend } from "resend";

/** Returns a configured Resend client, or null if the API key isn't set yet. */
export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

/** The verified sender. Override with RESEND_FROM once a better address exists. */
export const FROM_ADDRESS =
  process.env.RESEND_FROM ?? "Subbies <onboarding@unknwnmoving.store>";
