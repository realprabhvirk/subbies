/** Shared storage constants — safe to import in client components. */

export const CONTRACTOR_DOCS_BUCKET = "contractor-documents";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB — matches the bucket

/** Accepted upload types. Mirrors the bucket's allowed_mime_types. */
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
] as const;

/** For an <input type="file"> accept attribute. */
export const UPLOAD_ACCEPT_ATTR =
  ".pdf,.jpg,.jpeg,.png,.heic,.heif,application/pdf,image/jpeg,image/png,image/heic,image/heif";

export function isAllowedMimeType(mime: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}
