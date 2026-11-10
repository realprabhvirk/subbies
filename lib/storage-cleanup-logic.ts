/**
 * Pure recursive-listing algorithm for wiping a company's stored documents —
 * no Supabase client, no "server-only", so it's directly unit-testable.
 *
 * Split out for the same reason as deletion-code-logic.ts and
 * trial-eligibility-policy.ts: the real caller (lib/storage.ts) imports
 * "server-only" (it touches the service-role Storage client), and
 * "server-only" only resolves inside Next's webpack build — it crashes a
 * plain `node --test` process, which is how this repo's tests run.
 */

/** The minimal shape of a Supabase Storage `list()` entry this needs. */
export interface StorageListEntry {
  name: string;
  /** null for a folder, a real id for a file — this is the only signal Storage gives. */
  id: string | null;
  /** When the object was stored. Folders have none. */
  created_at?: string | null;
}

/** One stored file: its full path and when it was stored. */
export interface StoredObject {
  path: string;
  createdAt: string | null;
}

/** The minimal Storage surface this algorithm depends on — easy to fake in tests. */
export interface StorageLister {
  list(prefix: string): Promise<{ data: StorageListEntry[] | null; error: unknown }>;
}

/**
 * Recursively collects the full path of every FILE under `prefix`, walking
 * into every FOLDER it finds along the way.
 *
 * Deliberately doesn't hardcode the 3-level companyId/contractorId/documentId
 * shape that buildDocumentPath() currently produces (see lib/storage.ts) —
 * it walks however deep the tree actually is, so it can't silently miss a
 * level if that shape ever changes, and it catches orphaned files with no
 * matching database row (a crashed upload, a bug elsewhere) that a
 * DB-driven "delete what contractor_documents.file_url points to" approach
 * would miss entirely.
 */
export async function collectAllPaths(
  lister: StorageLister,
  prefix: string,
): Promise<string[]> {
  return (await collectAllObjects(lister, prefix)).map((o) => o.path);
}

/**
 * The same walk as collectAllPaths, keeping each file's stored time. An empty
 * prefix walks the whole bucket.
 */
export async function collectAllObjects(
  lister: StorageLister,
  prefix: string,
): Promise<StoredObject[]> {
  const { data, error } = await lister.list(prefix);
  if (error || !data) return [];

  const objects: StoredObject[] = [];
  for (const entry of data) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      // A folder — recurse rather than collect.
      objects.push(...(await collectAllObjects(lister, fullPath)));
    } else {
      objects.push({ path: fullPath, createdAt: entry.created_at ?? null });
    }
  }
  return objects;
}

// ---------------------------------------------------------------------------
// Uploads that were never submitted (M1)

/**
 * The most files that may sit under one document's folder without having been
 * submitted. Matches the most files one submission can carry, so a full batch
 * always fits, but a link can't be used as free storage.
 */
export const MAX_PENDING_UPLOADS_PER_DOCUMENT = 10;

/**
 * A pending upload older than this is a failed attempt (a batch uploads and
 * submits within seconds), so it can be cleared to make room for a retry.
 */
export const STALE_PENDING_UPLOAD_MS = 10 * 60 * 1000;

/** The orphan sweep only touches files at least this old. */
export const ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000;

/** Stored files no database row points at. */
export function unregisteredObjects(
  objects: StoredObject[],
  registeredPaths: Iterable<string | null | undefined>,
): StoredObject[] {
  const registered = new Set<string>();
  for (const p of registeredPaths) if (p) registered.add(p);
  return objects.filter((o) => !registered.has(o.path));
}

/**
 * Files stored more than `minAgeMs` ago. A file with no (or an unreadable)
 * stored time is never treated as old: when in doubt, keep it.
 */
export function olderThan(objects: StoredObject[], nowMs: number, minAgeMs: number): StoredObject[] {
  return objects.filter((o) => {
    if (!o.createdAt) return false;
    const t = Date.parse(o.createdAt);
    return Number.isFinite(t) && t <= nowMs - minAgeMs;
  });
}

/** Unregistered files old enough for the orphan sweep to delete. */
export function orphanObjects(
  objects: StoredObject[],
  registeredPaths: Iterable<string | null | undefined>,
  nowMs: number,
  minAgeMs: number = ORPHAN_MIN_AGE_MS,
): StoredObject[] {
  return olderThan(unregisteredObjects(objects, registeredPaths), nowMs, minAgeMs);
}

/** Splits a flat list of paths into fixed-size batches, preserving order. */
export function batchPaths(paths: string[], batchSize: number): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < paths.length; i += batchSize) {
    batches.push(paths.slice(i, i + batchSize));
  }
  return batches;
}
