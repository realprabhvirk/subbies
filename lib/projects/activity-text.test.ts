import test from "node:test";
import assert from "node:assert/strict";

import { describeProjectEdit } from "./activity-text.ts";

const base = { name: "Job", address: "1 Site Rd", status: "active" as const, start_date: null, end_date: null };

test("nothing changed: no event", () => {
  assert.equal(describeProjectEdit(base, { ...base }), null);
});

test("completing is its own event", () => {
  assert.deepEqual(describeProjectEdit(base, { ...base, status: "completed" }), {
    eventType: "project_completed",
    description: "Marked the project completed",
  });
});

test("several changes read as one sentence", () => {
  assert.deepEqual(describeProjectEdit(base, { ...base, name: "Job 2", address: null, start_date: "2026-12-01" }), {
    eventType: "project_updated",
    description: "Renamed it to Job 2, removed the address, changed the dates",
  });
});

test("reopening a completed project", () => {
  assert.equal(describeProjectEdit({ ...base, status: "completed" }, base)?.description, "Set the status to active");
});
