import test from "node:test";
import assert from "node:assert/strict";

import {
  canRevoke,
  canResendRequest,
  canEditApprovedExpiry,
  canSubmitDocument,
  isValidApprovalExpiry,
  isValidCorrectedExpiry,
  validateStagedBatch,
  MAX_FILES_PER_SUBMISSION,
} from "./document-actions-logic.ts";
import type { DocumentStatus } from "./types.ts";

const ALL_STATUSES: DocumentStatus[] = [
  "requested",
  "uploaded",
  "approved",
  "rejected",
  "revoked",
];

// --- canRevoke ---------------------------------------------------------

test("canRevoke: only true for 'requested'", () => {
  for (const status of ALL_STATUSES) {
    assert.equal(canRevoke(status), status === "requested", status);
  }
});

// --- canResendRequest ----------------------------------------------------

test("canResendRequest: true for 'requested' and 'rejected' only", () => {
  for (const status of ALL_STATUSES) {
    assert.equal(
      canResendRequest(status),
      status === "requested" || status === "rejected",
      status,
    );
  }
});

// --- canEditApprovedExpiry -------------------------------------------------

test("canEditApprovedExpiry: only true for 'approved'", () => {
  for (const status of ALL_STATUSES) {
    assert.equal(canEditApprovedExpiry(status), status === "approved", status);
  }
});

// --- canSubmitDocument -----------------------------------------------------

test("canSubmitDocument: true for requested, rejected, and uploaded", () => {
  for (const status of ALL_STATUSES) {
    const expected = status === "requested" || status === "rejected" || status === "uploaded";
    assert.equal(canSubmitDocument(status), expected, status);
  }
});

test("canSubmitDocument: false once approved or revoked", () => {
  assert.equal(canSubmitDocument("approved"), false);
  assert.equal(canSubmitDocument("revoked"), false);
});

// --- isValidApprovalExpiry -------------------------------------------------

const now = new Date("2025-06-15T00:00:00Z");

test("isValidApprovalExpiry: rejects malformed input", () => {
  assert.equal(isValidApprovalExpiry("not-a-date", now).ok, false);
  assert.equal(isValidApprovalExpiry("2025-13-40", now).ok, false);
  assert.equal(isValidApprovalExpiry("", now).ok, false);
});

test("isValidApprovalExpiry: rejects a date in the past", () => {
  assert.equal(isValidApprovalExpiry("2020-01-01", now).ok, false);
});

test("isValidApprovalExpiry: accepts today", () => {
  assert.equal(isValidApprovalExpiry("2025-06-15", now).ok, true);
});

test("isValidApprovalExpiry: accepts a date within 15 years", () => {
  assert.equal(isValidApprovalExpiry("2030-01-01", now).ok, true);
});

test("isValidApprovalExpiry: rejects more than 15 years out", () => {
  assert.equal(isValidApprovalExpiry("2041-01-01", now).ok, false);
});

// --- isValidCorrectedExpiry --------------------------------------------

test("isValidCorrectedExpiry: accepts a past date (correcting to reality)", () => {
  // The one deliberate difference from isValidApprovalExpiry: fixing a
  // mistaken expiry can mean the real date was already in the past.
  assert.equal(isValidCorrectedExpiry("2020-01-01", now).ok, true);
});

test("isValidCorrectedExpiry: still rejects malformed input", () => {
  assert.equal(isValidCorrectedExpiry("not-a-date", now).ok, false);
});

test("isValidCorrectedExpiry: still rejects more than 15 years out", () => {
  assert.equal(isValidCorrectedExpiry("2041-01-01", now).ok, false);
});

// --- validateStagedBatch -----------------------------------------------

const opts = {
  isAllowedMimeType: (t: string) => t === "application/pdf" || t === "image/jpeg",
  maxBytes: 1000,
};

test("validateStagedBatch: empty batch is fine (nothing staged yet)", () => {
  assert.equal(validateStagedBatch([], opts).ok, true);
});

test("validateStagedBatch: accepts a valid batch", () => {
  const result = validateStagedBatch(
    [
      { name: "a.pdf", type: "application/pdf", size: 500 },
      { name: "b.jpg", type: "image/jpeg", size: 500 },
    ],
    opts,
  );
  assert.equal(result.ok, true);
});

test("validateStagedBatch: rejects a disallowed type anywhere in the batch", () => {
  const result = validateStagedBatch(
    [
      { name: "a.pdf", type: "application/pdf", size: 500 },
      { name: "b.exe", type: "application/x-msdownload", size: 500 },
    ],
    opts,
  );
  assert.equal(result.ok, false);
});

test("validateStagedBatch: rejects an oversized file anywhere in the batch", () => {
  const result = validateStagedBatch(
    [{ name: "a.pdf", type: "application/pdf", size: 5000 }],
    opts,
  );
  assert.equal(result.ok, false);
});

test("validateStagedBatch: enforces the max-files-per-submission ceiling", () => {
  const many = Array.from({ length: MAX_FILES_PER_SUBMISSION + 1 }, (_, i) => ({
    name: `f${i}.pdf`,
    type: "application/pdf",
    size: 10,
  }));
  assert.equal(validateStagedBatch(many, opts).ok, false);
});

test("validateStagedBatch: exactly the ceiling is still fine", () => {
  const exactly = Array.from({ length: MAX_FILES_PER_SUBMISSION }, (_, i) => ({
    name: `f${i}.pdf`,
    type: "application/pdf",
    size: 10,
  }));
  assert.equal(validateStagedBatch(exactly, opts).ok, true);
});
