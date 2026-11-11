import { Camera } from "lucide-react";

import { SectionCard } from "@/app/components/section-card";
import type { PhotoView } from "../_lib/photos";
import { PhotoGrid } from "./photo-grid";

export function PhotosCard({ projectId, photos }: { projectId: string; photos: PhotoView[] }) {
  return (
    <SectionCard id="photos" icon={Camera} tone="neutral" title="Jobsite photos">
      <PhotoGrid projectId={projectId} photos={photos} />
    </SectionCard>
  );
}
