/**
 * Writing the project activity log (migration 0022). Every event goes
 * through these helpers, which call the SQL functions; nothing inserts into
 * project_activity directly.
 *
 * Best-effort by design: the action that caused the event has already
 * happened, so a failed log write is logged and swallowed rather than turning
 * a successful approve (or upload) into an error. If 0022 hasn't been applied
 * yet, the functions don't exist and every call quietly does nothing.
 *
 * Activity is recorded on every plan (D6); only viewing it is Business+.
 */
export type ProjectEventType =
  | "project_created"
  | "project_updated"
  | "contractor_assigned"
  | "contractor_removed"
  | "requirement_added"
  | "requirement_removed"
  | "document_uploaded"
  | "document_approved"
  | "document_rejected"
  | "document_replaced"
  | "document_expired"
  | "compliance_status_changed"
  | "photo_added"
  | "photo_removed"
  | "photo_replaced"
  | "location_changed"
  | "project_archived"
  | "project_completed";

/** Anything with Supabase's rpc(). Kept loose so tests can pass a fake. */
export interface RpcClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
}

function isMissingFunction(error: { code?: string; message?: string }): boolean {
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "");
}

function report(what: string, error: { code?: string; message?: string }) {
  if (isMissingFunction(error)) return; // 0022 not applied yet
  console.error(`project activity: ${what} failed`, { code: error.code, message: error.message });
}

/** One project, as the signed-in user. */
export async function recordProjectActivity(
  client: RpcClient,
  input: {
    projectId: string;
    eventType: ProjectEventType;
    description: string;
    contractorId?: string | null;
    documentId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const { error } = await client.rpc("record_project_activity", {
      p_project_id: input.projectId,
      p_event_type: input.eventType,
      p_description: input.description,
      p_contractor_id: input.contractorId ?? null,
      p_document_id: input.documentId ?? null,
      p_metadata: input.metadata ?? {},
    });
    if (error) report(input.eventType, error);
  } catch (err) {
    console.error("project activity: threw", { eventType: input.eventType, err: String(err) });
  }
}

/** Every project the contractor is on, as the signed-in user. */
export async function recordContractorActivity(
  client: RpcClient,
  input: {
    contractorId: string;
    eventType: ProjectEventType;
    description: string;
    documentId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const { error } = await client.rpc("record_contractor_activity", {
      p_contractor_id: input.contractorId,
      p_event_type: input.eventType,
      p_description: input.description,
      p_document_id: input.documentId ?? null,
      p_metadata: input.metadata ?? {},
    });
    if (error) report(input.eventType, error);
  } catch (err) {
    console.error("project activity: threw", { eventType: input.eventType, err: String(err) });
  }
}

/**
 * Every project the contractor is on, from a trusted server path with no
 * signed-in user (the token upload route, the daily job). Service-role
 * client only; the company id comes from server-side lookups, never input.
 */
export async function recordContractorActivityAsServer(
  admin: RpcClient,
  input: {
    companyId: string;
    contractorId: string;
    eventType: ProjectEventType;
    description: string;
    documentId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const { error } = await admin.rpc("subbies_record_contractor_activity", {
      p_company_id: input.companyId,
      p_contractor_id: input.contractorId,
      p_event_type: input.eventType,
      p_description: input.description,
      p_actor: null,
      p_document_id: input.documentId ?? null,
      p_metadata: input.metadata ?? {},
    });
    if (error) report(input.eventType, error);
  } catch (err) {
    console.error("project activity: threw", { eventType: input.eventType, err: String(err) });
  }
}

/** One project, from a trusted server path. Returns false on a duplicate (already recorded). */
export async function recordProjectActivityAsServer(
  admin: RpcClient,
  input: {
    companyId: string;
    projectId: string;
    eventType: ProjectEventType;
    description: string;
    contractorId?: string | null;
    documentId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc("subbies_insert_project_activity", {
      p_company_id: input.companyId,
      p_project_id: input.projectId,
      p_event_type: input.eventType,
      p_description: input.description,
      p_actor: null,
      p_contractor_id: input.contractorId ?? null,
      p_document_id: input.documentId ?? null,
      p_metadata: input.metadata ?? {},
    });
    if (error) {
      report(input.eventType, error);
      return false;
    }
    return data !== null;
  } catch (err) {
    console.error("project activity: threw", { eventType: input.eventType, err: String(err) });
    return false;
  }
}
