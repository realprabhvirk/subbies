import test from "node:test";
import assert from "node:assert/strict";

import {
  isLiveDocument,
  findPendingReplacement,
  findReplacementRow,
  canArchiveOrDelete,
  planResend,
  planArchive,
  planDelete,
  leavesRequirementMissing,
  originalToArchiveOnApprove,
  arrangeDocuments,
  type LifecycleRow,
  type ResendTarget,
} from "./document-lifecycle-logic.ts";
import type { DocumentStatus } from "./types.ts";

const row = (over: Partial<LifecycleRow> & { id: string }): LifecycleRow => ({
  status: "approved",
  archived_at: null,
  replaces_document_id: null,
  ...over,
});

const ALL: DocumentStatus[] = ["requested", "uploaded", "approved", "rejected", "revoked"];

// --- live vs archived vs replacement ---------------------------------------

test("a live document is neither archived nor a pending replacement", () => {
  assert.equal(isLiveDocument(row({ id: "a" })), true);
  assert.equal(isLiveDocument(row({ id: "a", archived_at: "2026-09-01T00:00:00Z" })), false);
  assert.equal(isLiveDocument(row({ id: "b", replaces_document_id: "a" })), false);
});

test("a cancelled replacement is not 'pending' — the original stands alone again", () => {
  const rows = [row({ id: "a" }), row({ id: "b", replaces_document_id: "a", status: "revoked" })];
  assert.equal(findPendingReplacement(rows, "a"), null);
  // ...but it is still findable, so a resend can reopen it rather than stack another.
  assert.equal(findReplacementRow(rows, "a")?.id, "b");
});

test("an archived replacement is neither pending nor findable", () => {
  const rows = [
    row({ id: "a" }),
    row({ id: "b", replaces_document_id: "a", status: "uploaded", archived_at: "2026-09-01T00:00:00Z" }),
  ];
  assert.equal(findPendingReplacement(rows, "a"), null);
  assert.equal(findReplacementRow(rows, "a"), null);
});

// --- which documents can be archived / deleted ------------------------------

test("archive/delete apply only where there is something to keep: approved, uploaded, rejected", () => {
  for (const s of ALL) {
    assert.equal(
      canArchiveOrDelete(s),
      s === "approved" || s === "uploaded" || s === "rejected",
      s,
    );
  }
});

// --- resend: the heart of requirement #1 ------------------------------------

const target = (over: Partial<ResendTarget> & { id: string }): ResendTarget => ({
  status: "approved",
  expired: false,
  replacement: null,
  ...over,
});

test("resend on a still-valid APPROVED doc adds a replacement and words it as an updated copy", () => {
  const [step] = planResend([target({ id: "a", status: "approved" })]);
  assert.deepEqual(step, { docId: "a", kind: "create_replacement", bucket: "refresh" });
});

test("resend never alters the approved document itself — it only ever creates or reuses a SEPARATE row", () => {
  // No step kind mutates the original's own status, expiry or files: the only
  // kinds are email_only, reopen (targeting the replacement) and
  // create_replacement (a new row).
  const steps = planResend([
    target({ id: "a", status: "approved" }),
    target({ id: "b", status: "approved", replacement: { id: "b2", status: "requested" } }),
    target({ id: "c", status: "approved", expired: true }),
  ]);
  for (const s of steps) {
    assert.ok(["email_only", "reopen", "create_replacement"].includes(s.kind));
    if (s.kind === "reopen") assert.notEqual(s.targetId, s.docId, "must reopen the replacement, not the approved original");
  }
});

test("resend on an EXPIRED approved doc still adds a replacement, but words it as needed (it is)", () => {
  const [step] = planResend([target({ id: "a", status: "approved", expired: true })]);
  assert.deepEqual(step, { docId: "a", kind: "create_replacement", bucket: "needed" });
});

test("a second resend on an approved doc reuses the replacement already on its way", () => {
  const [step] = planResend([
    target({ id: "a", status: "approved", replacement: { id: "r", status: "requested" } }),
  ]);
  assert.deepEqual(step, { docId: "a", kind: "email_only", bucket: "refresh" });
});

test("a cancelled replacement is reopened, not duplicated", () => {
  const [step] = planResend([
    target({ id: "a", status: "approved", replacement: { id: "r", status: "revoked" } }),
  ]);
  assert.deepEqual(step, { docId: "a", kind: "reopen", targetId: "r", bucket: "refresh" });
});

test("requested and rejected just re-send the email as 'needed'", () => {
  for (const status of ["requested", "rejected"] as const) {
    const [step] = planResend([target({ id: "a", status })]);
    assert.deepEqual(step, { docId: "a", kind: "email_only", bucket: "needed" }, status);
  }
});

test("an already-submitted doc (awaiting review) is an 'updated copy' request, no data change", () => {
  const [step] = planResend([target({ id: "a", status: "uploaded" })]);
  assert.deepEqual(step, { docId: "a", kind: "email_only", bucket: "refresh" });
});

test("resending a cancelled request reopens it", () => {
  const [step] = planResend([target({ id: "a", status: "revoked" })]);
  assert.deepEqual(step, { docId: "a", kind: "reopen", targetId: "a", bucket: "needed" });
});

test("every status produces a step — no status is filtered out", () => {
  for (const status of ALL) {
    assert.equal(planResend([target({ id: "a", status })]).length, 1, status);
  }
});

test("a mixed selection yields one step per document, in order", () => {
  const steps = planResend([
    target({ id: "1", status: "requested" }),
    target({ id: "2", status: "approved" }),
    target({ id: "3", status: "approved", expired: true }),
  ]);
  assert.deepEqual(steps.map((s) => s.docId), ["1", "2", "3"]);
  assert.deepEqual(steps.map((s) => s.bucket), ["needed", "refresh", "needed"]);
});

// --- approving a replacement ------------------------------------------------

test("approving a replacement identifies the original to archive; a normal doc archives nothing", () => {
  assert.equal(originalToArchiveOnApprove({ replaces_document_id: "orig" }), "orig");
  assert.equal(originalToArchiveOnApprove({ replaces_document_id: null }), null);
});

// --- archive ----------------------------------------------------------------

test("archiving the ONLY live copy adds a Missing placeholder so the requirement can't vanish", () => {
  const a = row({ id: "a" });
  assert.deepEqual(planArchive(a, [a]), { kind: "archive_and_placeholder" });
  assert.equal(leavesRequirementMissing(a, [a]), true);
});

test("archiving a live copy that has a replacement on the way promotes the replacement instead", () => {
  const a = row({ id: "a" });
  const r = row({ id: "r", replaces_document_id: "a", status: "requested" });
  assert.deepEqual(planArchive(a, [a, r]), { kind: "archive_and_promote", promoteId: "r" });
  assert.equal(leavesRequirementMissing(a, [a, r]), false);
});

test("archiving a copy whose only replacement was cancelled still leaves the requirement Missing", () => {
  const a = row({ id: "a" });
  const r = row({ id: "r", replaces_document_id: "a", status: "revoked" });
  assert.deepEqual(planArchive(a, [a, r]), { kind: "archive_and_placeholder" });
});

test("archiving a pending replacement just archives it; the original is untouched", () => {
  const a = row({ id: "a" });
  const r = row({ id: "r", replaces_document_id: "a", status: "uploaded" });
  assert.deepEqual(planArchive(r, [a, r]), { kind: "archive_only" });
  assert.equal(leavesRequirementMissing(r, [a, r]), false);
});

// --- delete -----------------------------------------------------------------

test("deleting the only live copy resets the SAME row to Missing (never absent, no insert to fail)", () => {
  const a = row({ id: "a" });
  assert.deepEqual(planDelete(a, [a]), { kind: "reset_to_missing" });
});

test("deleting a live copy with a replacement on the way just deletes the row (DB promotes the replacement)", () => {
  const a = row({ id: "a" });
  const r = row({ id: "r", replaces_document_id: "a", status: "requested" });
  assert.deepEqual(planDelete(a, [a, r]), { kind: "delete_row" });
});

test("deleting a replacement or an archived record just deletes that row", () => {
  const a = row({ id: "a" });
  const r = row({ id: "r", replaces_document_id: "a", status: "uploaded" });
  const old = row({ id: "old", archived_at: "2026-09-01T00:00:00Z" });
  assert.deepEqual(planDelete(r, [a, r]), { kind: "delete_row" });
  assert.deepEqual(planDelete(old, [old]), { kind: "delete_row" });
  assert.equal(leavesRequirementMissing(old, [old]), false);
});

test("deleting an archived record never touches a live requirement", () => {
  const live = row({ id: "live" });
  const old = row({ id: "old", archived_at: "2026-09-01T00:00:00Z" });
  assert.equal(planDelete(old, [live, old]).kind, "delete_row");
});

// --- display ordering + flags -----------------------------------------------

test("a replacement is listed directly beneath the document it replaces, sorted by name", () => {
  const rows = [
    { ...row({ id: "z" }), documentName: "Zebra licence" },
    { ...row({ id: "a" }), documentName: "Public liability" },
    { ...row({ id: "a2", replaces_document_id: "a", status: "requested" }), documentName: "Public liability" },
  ];
  const out = arrangeDocuments(rows);
  assert.deepEqual(out.map((r) => r.id), ["a", "a2", "z"]);
  assert.equal(out[0].hasPendingReplacement, true);
  assert.equal(out[1].isReplacement, true);
  assert.equal(out[2].isReplacement, false);
});

test("only a live doc with nothing on the way is flagged 'only current' (drives the Missing warning)", () => {
  const rows = [
    { ...row({ id: "a" }), documentName: "A" },
    { ...row({ id: "b" }), documentName: "B" },
    { ...row({ id: "b2", replaces_document_id: "b", status: "requested" }), documentName: "B" },
  ];
  const out = arrangeDocuments(rows);
  assert.equal(out.find((r) => r.id === "a")?.isOnlyCurrent, true);
  assert.equal(out.find((r) => r.id === "b")?.isOnlyCurrent, false);
  assert.equal(out.find((r) => r.id === "b2")?.isOnlyCurrent, false);
});

test("archived rows never appear in the live list", () => {
  const rows = [
    { ...row({ id: "a" }), documentName: "A" },
    { ...row({ id: "old", archived_at: "2026-09-01T00:00:00Z" }), documentName: "A" },
  ];
  assert.deepEqual(arrangeDocuments(rows).map((r) => r.id), ["a"]);
});

test("a replacement whose original is gone is treated as a normal live row, not orphaned", () => {
  const rows = [{ ...row({ id: "r", replaces_document_id: "missing", status: "requested" }), documentName: "A" }];
  const [only] = arrangeDocuments(rows);
  assert.equal(only.id, "r");
  assert.equal(only.isReplacement, false);
});

// --- describeRequirement ----------------------------------------------------

import { describeRequirement } from "./document-lifecycle-logic.ts";

test("every status has a plain-English line", () => {
  const base = { expiryLabel: null, expired: false, hasPendingReplacement: false };
  assert.equal(describeRequirement({ ...base, status: "requested" }), "Not uploaded yet");
  assert.equal(describeRequirement({ ...base, status: "rejected" }), "Rejected, waiting on a replacement");
  assert.equal(describeRequirement({ ...base, status: "uploaded" }), "Submitted, awaiting your review");
  assert.match(describeRequirement({ ...base, status: "revoked" }), /cancelled/);
});

test("an approved doc reads valid or expired, with its date", () => {
  const base = { status: "approved" as const, hasPendingReplacement: false };
  assert.equal(
    describeRequirement({ ...base, expiryLabel: "1 June 2027", expired: false }),
    "Approved · expires 1 June 2027",
  );
  assert.equal(
    describeRequirement({ ...base, expiryLabel: "20 Sept 2026", expired: true }),
    "Approved · expired 20 Sept 2026",
  );
  assert.equal(describeRequirement({ ...base, expiryLabel: null, expired: false }), "Approved");
});

test("an approved doc with an updated copy already requested says so", () => {
  assert.equal(
    describeRequirement({
      status: "approved",
      expiryLabel: "1 June 2027",
      expired: false,
      hasPendingReplacement: true,
    }),
    "Approved · expires 1 June 2027 · updated copy requested",
  );
});
