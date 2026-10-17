import type { Metadata } from "next";

import { AuthShell } from "@/app/components/auth-shell";

// The page itself is a client component, so its metadata lives here.
// Auth pages carry nothing worth indexing, so they're kept out of search.
export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Set a new password for your Subbies account.",
  robots: { index: false, follow: false },
};

/**
 * The auth frame is rendered here, on the server, rather than inside the
 * (client) page: the product panel is static, so as server HTML it costs no
 * JavaScript at all.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
