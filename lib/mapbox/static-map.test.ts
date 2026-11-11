import test from "node:test";
import assert from "node:assert/strict";

import { isValidCoordinate, publicMapboxToken, staticMapUrl } from "./static-map.ts";

const TOKEN = "pk.eyJ1IjoidGVzdCIsImEiOiJjbHRlc3QifQ.abcdefghijklmnop";

test("static map URL: navy pin at the point, centred, 2x, token encoded", () => {
  const url = staticMapUrl({ lat: -28.0889, lng: 153.4512, token: TOKEN });
  assert.equal(
    url,
    `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+1e3a5f(153.451200,-28.088900)/153.451200,-28.088900,15,0/640x360@2x?access_token=${TOKEN}`,
  );
});

test("static map size is clamped to what the API accepts", () => {
  assert.match(staticMapUrl({ lat: 0, lng: 0, token: TOKEN, width: 5000, height: 0 }), /\/1280x1@2x\?/);
});

test("only a real public token is used; a secret or empty one means Map unavailable", () => {
  assert.equal(publicMapboxToken(TOKEN), TOKEN);
  assert.equal(publicMapboxToken(` ${TOKEN}\n`), TOKEN);
  assert.equal(publicMapboxToken("sk.eyJsecretsecretsecretsecret"), null);
  assert.equal(publicMapboxToken(""), null);
  assert.equal(publicMapboxToken(undefined), null);
});

test("coordinates", () => {
  assert.ok(isValidCoordinate(-28, 153));
  assert.ok(!isValidCoordinate(-91, 153));
  assert.ok(!isValidCoordinate(0, 181));
  assert.ok(!isValidCoordinate(Number.NaN, 0));
  assert.ok(!isValidCoordinate("1", 2));
});
