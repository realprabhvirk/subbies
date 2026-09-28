import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Structural guards. These read the source rather than run it, because the
 * property they protect isn't a behaviour of one function — it's a rule about
 * every place in the codebase that touches documents and notes, including
 * ones written after this test.
 */

const ROOT = join(import.meta.dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(full);
  }
  return out;
}

const files = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "lib"))];
const rel = (f: string) => relative(ROOT, f).split("\\").join("/");

// --- every document query must ignore archived rows -------------------------

/**
 * A query on contractor_documents is fine if it writes (insert/update/delete),
 * or if the same statement mentions archived_at — i.e. it filters archived
 * rows out, or selects the column so the caller can refuse one. Anything else
 * is a READ that would count an archived document as if it were live:
 * inflating dashboard counts, emailing reminders about a document the company
 * archived, or showing the contractor something that was meant to be a record.
 */
const ALLOWED_UNFILTERED = new Set([
  // A diagnostic probe that only checks the table answers; it never reads a
  // row's content and nothing derives compliance from it.
  "app/api/health/uploads/route.ts",
]);

test("every read of contractor_documents excludes (or explicitly handles) archived rows", () => {
  const offenders: string[] = [];

  for (const file of files) {
    const path = rel(file);
    if (ALLOWED_UNFILTERED.has(path)) continue;
    const src = readFileSync(file, "utf8");

    let from = 0;
    for (;;) {
      const i = src.indexOf('from("contractor_documents")', from);
      if (i === -1) break;
      from = i + 1;

      const end = src.indexOf(";", i);
      const statement = src.slice(i, end === -1 ? undefined : end);
      const ok =
        /archived_at/.test(statement) || /\.(insert|update|delete)\(/.test(statement);
      if (!ok) {
        const line = src.slice(0, i).split("\n").length;
        offenders.push(`${path}:${line}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `These queries read contractor_documents without handling archived_at, so an archived document would be counted as live:\n  ${offenders.join("\n  ")}`,
  );
});

test("the guard actually sees the document queries (it isn't passing on an empty scan)", () => {
  const total = files.reduce(
    (n, f) => n + (readFileSync(f, "utf8").match(/from\("contractor_documents"\)/g)?.length ?? 0),
    0,
  );
  assert.ok(total >= 10, `expected to find the app's document queries, found ${total}`);
});

// --- notes stay private -----------------------------------------------------

test("contractor_notes is only ever touched by the company-side contractor pages", () => {
  const allowedPrefix = "app/dashboard/contractors/[id]/";
  const offenders = files
    .filter((f) => readFileSync(f, "utf8").includes("contractor_notes"))
    .map(rel)
    .filter((p) => !p.startsWith(allowedPrefix));

  assert.deepEqual(
    offenders,
    [],
    `Notes are private to the company. These files reference the notes table outside the company-side contractor pages:\n  ${offenders.join("\n  ")}`,
  );
});

test("nothing the contractor sees, and no email, can reach notes", () => {
  const contractorFacing = files.filter((f) => {
    const p = rel(f);
    return (
      p.startsWith("app/onboard/") ||
      p.startsWith("lib/email/") ||
      p === "lib/onboarding.ts" ||
      p === "lib/contractors/request-email.ts"
    );
  });
  assert.ok(contractorFacing.length >= 5, "expected to find the contractor-facing files");

  for (const f of contractorFacing) {
    const src = readFileSync(f, "utf8");
    assert.ok(!src.includes("contractor_notes"), `${rel(f)} must not reference notes`);
  }
});
