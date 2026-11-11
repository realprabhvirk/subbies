import { NO_ACCESS_MESSAGE_TEXT } from "@/lib/billing/messages";

/**
 * Turns the SUBBIES_* errors raised by the create functions in migration 0020
 * into copy a user can act on. Pure, so it runs under plain `node --test`.
 */
export type SubbiesRpcCode =
  | "SUBBIES_NO_COMPANY"
  | "SUBBIES_NO_ACCESS"
  | "SUBBIES_LIMIT_REACHED"
  | "SUBBIES_INVALID_INPUT"
  | "SUBBIES_UNKNOWN_DOCUMENT_TYPE"
  | "SUBBIES_NOT_FOUND"
  | "SUBBIES_FEATURE_NOT_IN_PLAN"
  | "SUBBIES_ALREADY_REQUIRED"
  | "SUBBIES_PHOTO_LIMIT";

const CODES: readonly SubbiesRpcCode[] = [
  "SUBBIES_NO_COMPANY",
  "SUBBIES_NO_ACCESS",
  "SUBBIES_LIMIT_REACHED",
  "SUBBIES_INVALID_INPUT",
  "SUBBIES_UNKNOWN_DOCUMENT_TYPE",
  "SUBBIES_NOT_FOUND",
  "SUBBIES_FEATURE_NOT_IN_PLAN",
  "SUBBIES_ALREADY_REQUIRED",
  "SUBBIES_PHOTO_LIMIT",
];

export function subbiesRpcCode(error: { message?: string | null } | null | undefined): SubbiesRpcCode | null {
  const message = error?.message ?? "";
  return CODES.find((c) => message.includes(c)) ?? null;
}

export function rpcErrorMessage(
  error: { message?: string | null } | null | undefined,
  what: "contractors" | "document types" | "projects" | "assignment" | "requirements",
): string {
  switch (subbiesRpcCode(error)) {
    case "SUBBIES_NO_COMPANY":
      return "Your session has expired. Reload and try again.";
    case "SUBBIES_NO_ACCESS":
      return NO_ACCESS_MESSAGE_TEXT;
    case "SUBBIES_LIMIT_REACHED":
      return `You've reached your plan's limit for ${what}. Upgrade in Settings → Billing to add more.`;
    case "SUBBIES_INVALID_INPUT":
      return "Some of the details aren't valid. Check the form and try again.";
    case "SUBBIES_UNKNOWN_DOCUMENT_TYPE":
      return "One of the selected documents is no longer available. Refresh and try again.";
    case "SUBBIES_NOT_FOUND":
      return "Couldn't find that project or contractor. Refresh and try again.";
    case "SUBBIES_FEATURE_NOT_IN_PLAN":
      return "That isn't included in your plan. Upgrade in Settings → Billing to use it.";
    case "SUBBIES_ALREADY_REQUIRED":
      return "That document type is already a requirement on this project.";
    case "SUBBIES_PHOTO_LIMIT":
      return "All 3 photo slots are used. Replace or delete one first.";
    default:
      return "Something went wrong. Try again.";
  }
}
