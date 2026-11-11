/**
 * L8: the security headers next.config.ts sends on every route, including the
 * CSP directives that stop framing (clickjacking), <base> hijacking and forms
 * posting to another origin. Reads the real config.
 */
import test from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example-project.supabase.co";
// next.config.ts is loaded as CommonJS by Next and reads __dirname; under
// node --test it's an ES module, so provide the same value.
(globalThis as Record<string, unknown>).__dirname = new URL("../..", import.meta.url).pathname;
const { default: nextConfig } = await import("../../next.config.ts");

async function headerMap(): Promise<Map<string, string>> {
  const rules = await nextConfig.headers!();
  const all = rules.find((r) => r.source === "/:path*");
  assert.ok(all, "headers apply to every path");
  return new Map(all!.headers.map((h) => [h.key.toLowerCase(), h.value]));
}

function directives(csp: string): Map<string, string> {
  return new Map(
    csp.split(";").map((d) => d.trim()).filter(Boolean).map((d) => {
      const [name, ...rest] = d.split(/\s+/);
      return [name, rest.join(" ")];
    }),
  );
}

test("L8: CSP blocks framing, <base> hijacking and cross-origin form posts", async () => {
  const csp = directives((await headerMap()).get("content-security-policy") ?? "");
  assert.equal(csp.get("frame-ancestors"), "'none'");
  assert.equal(csp.get("base-uri"), "'self'");
  assert.equal(csp.get("form-action"), "'self'");
  assert.equal(csp.get("object-src"), "'none'");
  assert.equal(csp.get("default-src"), "'self'");
});

test("L8: CSP allows the Supabase project and Mapbox (maps, search) for API calls, and nothing else external", async () => {
  const csp = directives((await headerMap()).get("content-security-policy") ?? "");
  assert.equal(
    csp.get("connect-src"),
    "'self' https://example-project.supabase.co wss://example-project.supabase.co https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com",
  );
  assert.equal(csp.get("img-src"), "'self' data: blob: https://example-project.supabase.co https://api.mapbox.com");
  assert.equal(csp.get("worker-src"), "'self' blob:");
});

test("L8: the other security headers are present", async () => {
  const h = await headerMap();
  assert.equal(h.get("x-frame-options"), "DENY");
  assert.equal(h.get("x-content-type-options"), "nosniff");
  assert.equal(h.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.match(h.get("strict-transport-security") ?? "", /max-age=\d+/);
  assert.match(h.get("permissions-policy") ?? "", /camera=\(\)/);
});
