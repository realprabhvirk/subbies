import type { NextConfig } from "next";

/**
 * The main external origin the browser talks to is the Supabase project (auth + database + storage signed uploads), derived from the public
 * env var so nothing is hardcoded. Stripe checkout and the billing portal are
 * top-level redirects (window.location), not embedded scripts or iframes, and
 * document signed-URLs open in a new tab — so neither needs a CSP allowance.
 * Fonts are self-hosted by next/font at build time.
 */
function supabaseOrigin(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return "";
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

/**
 * Mapbox (Phase 3): the overview's static map image, and inside the location
 * editor only, GL JS tiles and styles, Search Box requests, telemetry, and
 * the blob: web workers GL JS runs. These are the origins Mapbox's own CSP
 * guidance lists for GL JS.
 */
const MAPBOX_IMG = "https://api.mapbox.com";
const MAPBOX_CONNECT = "https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com";

function contentSecurityPolicy(): string {
  const supa = supabaseOrigin();
  const supaWs = supa ? supa.replace(/^https:/, "wss:") : "";
  const isDev = process.env.NODE_ENV !== "production";

  // 'unsafe-inline' for script/style is a deliberate, documented compromise:
  // Next.js injects inline bootstrap scripts and the app uses inline styles
  // (Tailwind + next/font), and locking those down needs per-request nonce
  // plumbing through middleware — a large change for a defence-in-depth layer
  // on an app that already escapes all user content. Everything else is
  // locked down. 'unsafe-eval' is added in dev only, where Next's HMR needs
  // it; production never gets it.
  const script = ["'self'", "'unsafe-inline'", isDev ? "'unsafe-eval'" : ""]
    .filter(Boolean)
    .join(" ");

  return [
    `default-src 'self'`,
    `script-src ${script}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:${supa ? " " + supa : ""} ${MAPBOX_IMG}`,
    `font-src 'self'`,
    `connect-src 'self'${supa ? ` ${supa} ${supaWs}` : ""} ${MAPBOX_CONNECT}`,
    `worker-src 'self' blob:`,
    `frame-src 'none'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // A stray package-lock.json in the parent directory makes Turbopack's
  // workspace-root inference ambiguous. Pin it to this project.
  turbopack: {
    root: __dirname,
  },
  // The PDF report reads its fonts and logo from lib/pdf/assets at runtime;
  // make sure they ship with that function.
  outputFileTracingIncludes: {
    "/api/projects/\\[id\\]/report": ["./lib/pdf/assets/**/*"],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
