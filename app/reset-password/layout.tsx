import type { Metadata } from "next";

// The page itself is a client component, so its metadata lives here.
// Auth pages carry nothing worth indexing, so they're kept out of search.
export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Set a new password for your Subbies account.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
