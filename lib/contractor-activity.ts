import type { DocumentStatus } from "@/lib/types";

export type ActivityKind =
  | "added"
  | "requested"
  | "uploaded"
  | "approved"
  | "rejected"
  | "assigned"
  | "unassigned";

export interface ActivityEvent {
  id: string;
  at: string;
  kind: ActivityKind;
  title: string;
  detail?: string;
}

interface ActivityInput {
  createdAt: string;
  documents: {
    id: string;
    name: string;
    status: DocumentStatus;
    createdAt: string;
    updatedAt: string;
    expiryDate: string | null;
    rejectionReason: string | null;
  }[];
  assignments: {
    id: string;
    projectName: string;
    assignedAt: string;
    removedAt: string | null;
  }[];
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/**
 * A best-effort activity timeline derived from existing timestamped rows.
 *
 * It reflects each document's *current* state at its last-updated time — it
 * can't show every intermediate transition (e.g. a document that was rejected
 * and then re-uploaded shows only the latest event). Good enough for a
 * working history; a dedicated event log would be the upgrade path.
 */
export function buildContractorActivity(input: ActivityInput): ActivityEvent[] {
  const events: ActivityEvent[] = [
    {
      id: "added",
      at: input.createdAt,
      kind: "added",
      title: "Contractor added",
    },
  ];

  for (const doc of input.documents) {
    events.push({
      id: `req-${doc.id}`,
      at: doc.createdAt,
      kind: "requested",
      title: `${doc.name} requested`,
    });

    if (doc.status === "uploaded") {
      events.push({
        id: `up-${doc.id}`,
        at: doc.updatedAt,
        kind: "uploaded",
        title: `${doc.name} uploaded`,
      });
    } else if (doc.status === "approved") {
      events.push({
        id: `ap-${doc.id}`,
        at: doc.updatedAt,
        kind: "approved",
        title: `${doc.name} approved`,
        detail: doc.expiryDate ? `Expires ${fmtDate(doc.expiryDate)}` : undefined,
      });
    } else if (doc.status === "rejected") {
      events.push({
        id: `rej-${doc.id}`,
        at: doc.updatedAt,
        kind: "rejected",
        title: `${doc.name} sent back`,
        detail: doc.rejectionReason ?? undefined,
      });
    }
  }

  for (const a of input.assignments) {
    events.push({
      id: `asg-${a.id}`,
      at: a.assignedAt,
      kind: "assigned",
      title: `Assigned to ${a.projectName}`,
    });
    if (a.removedAt) {
      events.push({
        id: `rem-${a.id}`,
        at: a.removedAt,
        kind: "unassigned",
        title: `Removed from ${a.projectName}`,
      });
    }
  }

  return events.sort(
    (x, y) => new Date(y.at).getTime() - new Date(x.at).getTime(),
  );
}
