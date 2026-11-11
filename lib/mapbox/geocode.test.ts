import test from "node:test";
import assert from "node:assert/strict";

import { parsePermanentResponse, permanentForwardUrl, permanentGeocodeWith } from "./geocode.ts";

const TOKEN = "pk.test-token";
const OK_BODY = {
  features: [
    {
      id: "feat-1",
      geometry: { coordinates: [153.0251, -27.4698] },
      properties: { full_address: "1 Queen Street, Brisbane City QLD 4000, Australia", mapbox_id: "mbx-1" },
    },
  ],
};

function fakeFetch(respond: (url: URL) => Response | Promise<Response>) {
  const calls: URL[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(url);
    return respond(url);
  }) as typeof fetch;
  return { impl, calls };
}

test("forward URL asks for one permanent Australian result near the pin", () => {
  const url = permanentForwardUrl("  1 Queen St, Brisbane  ", TOKEN, { lat: -27.47, lng: 153.02 })!;
  assert.equal(url.origin + url.pathname, "https://api.mapbox.com/search/geocode/v6/forward");
  assert.equal(url.searchParams.get("q"), "1 Queen St, Brisbane");
  assert.equal(url.searchParams.get("permanent"), "true");
  assert.equal(url.searchParams.get("country"), "au");
  assert.equal(url.searchParams.get("limit"), "1");
  assert.equal(url.searchParams.get("proximity"), "153.02,-27.47");
  assert.equal(url.searchParams.get("access_token"), TOKEN);
});

test("forward URL: no address or no token means no request", () => {
  assert.equal(permanentForwardUrl("   ", TOKEN), null);
  assert.equal(permanentForwardUrl("1 Queen St", "  "), null);
  assert.equal(permanentForwardUrl("x".repeat(400), TOKEN)!.searchParams.get("q")!.length, 256);
});

test("parse: reads lng,lat order and the ids", () => {
  const r = parsePermanentResponse(OK_BODY)!;
  assert.equal(r.lat, -27.4698);
  assert.equal(r.lng, 153.0251);
  assert.equal(r.mapboxId, "mbx-1");
  assert.match(r.fullAddress!, /Queen Street/);
});

test("parse: rejects empty, malformed and out-of-range answers", () => {
  assert.equal(parsePermanentResponse(null), null);
  assert.equal(parsePermanentResponse({ features: [] }), null);
  assert.equal(parsePermanentResponse({ features: [{ geometry: { coordinates: ["a", "b"] } }] }), null);
  assert.equal(parsePermanentResponse({ features: [{ geometry: { coordinates: [200, 10] } }] }), null);
});

test("lookup: success returns the confirmed point", async () => {
  const f = fakeFetch(() => Response.json(OK_BODY));
  const r = await permanentGeocodeWith(TOKEN, "1 Queen St", undefined, f.impl);
  assert.deepEqual(r, { ok: true, lat: -27.4698, lng: 153.0251, fullAddress: OK_BODY.features[0].properties.full_address, mapboxId: "mbx-1" });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].searchParams.get("permanent"), "true");
});

test("lookup: missing token is not_configured and makes no request", async () => {
  const f = fakeFetch(() => Response.json(OK_BODY));
  assert.deepEqual(await permanentGeocodeWith(undefined, "1 Queen St", undefined, f.impl), { ok: false, reason: "not_configured" });
  assert.deepEqual(await permanentGeocodeWith("", "1 Queen St", undefined, f.impl), { ok: false, reason: "not_configured" });
  assert.equal(f.calls.length, 0);
});

test("lookup: HTTP error (e.g. no card on the Mapbox account) is failed", async () => {
  const f = fakeFetch(() => new Response("forbidden", { status: 403 }));
  assert.deepEqual(await permanentGeocodeWith(TOKEN, "1 Queen St", undefined, f.impl), { ok: false, reason: "failed" });
});

test("lookup: no match is not_found; a thrown fetch is failed", async () => {
  const none = fakeFetch(() => Response.json({ features: [] }));
  assert.deepEqual(await permanentGeocodeWith(TOKEN, "nowhere", undefined, none.impl), { ok: false, reason: "not_found" });
  const boom = fakeFetch(() => {
    throw new Error("network");
  });
  assert.deepEqual(await permanentGeocodeWith(TOKEN, "1 Queen St", undefined, boom.impl), { ok: false, reason: "failed" });
});
