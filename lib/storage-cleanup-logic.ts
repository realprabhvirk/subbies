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
  const { data, error } = await lister.list(prefix);
  if (error || !data) return [];

  const paths: string[] = [];
  for (const entry of data) {
    const fullPath = `${prefix}/${entry.name}`;
    if (entry.id === null) {
      // A folder — recurse rather than collect.
      paths.push(...(await collectAllPaths(lister, fullPath)));
    } else {
      paths.push(fullPath);
    }
  }
  return paths;
}

/** Splits a flat list of paths into fixed-size batches, preserving order. */
export function batchPaths(paths: string[], batchSize: number): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < paths.length; i += batchSize) {
    batches.push(paths.slice(i, i + batchSize));
  }
  return batches;
}
