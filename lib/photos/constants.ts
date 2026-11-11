export const PROJECT_PHOTOS_BUCKET = "project-photos";

/** {company_id}/{project_id}/{uuid}.webp and -thumb.webp. */
export function photoPaths(companyId: string, projectId: string, id: string) {
  return {
    full: `${companyId}/${projectId}/${id}.webp`,
    thumb: `${companyId}/${projectId}/${id}-thumb.webp`,
  };
}
