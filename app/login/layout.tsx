import type { Metadata } from "next";

// The page itself is a client component, so its metadata lives here.
// Auth pages carry nothing worth indexing, so they're kept out of search.
export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to Subbies to review and track your contractors' compliance documents.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
