import type { Metadata } from "next";

import { PlaceholderPage } from "../_components/placeholder-page";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PlaceholderPage
      title="Settings"
      description="Manage your company details and account preferences. Coming in a later build step."
    />
  );
}
