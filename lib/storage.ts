import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { CONTRACTOR_DOCS_BUCKET } from "@/lib/storage-constants";

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
