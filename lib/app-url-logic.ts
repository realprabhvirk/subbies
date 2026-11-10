/**
 * Pure half of getAppUrl (lib/app-url.ts), so it runs under `node --test`.
 *
 * Links in emails are built from this, so it must never come from a request
 * header in production: a forged host header would put an
 * attacker's domain in front of a real upload token. Production therefore
 * requires NEXT_PUBLIC_APP_URL and throws without it. The forwarded-host header is
 * never read anywhere.
 */
export function resolveAppUrl(input: {
  configured: string | undefined;
  nodeEnv: string | undefined;
  /** The request's Host header, used only outside production. */
  host: string | null;
}): string {
  const configured = input.configured?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  if (input.nodeEnv === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL must be set in production. Email links can't be built without it.");
  }

  // Local development only.
  if (input.host && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(input.host)) return `http://${input.host}`;
  return "http://localhost:3000";
}
