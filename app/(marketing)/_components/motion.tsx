"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/*
 * Marketing motion, no dependencies. CSS (globals.css, "Marketing motion")
 * does the animating; these components only flip data attributes.
 * Content is never hidden without JS or with reduced motion: the hidden
 * start state only applies under `scripting: enabled` and no-preference.
 */

type Anim = "up" | "scale" | "left" | "right" | "fade";

/** Fades/slides its children in the first time they scroll into view. */
export function InView({
  children,
  anim = "up",
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  anim?: Anim;
  /** ms, for staggering siblings. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      el.dataset.in = "";
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.in = "";
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} data-anim={anim} style={{ "--anim-delay": `${delay}ms` } as CSSProperties} className={className}>
      {children}
    </div>
  );
}

export interface StoryStep {
  title: string;
  body: ReactNode;
  visual: ReactNode;
}

/**
 * Pinned scroll story. On desktop the visual sits in a sticky stage and
 * swaps as each step reaches the middle of the screen; the step text
 * scrolls past beside it. On a phone each step simply shows its own visual.
 */
export function StoryScroller({ steps }: { steps: StoryStep[] }) {
  const [active, setActive] = useState(0);
  const items = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const el of items.current) if (el) io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-20">
      <div aria-hidden className="hidden lg:block">
        <div className="sticky top-24 h-[min(36rem,calc(100svh-8rem))]">
          <div className="story-stage relative h-full overflow-hidden rounded-[28px] border border-line bg-surface-muted">
            {steps.map((s, i) => (
              <div
                key={s.title}
                data-state={i === active ? "on" : i < active ? "past" : "next"}
                className="story-frame absolute inset-0 flex items-center justify-center p-8"
              >
                <div className="w-full max-w-md">{s.visual}</div>
              </div>
            ))}
            <div className="absolute bottom-6 left-6 flex items-center gap-1.5">
              {steps.map((s, i) => (
                <span
                  key={s.title}
                  className={`h-1.5 rounded-full transition-all duration-500 ${i === active ? "w-8 bg-brand" : "w-3 bg-line-strong"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <ol>
        {steps.map((s, i) => (
          <li
            key={s.title}
            data-step={i}
            ref={(el) => {
              items.current[i] = el;
            }}
            className="flex flex-col justify-center py-10 first:pt-6 lg:min-h-[70svh] lg:py-0"
          >
            <div className={`transition-opacity duration-500 ${i === active ? "" : "lg:opacity-35"}`}>
              <span className="font-mono text-sm text-brand">0{i + 1}</span>
              <h3 className="mt-3 text-2xl leading-tight sm:text-[2rem]">{s.title}</h3>
              <div className="mt-3 max-w-[36ch] text-lg text-ink-muted">{s.body}</div>
            </div>
            <InView anim="scale" className="mt-8 lg:hidden">
              <div aria-hidden className="story-stage rounded-[24px] border border-line bg-surface-muted px-5 py-8">
                <div className="mx-auto w-full max-w-sm">{s.visual}</div>
              </div>
            </InView>
          </li>
        ))}
      </ol>
    </div>
  );
}
