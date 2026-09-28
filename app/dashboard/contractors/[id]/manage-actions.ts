"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCompany, getUser } from "@/lib/supabase/dal";
import { deleteContractorFiles } from "@/lib/storage";
import {
  sendRequestToContractor,
  disableUploadLink,
} from "@/lib/contractors/request-email";
import {
  formatAbn,
  isMissingColumnError,
  selectResendable,
  validateContractorDetails,
  type ContractorDetailsFieldErrors,
  type ContractorDetailsInput,
} from "@/lib/contractor-details-logic";
import { recomputeContractorStatus } from "@/lib/contractor-status";
import {
  findReplacementRow,
  planResend,
  type LifecycleRow,
} from "@/lib/document-lifecycle-logic";
import { daysUntilExpiry } from "@/lib/reminders/expiry-logic";
import type { DocumentStatus } from "@/lib/types";

const SESSION_EXPIRED = "Your session has expired. Reload and try again.";

function revalidateContractor(contractorId: string) {
  revalidatePath(`/dashboard/contractors/${contractorId}`);
  revalidatePath("/dashboard/contractors");
  revalidatePath("/dashboard");
}

// --- edit details -----------------------------------------------------------

export type UpdateDetailsResult =
  | { ok: true; saved: ContractorDetailsInput }
  | { ok: false; error?: string; fieldErrors?: ContractorDetailsFieldErrors };

/**
 * Saves edits to a contractor's contact and business details.
 *
 * The validation is re-run here as the real gate — the form runs the same
 * function for instant feedback, but a request can arrive from anywhere. The
 * write is scoped by `company_id` as well as `id`, on top of RLS: a contractor
 * id belonging to another company matches no row, and comes back as "couldn't
 * find that contractor" rather than as a permission error, so the response
 * never confirms that someone else's contractor exists.
 */
export async function updateContractorDetails(
  contractorId: string,
  input: ContractorDetailsInput,
): Promise<UpdateDetailsResult> {
  const company = await getCompany();
  if (!company) return { ok: false, error: SESSION_EXPIRED };
  if (typeof contractorId !== "string" || !contractorId) {
    return { ok: false, error: "Couldn't find that contractor." };
  }

  const validation = validateContractorDetails(input ?? ({} as ContractorDetailsInput));
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractors")
    .update(validation.data)
    .eq("id", contractorId)
    .eq("company_id", company.id)
    .select("id");

  if (error) {
    console.error("updateContractorDetails failed", { code: error.code, message: error.message });
    if (error.code === "23514") {
      return { ok: false, fieldErrors: { abn: "An ABN is 11 digits, e.g. 12 345 678 901." } };
    }
    if (isMissingColumnError(error)) {
      return {
        ok: false,
        error: "Saving isn't available yet: a pending database update hasn't been applied.",
      };
    }
    return { ok: false, error: "Couldn't save your changes. Try again." };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "Couldn't find that contractor." };
  }

  revalidateContractor(contractorId);
  return {
    ok: true,
    saved: {
      businessName: validation.data.business_name,
      contactName: validation.data.contact_name ?? "",
      email: validation.data.email,
      phone: validation.data.phone ?? "",
      abn: formatAbn(validation.data.abn),
    },
  };
}

// --- delete -----------------------------------------------------------------

export type DeleteContractorResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

/**
 * Permanently deletes a contractor and everything under them.
 *
 * Order matters, and each step is chosen so that stopping at any point leaves
 * something recoverable rather than something broken:
 *
 *  1. Confirm the caller owns this contractor. Nothing has changed yet.
 *  2. Disable the upload link, so nothing new can arrive through it while
 *     the files are being removed. It is expired rather than deleted, so if a
 *     later step fails the contractor still exists and a resend brings the
 *     link back.
 *  3. Remove their files from Storage. If ANY can't be removed — or the
 *     listing itself fails — stop here and delete nothing else. The database
 *     rows are the only record of what belongs to whom, so removing them
 *     first and then failing on the files would leave objects nothing points
 *     at. A failed delete is safe to retry: this step is idempotent.
 *  4. Delete the contractor row. Documents, file records, the link, project
 *     assignments, notifications and the reminder log all cascade off it.
 *
 * Hard delete, not soft: a soft-deleted contractor keeps its files counting
 * against the storage cap and keeps personal data the company asked to have
 * gone.
 */
export async function deleteContractor(
  contractorId: string,
): Promise<DeleteContractorResult> {
  const company = await getCompany();
  if (!company) return { ok: false, error: SESSION_EXPIRED };
  if (typeof contractorId !== "string" || !contractorId) {
    return { ok: false, error: "Couldn't find that contractor." };
  }

  const supabase = await createClient();

  // 1. Ownership.
  const { data: contractor } = await supabase
    .from("contractors")
    .select("id, business_name")
    .eq("id", contractorId)
    .eq("company_id", company.id)
    .maybeSingle<{ id: string; business_name: string }>();

  if (!contractor) return { ok: false, error: "Couldn't find that contractor." };

  // 2. Cut off the link before touching anything irreversible.
  if (!(await disableUploadLink(supabase, contractor.id))) {
    return {
      ok: false,
      error: `Couldn't disable ${contractor.business_name}'s upload link, so nothing was deleted. Try again.`,
    };
  }

  // 3. Their files.
  const files = await deleteContractorFiles(company.id, contractor.id);
  if (files.listFailed || files.failedPaths.length > 0) {
    console.error("deleteContractor: files could not be fully removed, aborting", {
      contractorId: contractor.id,
      listFailed: files.listFailed,
      failed: files.failedPaths.length,
    });
    return {
      ok: false,
      error: `We couldn't remove all of ${contractor.business_name}'s files, so the contractor was not deleted. Their upload link is switched off. Try again.`,
    };
  }

  // 4. The contractor itself.
  const { data: deleted, error } = await supabase
    .from("contractors")
    .delete()
    .eq("id", contractor.id)
    .eq("company_id", company.id)
    .select("id");

  if (error || !deleted || deleted.length === 0) {
    console.error("deleteContractor: row delete failed", {
      contractorId: contractor.id,
      code: error?.code,
      message: error?.message,
    });
    return {
      ok: false,
      error: `Their files were removed but ${contractor.business_name} couldn't be deleted. Try again.`,
    };
  }

  revalidateContractor(contractor.id);
  return { ok: true, name: contractor.business_name };
}

// --- resend requests --------------------------------------------------------

export type ResendRequestsResult =
  | { ok: true; sentTo: string; count: number }
  | { ok: false; error: string };

interface ResendRow {
  id: string;
  status: DocumentStatus;
  expiry_date: string | null;
  archived_at: string | null;
  replaces_document_id: string | null;
  document_type_id: string;
  document_types: { name: string } | null;
}

/**
 * Sends ONE email to the contractor covering the selected documents. Works on
 * ANY status: the company may want a fresh copy of something already approved.
 *
 * What it does to the data depends on the document (see planResend):
 *  - requested / rejected / already-submitted: nothing changes, the email goes.
 *  - approved (valid OR expired): a separate replacement row is added beside
 *    it. The approved document itself is never touched, so its status, expiry
 *    and file — and therefore the contractor's compliance — stay exactly as
 *    they were until the replacement is uploaded AND approved.
 *  - cancelled (revoked): reopened as a request.
 *
 * Those database changes run only once the cooldown is cleared and just before
 * the email goes, and are undone if the send then fails, so a blocked or
 * failed resend leaves nothing behind.
 *
 * The selection is checked against this contractor's own documents, built
 * server-side: an id belonging to another contractor or company, or to an
 * archived document, isn't in the set and the request is refused. Nothing the
 * client sends decides who is emailed or what the email says.
 *
 * The link in the email is the contractor's existing one, with its expiry
 * extended, and opens the checklist of everything currently outstanding — not
 * just the documents named. Rotating it would kill the link in every earlier
 * email they're still holding.
 */
export async function resendDocumentRequests(
  contractorId: string,
  documentIds: string[],
): Promise<ResendRequestsResult> {
  const company = await getCompany();
  if (!company) return { ok: false, error: SESSION_EXPIRED };
  const user = await getUser();

  if (typeof contractorId !== "string" || !contractorId) {
    return { ok: false, error: "Couldn't find that contractor." };
  }

  const supabase = await createClient();

  const { data: contractor } = await supabase
    .from("contractors")
    .select("id, business_name, contact_name, email")
    .eq("id", contractorId)
    .eq("company_id", company.id)
    .maybeSingle<{
      id: string;
      business_name: string;
      contact_name: string | null;
      email: string;
    }>();

  if (!contractor) return { ok: false, error: "Couldn't find that contractor." };

  const { data: docs, error: docsError } = await supabase
    .from("contractor_documents")
    .select(
      "id, status, expiry_date, archived_at, replaces_document_id, document_type_id, document_types(name)",
    )
    .eq("contractor_id", contractor.id)
    .is("archived_at", null);

  if (docsError) {
    console.error("resendDocumentRequests: document lookup failed", docsError);
    return { ok: false, error: "Couldn't load this contractor's documents. Try again." };
  }

  const rows = (docs ?? []) as unknown as ResendRow[];
  const byId = new Map(rows.map((r) => [r.id, r]));

  // A replacement row stands for the document it replaces: chasing the
  // replacement is chasing that requirement.
  const requested = Array.isArray(documentIds)
    ? documentIds.map((id) => {
        const r = typeof id === "string" ? byId.get(id) : undefined;
        return r?.replaces_document_id && byId.has(r.replaces_document_id)
          ? r.replaces_document_id
          : id;
      })
    : documentIds;

  const live = rows.filter(
    (r) => r.replaces_document_id === null || !byId.has(r.replaces_document_id),
  );

  const selection = selectResendable(
    requested,
    live.map((d) => d.id),
  );
  if (!selection.ok) return { ok: false, error: selection.error };

  const lifecycle: LifecycleRow[] = rows.map((r) => ({
    id: r.id,
    status: r.status,
    archived_at: r.archived_at,
    replaces_document_id: r.replaces_document_id,
  }));

  const now = new Date();
  const chosen = live.filter((d) => selection.ids.includes(d.id));
  const steps = planResend(
    chosen.map((d) => {
      const replacement = findReplacementRow(lifecycle, d.id);
      const days = d.expiry_date ? daysUntilExpiry(d.expiry_date, now) : null;
      return {
        id: d.id,
        status: d.status,
        expired: d.status === "approved" && days !== null && days < 0,
        replacement: replacement
          ? { id: replacement.id, status: replacement.status }
          : null,
      };
    }),
  );

  const nameOf = (id: string) => byId.get(id)?.document_types?.name ?? "Document";
  const namesFor = (bucket: "needed" | "refresh") =>
    steps
      .filter((s) => s.bucket === bucket)
      .map((s) => nameOf(s.docId))
      .sort((a, b) => a.localeCompare(b));

  // Applied only once the cooldown is cleared; undone if the send fails.
  const created: string[] = [];
  const reopened: { id: string; was: DocumentStatus }[] = [];

  const prepare = async (): Promise<{ ok: true } | { ok: false; message: string }> => {
    const fail = (what: string, error: unknown) => {
      console.error(`resendDocumentRequests: ${what}`, error);
      return { ok: false as const, message: "Couldn't prepare the request. Nothing was sent. Try again." };
    };

    for (const step of steps) {
      if (step.kind === "email_only") continue;

      if (step.kind === "reopen") {
        const was = byId.get(step.targetId)?.status ?? "revoked";
        const { error } = await supabase
          .from("contractor_documents")
          .update({ status: "requested", updated_at: now.toISOString() })
          .eq("id", step.targetId)
          .eq("contractor_id", contractor.id);
        if (error) return fail("reopen failed", error);
        reopened.push({ id: step.targetId, was });
        continue;
      }

      // create_replacement: a separate row beside the approved one.
      const original = byId.get(step.docId);
      if (!original) continue;
      const { data: inserted, error } = await supabase
        .from("contractor_documents")
        .insert({
          contractor_id: contractor.id,
          document_type_id: original.document_type_id,
          status: "requested",
          replaces_document_id: original.id,
        })
        .select("id")
        .single<{ id: string }>();
      if (error || !inserted) return fail("replacement insert failed", error);
      created.push(inserted.id);
    }
    return { ok: true };
  };

  const rollback = async () => {
    if (created.length > 0) {
      const { error } = await supabase
        .from("contractor_documents")
        .delete()
        .in("id", created)
        .eq("contractor_id", contractor.id);
      if (error) console.error("resendDocumentRequests: rollback delete failed", error);
    }
    for (const r of reopened) {
      const { error } = await supabase
        .from("contractor_documents")
        .update({ status: r.was })
        .eq("id", r.id)
        .eq("contractor_id", contractor.id);
      if (error) console.error("resendDocumentRequests: rollback reopen failed", error);
    }
  };

  const result = await sendRequestToContractor(supabase, {
    contractor,
    companyName: company.name,
    replyTo: user?.email ?? null,
    documentNames: namesFor("needed"),
    refreshDocumentNames: namesFor("refresh"),
    prepare,
  });

  if (!result.ok) {
    await rollback();
    return { ok: false, error: result.message };
  }

  // Reopening a cancelled request changes what's outstanding.
  if (reopened.length > 0) await recomputeContractorStatus(supabase, contractor.id);

  revalidateContractor(contractor.id);
  return { ok: true, sentTo: contractor.email, count: chosen.length };
}
