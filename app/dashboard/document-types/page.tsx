import type { Metadata } from "next";

import { PlaceholderPage } from "../_components/placeholder-page";

export const metadata: Metadata = { title: "Document types" };

export default function DocumentTypesPage() {
  return (
    <PlaceholderPage
      title="Document types"
      description="Define the compliance documents you collect from contractors — name, how long each stays valid, and when to send reminders. Coming next."
    />
  );
}
