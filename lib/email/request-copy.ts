/**
 * The wording of the "here's your upload link" request email, kept free of
 * "server-only" and of the email shell so it can be tested directly. The HTML
 * version in onboarding.ts reuses REFRESH_NOTE so the two can't drift.
 *
 * The rule this exists to protect: when a valid copy is already on file and
 * the company just wants a fresh one, the email says "updated copy" and that
 * the current one stays valid. It must never say a valid document is missing,
 * needed, or expired.
 */

export interface RequestCopyInput {
  companyName: string;
  contactName: string | null;
  /** Genuinely outstanding: not supplied, rejected, or expired. */
  documentNames: string[];
  /** A valid copy is on file; an updated one is being requested. */
  refreshDocumentNames?: string[];
  onboardUrl: string;
}

export const REFRESH_NOTE =
  "What you've already sent is still valid until the new one is approved.";

export function requestSubject(input: RequestCopyInput): string {
  const onlyRefresh =
    input.documentNames.length === 0 && (input.refreshDocumentNames?.length ?? 0) > 0;
  return onlyRefresh
    ? `${input.companyName}: updated documents requested`
    : `${input.companyName}: documents needed before you start work`;
}

export function requestText(input: RequestCopyInput): string {
  const greeting = input.contactName ? `Hi ${input.contactName},` : "Hi,";
  const needed = input.documentNames;
  const refresh = input.refreshDocumentNames ?? [];
  const bullets = (names: string[]) => names.map((name) => `  - ${name}`).join("\n");

  const body: string[] = [];
  if (needed.length > 0) {
    body.push(
      `${input.companyName} uses Subbies to collect and review contractor compliance documents before work begins. They've asked you to provide the following:`,
      "",
      bullets(needed),
    );
  }
  if (refresh.length > 0) {
    if (body.length > 0) body.push("");
    body.push(
      needed.length > 0
        ? `They've also asked for an updated copy of the following. ${REFRESH_NOTE}`
        : `${input.companyName} uses Subbies to collect and review contractor compliance documents. They've asked for an updated copy of the following. ${REFRESH_NOTE}`,
      "",
      bullets(refresh),
    );
  }

  return [
    greeting,
    "",
    ...body,
    "",
    "Upload your documents here (no login needed, the link is unique to you):",
    input.onboardUrl,
    "",
    `If you have any questions, reply to this email and it will reach ${input.companyName}.`,
    "",
    "Sent via Subbies on behalf of " + input.companyName,
  ].join("\n");
}
