import Link from "next/link";
import Image from "next/image";

import { Logo } from "@/app/components/logo";

/**
 * The shared frame for login, signup, the password screens and plan selection.
 *
 * Form on the left on cream; on desktop, a dark photo panel on the right with
 * the logo and the tagline. On a phone the panel is dropped entirely: the form
 * is the job, and the logo sits above it instead.
 *
 * `wide` is for pages that need room (plan selection's three cards): the panel
 * only appears from 1280px up and is narrower, and the page supplies its own
 * header and footer.
 */
export function AuthShell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <main
      className={
        wide
          ? "min-h-screen xl:grid xl:grid-cols-[minmax(0,1fr)_26rem]"
          : "min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
      }
    >
      {wide ? (
        <div className="min-w-0">{children}</div>
      ) : (
        <div className="flex min-h-screen flex-col px-(--page-padding) py-6 sm:px-10 lg:py-8">
          <header className="lg:hidden">
            <Link href="/" prefetch={false} aria-label="Subbies home" className="inline-block rounded-md">
              <Logo height={32} priority />
            </Link>
          </header>

          <div className="flex flex-1 items-center justify-center py-12">
            <div className="w-full max-w-md">{children}</div>
          </div>

          <footer className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
            <span>© {new Date().getFullYear()} Subbies</span>
            {/* prefetch off: these are rarely visited from here, and
                prefetching them would pull marketing-route code into every
                auth page load. */}
            <Link href="/privacy" prefetch={false} className="hover:text-ink hover:underline">
              Privacy
            </Link>
            <Link href="/terms" prefetch={false} className="hover:text-ink hover:underline">
              Terms
            </Link>
            <Link href="/contact" prefetch={false} className="hover:text-ink hover:underline">
              Contact
            </Link>
          </footer>
        </div>
      )}

      <PhotoPanel wide={wide} />
    </main>
  );
}

/** Decorative: an existing optimised photo under a dark wash, the logo, the tagline. */
function PhotoPanel({ wide }: { wide: boolean }) {
  return (
    <aside
      data-surface="sidebar"
      className={`relative hidden overflow-hidden bg-sidebar-bg ${wide ? "xl:block" : "lg:block"}`}
    >
      <Image
        src="/marketing/hero-construction.webp"
        alt=""
        fill
        sizes={wide ? "(min-width: 1280px) 26rem, 1px" : "(min-width: 1024px) 52vw, 1px"}
        className="object-cover object-[65%_center]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-sidebar-bg/80 via-sidebar-bg/25 to-sidebar-bg/90"
      />
      <div className="relative flex h-full min-h-screen flex-col justify-between p-10 xl:p-14">
        <Link href="/" prefetch={false} aria-label="Subbies home" className="self-start rounded-md">
          <Logo tone="inverse" height={40} />
        </Link>
        <p className="max-w-md font-display text-4xl font-bold leading-[1.08] tracking-display text-sidebar-ink xl:text-5xl">
          Compliance builds progress.
        </p>
      </div>
    </aside>
  );
}
