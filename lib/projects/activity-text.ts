/**
 * The frozen sentences for project edits. Pure, so the wording is tested.
 */
import type { ProjectStatus } from "../types.ts";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
};

interface ProjectFields {
  name: string;
  address: string | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
}

/** What changed, as one event. null when nothing did. */
export function describeProjectEdit(
  before: ProjectFields,
  after: ProjectFields,
): { eventType: "project_completed" | "project_updated"; description: string } | null {
  if (before.status !== "completed" && after.status === "completed") {
    return { eventType: "project_completed", description: "Marked the project completed" };
  }
  const parts: string[] = [];
  if (before.name !== after.name) parts.push(`renamed it to ${after.name}`);
  if ((before.address ?? "") !== (after.address ?? "")) parts.push(after.address ? "changed the address" : "removed the address");
  if (before.status !== after.status) parts.push(`set the status to ${STATUS_LABEL[after.status].toLowerCase()}`);
  if (before.start_date !== after.start_date || before.end_date !== after.end_date) parts.push("changed the dates");
  if (parts.length === 0) return null;
  const sentence = parts.join(", ");
  return { eventType: "project_updated", description: sentence.charAt(0).toUpperCase() + sentence.slice(1) };
}
