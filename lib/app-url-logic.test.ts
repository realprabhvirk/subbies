import test from "node:test";
import assert from "node:assert/strict";

import { resolveAppUrl } from "./app-url-logic.ts";

test("L1: the configured URL wins, without a trailing slash", () => {
  assert.equal(resolveAppUrl({ configured: "https://subbies.app/", nodeEnv: "production", host: "evil.test" }), "https://subbies.app");
});

test("L1: production without NEXT_PUBLIC_APP_URL throws instead of trusting a header", () => {
  assert.throws(() => resolveAppUrl({ configured: undefined, nodeEnv: "production", host: "evil.test" }), /NEXT_PUBLIC_APP_URL/);
  assert.throws(() => resolveAppUrl({ configured: "  ", nodeEnv: "production", host: null }), /NEXT_PUBLIC_APP_URL/);
});

test("L1: in development a forged host is ignored; localhost is used", () => {
  assert.equal(resolveAppUrl({ configured: undefined, nodeEnv: "development", host: "evil.test" }), "http://localhost:3000");
  assert.equal(resolveAppUrl({ configured: undefined, nodeEnv: "development", host: "localhost:3123" }), "http://localhost:3123");
});

test("L1: x-forwarded-host is never read in the app", async () => {
  const { readFileSync, readdirSync, statSync } = await import("node:fs");
  const path = await import("node:path");
  const root = path.resolve(import.meta.dirname, "..");
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") && /x-forwarded-host/i.test(readFileSync(full, "utf8"))) hits.push(full);
    }
  };
  walk(path.join(root, "app"));
  walk(path.join(root, "lib"));
  assert.deepEqual(hits, []);
});
