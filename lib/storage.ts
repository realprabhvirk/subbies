import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { CONTRACTOR_DOCS_BUCKET } from "@/lib/storage-constants";
import { collectAllPaths, batchPaths, type StorageLister } from "@/lib/storage-cleanup-logic";

export {
  CONTRACTOR_DOCS_BUCKET,
  MAX_UPLOAD_BYTES,
  ALLOWED_MIME_TYPES,
  isAllowedMimeType,
} from "@/lib/storage-constants";

const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heif",
};

function extensionForMime(mime: string): string {
  return EXT_BY_MIME[mime] ?? "bin";
}

/**
 * Storage path for a contractor document upload. Namespaced by company and
 * contractor so a signed URL can never be pointed at another company's tree.
 */
export function buildDocumentPath(params: {
  companyId: string;
  contractorId: string;
  contractorDocumentId: string;
  mime: string;
}): string {
  const ext = extensionForMime(params.mime);
  const unique = crypto.randomUUID();
  return `${params.companyId}/${params.contractorId}/${params.contractorDocumentId}/${unique}.${ext}`;
}

/** A one-time signed URL the contractor's browser can PUT the file to. */
export async function createSignedUpload(path: string) {
  const admin = createAdminClient();
  return admin.storage.from(CONTRACTOR_DOCS_BUCKET).createSignedUploadUrl(path);
}

/** A short-lived signed URL for viewing/downloading a stored document. */
export async function createSignedDownload(
  path: string,
  expiresInSeconds = 300,
) {
  const admin = createAdminClient();
  return admin.storage
    .from(CONTRACTOR_DOCS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
}

/** Returns the stored object's metadata, or null if it isn't there. */
export async function getObjectInfo(path: string) {
  const admin = createAdminClient();
  const lastSlash = path.lastIndexOf("/");
  const dir = path.slice(0, lastSlash);
  const name = path.slice(lastSlash + 1);

  const { data, error } = await admin.storage
    .from(CONTRACTOR_DOCS_BUCKET)
    .list(dir, { search: name, limit: 1 });

  if (error || !data || data.length === 0) return null;
  const match = data.find((f) => f.name === name);
  if (!match) return null;

  return {
    size: (match.metadata?.size as number | undefined) ?? null,
    mimetype: (match.metadata?.mimetype as string | undefined) ?? null,
  };
}

export async function deleteObject(path: string) {
  const admin = createAdminClient();
  return admin.storage.from(CONTRACTOR_DOCS_BUCKET).remove([path]);
}

const DELETE_BATCH_SIZE = 100;

export interface DeleteCompanyDocumentsResult {
  deletedCount: number;
  /** Any batches Storage failed to remove — surfaced for manual cleanup, never silently dropped. */
  failedPaths: string[];
}

type DocumentsBucket = ReturnType<
  ReturnType<typeof createAdminClient>["storage"]["from"]
>;

/** Removes `paths` in fixed-size batches, collecting whatever Storage refuses. */
async function removeInBatches(
  bucket: DocumentsBucket,
  paths: string[],
  context: Record<string, unknown>,
): Promise<DeleteCompanyDocumentsResult> {
  let deletedCount = 0;
  const failedPaths: string[] = [];

  for (const batch of batchPaths(paths, DELETE_BATCH_SIZE)) {
    const { error } = await bucket.remove(batch);
    if (error) {
      console.error("storage batch remove failed", {
        ...context,
        batchSize: batch.length,
        error,
      });
      failedPaths.push(...batch);
    } else {
      deletedCount += batch.length;
    }
  }

  return { deletedCount, failedPaths };
}

/**
 * Wipes every stored document under a company's tree on account deletion.
 *
 * Every document path starts with `${companyId}/` (see buildDocumentPath
 * above), so this recursively lists everything under that prefix and
 * removes it — rather than deleting only the paths contractor_documents
 * rows happen to point at, which would miss an orphaned upload (e.g. a
 * crashed confirm step that never wrote file_url). Postgres cascades handle
 * every database row on account deletion; nothing cascades Storage objects,
 * since storage.objects has no foreign key relationship to public.companies
 * at all — this is the one part of deletion that has to be done in code.
 *
 * Best-effort: a batch that fails to remove is collected and logged rather
 * than aborting the whole account deletion over it. Losing a stray file to
 * a transient Storage error is a manual-cleanup problem; leaving someone's
 * subscription cancelled with their account still dangling because of it
 * would be worse.
 */
export async function deleteAllCompanyDocuments(
  companyId: string,
): Promise<DeleteCompanyDocumentsResult> {
  const admin = createAdminClient();
  const bucket = admin.storage.from(CONTRACTOR_DOCS_BUCKET);

  const lister: StorageLister = {
    list: async (prefix) => {
      const { data, error } = await bucket.list(prefix, { limit: 1000 });
      return { data, error };
    },
  };

  const paths = await collectAllPaths(lister, companyId);
  if (paths.length === 0) return { deletedCount: 0, failedPaths: [] };

  return removeInBatches(bucket, paths, { companyId });
}

export interface DeleteContractorFilesResult extends DeleteCompanyDocumentsResult {
  /** The listing itself failed, so nothing can be said about what is or isn't stored. */
  listFailed: boolean;
}

/**
 * Removes every stored file under `prefix`, plus any `extraPaths` — strictly.
 *
 * Unlike the account-deletion wipe above, this one is strict, because its
 * callers delete database rows right after and must not do so unless the files
 * are really gone — the rows are the only record of which files belong to
 * whom, so deleting them first and failing on the files leaves dangling
 * objects nothing points at. Two differences follow:
 *
 *  - A failed *listing* is reported (`listFailed`), not swallowed.
 *    collectAllPaths treats a list error as "nothing here", which is a fine
 *    answer for a best-effort wipe and a dangerous one here: "couldn't look"
 *    would read as "nothing to delete", and the caller would carry on and
 *    orphan every file. The lister below throws instead, so the error
 *    surfaces rather than being quietly folded into an empty result.
 *  - The caller treats any `failedPaths` as a reason to stop.
 *
 * Walks the real tree rather than trusting the database's list of paths, so it
 * also catches uploads that never made it into a contractor_document_files
 * row. `extraPaths` covers the opposite gap: a path the database knows about
 * that doesn't sit under the prefix (it shouldn't happen, but "no orphaned
 * files" is not something to leave to "shouldn't").
 */
export async function deleteFilesUnderPrefix(
  prefix: string,
  extraPaths: string[] = [],
): Promise<DeleteContractorFilesResult> {
  const admin = createAdminClient();
  const bucket = admin.storage.from(CONTRACTOR_DOCS_BUCKET);

  const lister: StorageLister = {
    list: async (p) => {
      const { data, error } = await bucket.list(p, { limit: 1000 });
      if (error) throw error;
      return { data, error: null };
    },
  };

  let found: string[];
  try {
    found = await collectAllPaths(lister, prefix);
  } catch (error) {
    console.error("deleteFilesUnderPrefix: listing failed", { prefix, error });
    return { deletedCount: 0, failedPaths: [], listFailed: true };
  }

  const paths = [...new Set([...found, ...extraPaths.filter(Boolean)])];
  if (paths.length === 0) return { deletedCount: 0, failedPaths: [], listFailed: false };

  const result = await removeInBatches(bucket, paths, { prefix });
  return { ...result, listFailed: false };
}

/** Everything stored for ONE contractor: `${companyId}/${contractorId}/`. */
export async function deleteContractorFiles(
  companyId: string,
  contractorId: string,
): Promise<DeleteContractorFilesResult> {
  return deleteFilesUnderPrefix(`${companyId}/${contractorId}`);
}
