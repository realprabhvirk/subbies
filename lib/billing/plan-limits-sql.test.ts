/**
 * The plan limits and the "has access" rule exist twice: in TypeScript (the
 * friendly pre-checks and the UI) and in SQL (migration 0020, which is what
 * actually stops a create). If they drift, a company sees one limit and hits
 * another. This test reads the SQL and fails on any difference.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { PLANS, FEATURE_MIN_PLAN } from "./plans.ts";
import { ACCESS_STATUSES } from "./access-statuses.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MIGRATIONS = path.join(ROOT, "supabase/migrations");
const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();

/** The newest migration that redefines a function: that's the live definition. */
function latestDefining(marker: string): { file: string; sql: string } {
  for (const file of [...files].reverse()) {
    const sql = readFileSync(path.join(MIGRATIONS, file), "utf8");
    if (sql.includes(marker)) return { file, sql };
  }
  throw new Error(`no migration contains ${marker}`);
}

const LIMITS = latestDefining("PLAN_LIMITS_BEGIN");
const ACCESS = latestDefining("-- ACCESS_STATUSES:");
const ASSERT = latestDefining("function public.subbies_assert_can_add");
const SQL = LIMITS.sql;

const RESOURCE: Record<string, "contractors" | "documentTypes" | "projects"> = {
  contractors: "contractors",
  document_types: "documentTypes",
  projects: "projects",
};

function sqlLimits(): Map<string, number | null> {
  const block = SQL.slice(SQL.indexOf("PLAN_LIMITS_BEGIN"), SQL.indexOf("PLAN_LIMITS_END"));
  assert.ok(block.length > 0, `PLAN_LIMITS markers not found in ${LIMITS.file}`);
  const out = new Map<string, number | null>();
  for (const m of block.matchAll(/\('(\w+)',\s*'(\w+)',\s*(null(?:::integer)?|\d+)\)/g)) {
    out.set(`${m[1]}.${m[2]}`, m[3].startsWith("null") ? null : Number(m[3]));
  }
  return out;
}

test("every plan limit in plans.ts matches the latest subbies_plan_limit", () => {
  const sql = sqlLimits();
  const expected = new Map<string, number | null>();
  for (const plan of Object.values(PLANS)) {
    for (const [sqlName, tsName] of Object.entries(RESOURCE)) {
      expected.set(`${plan.id}.${sqlName}`, plan.limits[tsName]);
    }
  }
  assert.deepEqual(Object.fromEntries(sql), Object.fromEntries(expected));
});

test("the access statuses match the latest subbies_company_has_access", () => {
  const SQL = ACCESS.sql;
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

test("the SQL limit check counts what countResource counts (D8)", () => {
  const fn = ASSERT.sql.slice(ASSERT.sql.indexOf("function public.subbies_assert_can_add"));
  const body = fn.slice(0, fn.indexOf("$$;"));
  assert.match(body, /from public\.contractors\s+where company_id = p_company_id and archived_at is null/);
  assert.match(body, /from public\.projects\s+where company_id = p_company_id and status <> 'completed'/);

  const ts = readFileSync(path.join(ROOT, "lib/billing/entitlements.ts"), "utf8");
  assert.match(ts, /resource === "contractors"\) query = query\.is\("archived_at", null\)/);
  assert.match(ts, /resource === "projects"\) query = query\.neq\("status", "completed"\)/);
});

test("plan feature gates match the latest subbies_plan_has_feature", () => {
  const { file, sql } = latestDefining("PLAN_FEATURES_BEGIN");
  const block = sql.slice(sql.indexOf("PLAN_FEATURES_BEGIN"), sql.indexOf("PLAN_FEATURES_END"));
  assert.ok(block.length > 0, `PLAN_FEATURES markers not found in ${file}`);
  const fromSql: Record<string, string> = {};
  for (const m of block.matchAll(/\('(\w+)',\s*'(\w+)'\)/g)) fromSql[m[1]] = m[2];
  assert.deepEqual(fromSql, { ...FEATURE_MIN_PLAN });
});
