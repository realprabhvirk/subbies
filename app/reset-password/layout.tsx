import { AuthShell } from "@/app/components/auth-shell";

/**
 * The auth frame is rendered here, on the server, rather than inside the
 * (client) page: the product panel is static, so as server HTML it costs no
 * JavaScript at all.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
