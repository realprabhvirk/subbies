import type { Metadata } from "next";

import { PlaceholderPage } from "../_components/placeholder-page";

export const metadata: Metadata = { title: "Contractors" };

export default function ContractorsPage() {
  return (
    <PlaceholderPage
      title="Contractors"
      description="Add contractors, request compliance documents, and track their approval status. Coming in the next build step."
    />
  );
}
