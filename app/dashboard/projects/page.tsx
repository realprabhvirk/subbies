import type { Metadata } from "next";

import { PlaceholderPage } from "../_components/placeholder-page";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <PlaceholderPage
      title="Projects"
      description="Track which contractors are working on which job, and confirm they're compliant before they're on site. Coming in this build."
    />
  );
}
