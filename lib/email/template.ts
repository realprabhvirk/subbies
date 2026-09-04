import "server-only";

/**
 * Shared building blocks for every transactional email in lib/email/.
 *
 * Email HTML is not web HTML: no flexbox/grid, no external stylesheets, and
 * inconsistent (often nonexistent) dark-mode and web-font support across
 * clients — Outlook desktop in particular renders with Word's engine, not a
 * browser one. So this sticks to the subset that's actually reliable:
 * table-based layout, inline styles only, real hex colors (no oklch — no
 * email client parses CSS Color 4), and a system-font stack instead of the
 * app's Space Grotesk/Hanken Grotesk webfonts, which most clients strip.
 *
 * Colors below are hex renders of the tokens in app/globals.css (oklch ->
 * sRGB), not eyeballed — see the "Subbies Design System (v2)" tokens there.
 * Keep the two in sync if the palette changes.
 */

export const EMAIL_COLORS = {
  canvas: "#f8f6f4", // --color-canvas (warm-25)
  card: "#fcfcfa", // --color-surface (warm-0)
  border: "#ebe7e3", // --color-line (warm-100)
  ink: "#120e0e", // --color-ink (warm-900)
  inkMuted: "#7a736f", // --color-ink-muted (warm-500)
  brand: "#ee6438", // --color-brand (accent-500)
  brandHover: "#ce4d2d", // --color-brand-hover (accent-600)
  attention: "#a43520", // --color-attention (accent-700)
  attentionBg: "#ffeddf", // --color-attention-bg (accent-50)
  approved: "#2f7346", // --color-approved
  approvedBg: "#d9f3df", // --color-approved-bg
  expired: "#a83634", // --color-expired
  expiredBg: "#ffe0dc", // --color-expired-bg
} as const;

/** Approximates the app's Hanken Grotesk / system-ui stack for clients that strip web fonts. */
const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The Subbies mark, built from real table cells and text rather than an
 * externally-hosted image — no asset host is wired up for email yet, and an
 * `<img>` pointed at one is one broken link away from an email with no logo
 * at all. `border-radius` on the mark tile degrades to a plain square in
 * Outlook desktop, which is a fine fallback rather than a failure.
 */
function logoMark(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="width:28px;height:28px;background-color:${EMAIL_COLORS.brand};border-radius:6px;text-align:center;vertical-align:middle;font-family:${FONT_STACK};font-size:15px;font-weight:700;color:#ffffff;line-height:28px;">S</td>
    <td style="padding-left:9px;font-family:${FONT_STACK};font-size:16px;font-weight:700;color:${EMAIL_COLORS.ink};vertical-align:middle;">Subbies</td>
  </tr></table>`;
}

/**
 * A hidden preview-text snippet shown in the inbox list before the email is
 * opened (Gmail, Apple Mail, Outlook.com all support this convention). Padded
 * with a zero-width-joiner run so the client doesn't fall back to rendering
 * the email's own visible text (which would start with the logo) instead.
 */
function preheaderHtml(text: string): string {
  const padding = "&#8203;&zwnj;&nbsp;".repeat(20);
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${EMAIL_COLORS.canvas};">${escapeHtml(text)}${padding}</div>`;
}

/** A primary call-to-action button. Table-cell background + padded link, not a <button> — the reliable email-safe pattern. */
export function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 4px;"><tr>
    <td style="border-radius:6px;background-color:${EMAIL_COLORS.brand};">
      <a href="${href}" style="display:inline-block;padding:11px 24px;font-family:${FONT_STACK};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
    </td>
  </tr></table>`;
}

export type CalloutTone = "attention" | "expired" | "approved";

const CALLOUT_COLORS: Record<CalloutTone, { bg: string; text: string }> = {
  attention: { bg: EMAIL_COLORS.attentionBg, text: EMAIL_COLORS.attention },
  expired: { bg: EMAIL_COLORS.expiredBg, text: EMAIL_COLORS.expired },
  approved: { bg: EMAIL_COLORS.approvedBg, text: EMAIL_COLORS.approved },
};

/** A colored inline notice — a rejection reason, a payment warning, a success confirmation. Mirrors the in-app status colors. */
export function calloutBox(tone: CalloutTone, html: string): string {
  const { bg, text } = CALLOUT_COLORS[tone];
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;"><tr>
    <td style="padding:12px 14px;background-color:${bg};border-radius:6px;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${text};">${html}</td>
  </tr></table>`;
}

/**
 * The shared outer shell every email renders inside: canvas background, a
 * light card (never a dark theme — email clients' dark-mode handling is too
 * inconsistent to design against, per the app's existing design-system
 * notes), the logo mark, the body content, and a footer line.
 */
export function emailShell(input: {
  preheader: string;
  bodyHtml: string;
  footerHtml?: string;
}): string {
  const footer =
    input.footerHtml ??
    `Sent by Subbies.`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>Subbies</title>
  </head>
  <body style="margin:0;padding:0;background-color:${EMAIL_COLORS.canvas};">
    ${preheaderHtml(input.preheader)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL_COLORS.canvas};">
      <tr>
        <td align="center" style="padding:32px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:${EMAIL_COLORS.card};border:1px solid ${EMAIL_COLORS.border};border-radius:12px;">
            <tr>
              <td style="padding:22px 28px;border-bottom:1px solid ${EMAIL_COLORS.border};">
                ${logoMark()}
              </td>
            </tr>
            <tr>
              <td style="padding:28px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${EMAIL_COLORS.ink};">
                ${input.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;border-top:1px solid ${EMAIL_COLORS.border};font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:${EMAIL_COLORS.inkMuted};">
                ${footer}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function paragraph(html: string, opts?: { muted?: boolean; last?: boolean }): string {
  const color = opts?.muted ? EMAIL_COLORS.inkMuted : EMAIL_COLORS.ink;
  const size = opts?.muted ? "13px" : "15px";
  const margin = opts?.last ? "0" : "0 0 16px";
  return `<p style="margin:${margin};font-size:${size};line-height:1.6;color:${color};">${html}</p>`;
}
