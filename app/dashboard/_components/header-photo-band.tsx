import Image from "next/image";

/**
 * The decorative photo at the top right of the dashboard header: an existing
 * optimised asset (the homepage hero), faded into the cream canvas on its left
 * and bottom edges with a mask. It is a photo fade, not a gradient ornament:
 * mask-image removes the photo's own pixels rather than painting colour over
 * them, so it stays right if the canvas colour ever changes.
 *
 * Decorative (empty alt, aria-hidden), out of the way of the heading (it starts
 * about half way across) and hidden below 768px, where the header needs the
 * whole width.
 */
export function HeaderPhotoBand() {
  const mask =
    "linear-gradient(to right, transparent 0%, #000 55%), linear-gradient(to bottom, #000 55%, transparent 100%)";
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -top-8 right-[calc(var(--page-padding)*-1)] bottom-[-3.5rem] -z-10 hidden w-[46%] overflow-hidden md:block"
      style={{
        maskImage: mask,
        WebkitMaskImage: mask,
        maskComposite: "intersect",
        WebkitMaskComposite: "source-in",
      }}
    >
      <Image
        src="/marketing/hero-construction.webp"
        alt=""
        fill
        priority
        sizes="(min-width: 768px) 46vw, 1px"
        className="object-cover object-[60%_35%]"
      />
    </div>
  );
}
