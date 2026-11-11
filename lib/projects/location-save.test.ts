import test from "node:test";
import assert from "node:assert/strict";

import type { PermanentResult } from "../mapbox/geocode.ts";
import { decideLocationSave } from "./location-save.ts";

const PIN = { lat: -27.47, lng: 153.02 };

function lookup(result: PermanentResult) {
  const calls: string[] = [];
  const fn = async (address: string) => {
    calls.push(address);
    return result;
  };
  return { fn, calls };
}

const NOT_CONFIGURED = lookup({ ok: false, reason: "not_configured" });

test("hand-placed pin is stored exactly as placed, no lookup", async () => {
  const l = lookup({ ok: true, lat: 1, lng: 1, fullAddress: null, mapboxId: null });
  const d = await decideLocationSave({ address: "", ...PIN, placeId: "ignored", manual: true }, l.fn);
  assert.deepEqual(d, { ok: true, address: null, lat: PIN.lat, lng: PIN.lng, placeId: "ignored", manual: true });
  assert.equal(l.calls.length, 0);
});

test("searched pin confirmed in the browser stores the confirmed point", async () => {
  const l = lookup({ ok: false, reason: "not_configured" });
  const d = await decideLocationSave(
    { address: "1 Queen St", ...PIN, placeId: "search-id", manual: false, confirmed: { lat: -27.4698, lng: 153.0251, mapboxId: "perm-id" } },
    l.fn,
  );
  assert.deepEqual(d, { ok: true, address: "1 Queen St", lat: -27.4698, lng: 153.0251, placeId: "perm-id", manual: false });
  assert.equal(l.calls.length, 0, "no server lookup when the browser confirmed it");
});

test("searched pin without browser confirmation falls back to the server token", async () => {
  const l = lookup({ ok: true, lat: -27.4, lng: 153.1, fullAddress: null, mapboxId: "srv-id" });
  const d = await decideLocationSave({ address: "1 Queen St", ...PIN, placeId: "search-id", manual: false }, l.fn);
  assert.deepEqual(d, { ok: true, address: "1 Queen St", lat: -27.4, lng: 153.1, placeId: "srv-id", manual: false });
  assert.deepEqual(l.calls, ["1 Queen St"]);
});

test("searched pin that nobody could confirm is refused, never stored from search", async () => {
  const d = await decideLocationSave({ address: "1 Queen St", ...PIN, placeId: null, manual: false }, NOT_CONFIGURED.fn);
  assert.equal(d.ok, false);
  assert.match((d as { error: string }).error, /place the pin/i);
  const failed = await decideLocationSave(
    { address: "1 Queen St", ...PIN, placeId: null, manual: false },
    lookup({ ok: false, reason: "failed" }).fn,
  );
  assert.match((failed as { error: string }).error, /right now/);
});

test("bad input is refused before any lookup", async () => {
  const l = lookup({ ok: true, lat: 1, lng: 1, fullAddress: null, mapboxId: null });
  for (const bad of [null, {}, { ...PIN, lat: 120 }, { lat: Number.NaN, lng: 1 }, { lat: "1", lng: 2 }]) {
    const d = await decideLocationSave(bad as never, l.fn);
    assert.equal(d.ok, false);
  }
  // Searched pin needs an address.
  const d = await decideLocationSave({ address: "  ", ...PIN, placeId: null, manual: false }, l.fn);
  assert.equal(d.ok, false);
  // A bogus confirmed point is ignored, not stored.
  const bogus = await decideLocationSave(
    { address: "1 Queen St", ...PIN, placeId: null, manual: false, confirmed: { lat: 999, lng: 0, mapboxId: null } },
    NOT_CONFIGURED.fn,
  );
  assert.equal(bogus.ok, false);
  assert.equal(l.calls.length, 0);
});

test("manual is only true when it is exactly true; address is trimmed and capped", async () => {
  const d = await decideLocationSave(
    { address: `  ${"a".repeat(400)}  `, ...PIN, placeId: null, manual: "yes" as never, confirmed: { ...PIN, mapboxId: null } },
    NOT_CONFIGURED.fn,
  );
  assert.ok(d.ok);
  assert.equal((d as { manual: boolean }).manual, false);
  assert.equal((d as { address: string }).address.length, 300);
});
