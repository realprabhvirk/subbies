/**
 * Does this storage path belong to this company?
 *
 * Every contractor document is stored at
 * `{companyId}/{contractorId}/{documentId}/{uuid}.{ext}` (see
 * buildDocumentPath in lib/storage.ts). The path is saved in the database
 * (contractor_document_files.file_path, and the legacy
 * contractor_documents.file_url), and the server later signs, lists or
 * deletes it with the service-role key, which ignores storage permissions.
 *
 * Owning the database ROW is not the same as owning the FILE: a company can
 * write any text it likes into file_path on a row it owns. So before the
 * service role acts on a path, it has to be checked against the company the
 * row belongs to. That's this function.
 *
 * Deliberately strict, and only answers "is this inside this company's
 * folder" — it does not try to repair or normalise a suspicious path:
 *   - companyId must be a real UUID (so it can't be "" or "*", and so the
 *     prefix can't be shortened into a match for another company)
 *   - the first path segment must equal the companyId exactly, with
 *     something after it
 *   - no empty, "." or ".." segments (no "a//b", no "./", no "../")
 *   - no leading "/" (absolute), no backslashes, no "%" (URL-encoded
 *     tricks such as %2e%2e or %2f), no control characters
 *
 * Pure and dependency-free so it runs under plain `node --test` and can be
 * imported anywhere.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CONTROL_RE = /[\u0000-\u001f\u007f]/;

/** A company id is a UUID. Anything else is never a usable storage prefix. */
export function isValidCompanyId(companyId: unknown): companyId is string {
  return typeof companyId === "string" && UUID_RE.test(companyId);
}

export function isPathOwnedByCompany(
  filePath: unknown,
  companyId: unknown,
): boolean {
  if (typeof filePath !== "string" || !isValidCompanyId(companyId)) return false;
  if (filePath.length === 0 || filePath.length > 1024) return false;

  if (filePath.startsWith("/")) return false;
  if (filePath.includes("\\")) return false;
  if (filePath.includes("%")) return false;
  if (CONTROL_RE.test(filePath)) return false;

  const segments = filePath.split("/");
  if (segments.length < 2) return false;
  if (segments.some((s) => s === "" || s === "." || s === "..")) return false;

  return segments[0] === companyId;
}

/**
 * Splits paths into the ones that belong to `companyId` and the ones that
 * don't. Used where a list of paths from the database is about to be deleted:
 * the foreign ones are dropped (and should be logged by the caller), never
 * acted on.
 */
export function partitionOwnedPaths(
  paths: readonly unknown[],
  companyId: string,
): { owned: string[]; refused: string[] } {
  const owned: string[] = [];
  const refused: string[] = [];
  for (const p of paths) {
    if (typeof p !== "string" || p === "") continue;
    if (isPathOwnedByCompany(p, companyId)) owned.push(p);
    else refused.push(p);
  }
  return { owned, refused };
}
