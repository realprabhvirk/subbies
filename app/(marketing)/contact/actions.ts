"use server";

import { sendContactEmail } from "@/lib/email/contact";

export interface ContactState {
  ok: boolean;
  error?: string;
  fieldErrors?: { name?: string; email?: string; message?: string };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitContact(
  _prev: ContactState | null,
  formData: FormData,
): Promise<ContactState> {
  // Honeypot — real users never fill this hidden field.
  if (String(formData.get("company") ?? "").trim() !== "") {
    return { ok: true };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  const fieldErrors: ContactState["fieldErrors"] = {};
  if (!name) fieldErrors.name = "Let us know who you are.";
  else if (name.length > 120) fieldErrors.name = "That's a bit long.";
  if (!email) fieldErrors.email = "We need an email to reply to.";
  else if (!EMAIL_RE.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (!message) fieldErrors.message = "Add a short message.";
  else if (message.length > 4000) fieldErrors.message = "Keep it under 4000 characters.";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const result = await sendContactEmail({ name, email, message });
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "not_configured"
          ? "The contact form isn't switched on yet. Please email us directly for now."
          : "Something went wrong sending your message. Try again shortly.",
    };
  }

  return { ok: true };
}
