import { Children, isValidElement, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { ButtonLink } from "@/app/components/button";
import { Band, Eyebrow, H1 } from "./ui";

/*
 * Shared frame for the legal pages. The pages keep their wording exactly;
 * this only supplies the title band, the table of contents (built from the
 * page's own LegalH2 headings, so it can't drift from them), the reading
 * column and the closing contact band.
 */

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function LegalH2({ children }: { children: ReactNode }) {
  return (
    <h2 id={slug(textOf(children))} className="scroll-mt-24 text-xl leading-tight sm:text-2xl">
      {children}
    </h2>
  );
}

export function LegalP({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-base leading-[1.7] text-ink sm:text-[17px]">{children}</p>;
}

export function LegalUL({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-[1.7] text-ink marker:text-ink-subtle sm:text-[17px]">
      {children}
    </ul>
  );
}

/** Every LegalH2 in the tree, in document order. */
function collectHeadings(node: ReactNode, out: string[]): string[] {
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { children?: ReactNode };
    if (child.type === LegalH2) {
      out.push(textOf(props.children));
      return;
    }
    collectHeadings(props.children, out);
  });
  return out;
}

function TocList({ headings }: { headings: string[] }) {
  return (
    <ol>
      {headings.map((h) => (
        <li key={h}>
          <a
            href={`#${slug(h)}`}
            className="flex min-h-11 items-center rounded-md py-1.5 text-[15px] leading-snug text-ink-muted transition-colors hover:text-brand"
          >
            {h}
          </a>
        </li>
      ))}
    </ol>
  );
}

export function LegalPage({
  title,
  updated,
  banner,
  children,
}: {
  title: string;
  updated: ReactNode;
  /** Shown above the title band, e.g. a "not in force" notice. */
  banner?: ReactNode;
  children: ReactNode;
}) {
  const headings = collectHeadings(children, []);
  return (
    <>
      {banner}
      <Band tone="deep" className="border-b border-line" innerClassName="py-12 sm:py-16">
        <Eyebrow>Legal</Eyebrow>
        <h1 className={`mt-4 ${H1}`}>{title}</h1>
        <p className="mt-4 font-mono text-sm text-ink-muted">{updated}</p>
      </Band>

      <Band tone="canvas" innerClassName="py-12 sm:py-16 lg:py-20">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16 xl:gap-24">
          <aside className="hidden lg:block">
            <nav aria-label="On this page" className="sticky top-24 max-h-[calc(100svh-8rem)] overflow-y-auto pr-2">
              <p className="label-caps mb-3 text-ink-muted">On this page</p>
              <TocList headings={headings} />
            </nav>
          </aside>

          <div className="min-w-0">
            <details data-toc className="group mb-10 rounded-card border border-line bg-surface lg:hidden">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-card px-5 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                On this page
                <ChevronDown
                  className="h-5 w-5 text-ink-muted transition-transform duration-[var(--duration-fast)] group-open:rotate-180 motion-reduce:transition-none"
                  strokeWidth={2.25}
                  aria-hidden
                />
              </summary>
              <nav aria-label="On this page" className="border-t border-line px-5 py-2">
                <TocList headings={headings} />
              </nav>
            </details>

            <article className="max-w-[70ch] text-[17px]">{children}</article>
          </div>
        </div>
      </Band>

      <Band tone="surface" className="border-t border-line" innerClassName="flex flex-col gap-6 py-12 sm:flex-row sm:items-center sm:justify-between lg:py-16">
        <div data-legal-chrome>
          <p className="font-display text-xl font-semibold sm:text-2xl">Questions about this page?</p>
        </div>
        <ButtonLink href="/contact" variant="primary" size="cta" className="w-full sm:w-auto">
          Contact us
        </ButtonLink>
      </Band>
    </>
  );
}
