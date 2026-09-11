/**
 * Groups a flat list of contractor_document_files rows by which document
 * requirement each belongs to. Pure — no I/O — specifically so the two
 * places that need it (the company's review page and the contractor's
 * onboarding checklist) share one implementation instead of two hand-copied
 * loops that could drift, and so it's testable without a live database.
 */
export interface GroupableFile {
  id: string;
  file_name: string | null;
  contractor_document_id: string;
}

export interface GroupedFile {
  id: string;
  fileName: string | null;
}

export function groupFilesByDocument(
  files: GroupableFile[],
): Map<string, GroupedFile[]> {
  const byDoc = new Map<string, GroupedFile[]>();
  for (const f of files) {
    const list = byDoc.get(f.contractor_document_id) ?? [];
    list.push({ id: f.id, fileName: f.file_name });
    byDoc.set(f.contractor_document_id, list);
  }
  return byDoc;
}
