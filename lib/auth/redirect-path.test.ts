import test from "node:test";
import assert from "node:assert/strict";

import { safeRedirectPath } from "./redirect-path.ts";

test("a normal in-app path is allowed through unchanged", () => {
  assert.equal(safeRedirectPath("/dashboard/contractors"), "/dashboard/contractors");
  assert.equal(safeRedirectPath("/dashboard/settings?tab=billing"), "/dashboard/settings?tab=billing");
  assert.equal(safeRedirectPath("/"), "/");
});

test("missing or empty falls back to the dashboard", () => {
  assert.equal(safeRedirectPath(null), "/dashboard");
  assert.equal(safeRedirectPath(undefined), "/dashboard");
  assert.equal(safeRedirectPath(""), "/dashboard");
});

// --- the open-redirect shapes this exists to block --------------------------

test("an absolute URL to another site falls back", () => {
  assert.equal(safeRedirectPath("https://evil.example/login"), "/dashboard");
  assert.equal(safeRedirectPath("http://evil.example"), "/dashboard");
});

test("a protocol-relative URL (//host) falls back — browsers read it as a host", () => {
  assert.equal(safeRedirectPath("//evil.example/dashboard"), "/dashboard");
});

test("a backslash after the slash falls back — browsers normalise /\\ to //", () => {
  assert.equal(safeRedirectPath("/\\evil.example"), "/dashboard");
});

test("a bare scheme without slashes falls back", () => {
  assert.equal(safeRedirectPath("javascript:alert(1)"), "/dashboard");
  assert.equal(safeRedirectPath("mailto:x@y"), "/dashboard");
});

test("a path with whitespace or a newline falls back", () => {
  assert.equal(safeRedirectPath("/dash board"), "/dashboard");
  assert.equal(safeRedirectPath("/dashboard\n//evil.example"), "/dashboard");
});

test("a custom fallback is honoured", () => {
  assert.equal(safeRedirectPath("https://evil.example", "/login"), "/login");
});
