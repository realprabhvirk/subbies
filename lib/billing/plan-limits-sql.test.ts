/**
 * The plan limits and the "has access" rule exist twice: in TypeScript (the
 * friendly pre-checks and the UI) and in SQL (migration 0020, which is what
 * actually stops a create). If they drift, a company sees one limit and hits
 * another. This test reads the SQL and fails on any difference.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { PLANS } from "./plans.ts";
import { ACCESS_STATUSES } from "./access-statuses.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SQL = readFileSync(path.join(ROOT, "supabase/migrations/0020_security_audit_fixes.sql"), "utf8");

const RESOURCE: Record<string, "contractors" | "documentTypes" | "projects"> = {
  contractors: "contractors",
  document_types: "documentTypes",
  projects: "projects",
};

function sqlLimits(): Map<string, number | null> {
  const block = SQL.slice(SQL.indexOf("PLAN_LIMITS_BEGIN"), SQL.indexOf("PLAN_LIMITS_END"));
  assert.ok(block.length > 0, "PLAN_LIMITS markers not found in migration 0020");
  const out = new Map<string, number | null>();
  for (const m of block.matchAll(/\('(\w+)',\s*'(\w+)',\s*(null(?:::integer)?|\d+)\)/g)) {
    out.set(`${m[1]}.${m[2]}`, m[3].startsWith("null") ? null : Number(m[3]));
  }
  return out;
}

test("every plan limit in plans.ts matches subbies_plan_limit in migration 0020", () => {
  const sql = sqlLimits();
  const expected = new Map<string, number | null>();
  for (const plan of Object.values(PLANS)) {
    for (const [sqlName, tsName] of Object.entries(RESOURCE)) {
      expected.set(`${plan.id}.${sqlName}`, plan.limits[tsName]);
    }
  }
  assert.deepEqual(Object.fromEntries(sql), Object.fromEntries(expected));
});

test("the access statuses match subbies_company_has_access in migration 0020", () => {
  const marker = SQL.match(/-- ACCESS_STATUSES: ([\w,]+)/);
  assert.ok(marker, "ACCESS_STATUSES marker not found");
  assert.deepEqual(marker![1].split(",").sort(), [...ACCESS_STATUSES].sort());

  // And the function body itself, not just the comment.
  const fn = SQL.slice(SQL.indexOf("function public.subbies_company_has_access"));
  const body = fn.slice(0, fn.indexOf("$$;"));
  const inList = body.match(/s\.status in \(([^)]+)\)/);
  assert.ok(inList, "status list not found in subbies_company_has_access");
  const statuses = inList![1].split(",").map((x) => x.trim().replace(/'/g, "")).sort();
  assert.deepEqual(statuses, [...ACCESS_STATUSES].sort());
});
