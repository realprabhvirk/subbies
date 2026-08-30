import type { Metadata } from "next";
import {
  Send,
  Inbox,
  ClipboardCheck,
  CalendarClock,
  Check,
} from "lucide-react";

import { Section, Eyebrow, PrimaryLink, SecondaryLink, CtaBand } from "../_components/ui";

export const metadata: Metadata = {
  title: "How Subbies works",
  description:
    "A closer look at how Subbies collects, reviews, and tracks contractor compliance documents — and why contractors actually respond.",
};

const STEPS = [
  {
    icon: Send,
    title: "1. Onboard the contractor",
    lead: "Add their details once, pick the documents you need from your own list, and send.",
    points: [
      "Your document types are yours to define — Public Liability, trade licences, workers comp, site inductions, whatever you require.",
      "Each contractor gets a plain, professional email that looks like it came from your office, not a marketing tool.",
      "Need to chase? Resend the same request in one click.",
    ],
  },
  {
    icon: Inbox,
    title: "2. They upload — from anywhere",
    lead: "The contractor opens one secure link. No account, no password, no app.",
    points: [
      "They see a simple checklist of what's required and what's still outstanding.",
      "Photos from a phone or PDFs from a desktop both work. Files go straight to encrypted storage.",
      "The link stays valid, so they can finish later or come back when a document renews.",
    ],
  },
  {
    icon: ClipboardCheck,
    title: "3. You review and decide",
    lead: "Every submission lands in one place for you to check.",
    points: [
      "Open each file, set its expiry date (pre-filled from your default for that document type), and approve.",
      "Not right? Reject with a short reason. The contractor is emailed exactly what to fix and uploads a replacement against the same link.",
      "Once every required document is approved, the contractor's status becomes Approved automatically.",
    ],
  },
  {
    icon: CalendarClock,
    title: "4. Stay ahead of expiry",
    lead: "Onboarding is the start. Keeping records current is where it pays off.",
    points: [
      "Subbies reminds the contractor before a document expires, on the schedule you set.",
      "If they ignore the reminders, it escalates to you rather than letting it slip.",
      "Your dashboard always shows who's approved, who's expiring soon, and who needs attention.",
    ],
  },
];

const DIFFERENT = [
  {
    title: "Contractors don't have to sign up",
    body: "Every competing tool asks the contractor to create an account. That single step is where onboarding stalls. Subbies removes it entirely — one link, done.",
  },
  {
    title: "It's built around approval, not storage",
    body: "A shared drive holds files. Subbies tells you whether someone is actually cleared to work, and won't say yes until every document checks out.",
  },
  {
    title: "It connects to your jobs",
    body: "Assign contractors to a project and see, on one screen, whether everyone on that site is compliant right now.",
  },
];

const FAQ = [
  {
    q: "Do contractors need to create an account?",
    a: "No. They interact entirely through a secure emailed link. There's nothing for them to sign up for, download, or remember.",
  },
  {
    q: "What file types can they upload?",
    a: "PDF, JPG, PNG, and HEIC (iPhone photos), up to 15 MB per file.",
  },
  {
    q: "Where are the documents stored?",
    a: "In private, encrypted storage. Files are only ever accessed through short-lived signed links — they're never publicly reachable.",
  },
  {
    q: "Can I customise which documents I ask for?",
    a: "Yes. You define your own document types, each with its own default validity period and reminder schedule.",
  },
  {
    q: "What happens when a document expires?",
    a: "Subbies reminds the contractor ahead of time on your schedule, escalates to you if they don't respond, and reflects the lapse on your dashboard.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes — every plan starts with a free trial and you're not charged until it ends. You can cancel any time from your billing settings.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <Section className="pt-16 pb-12 sm:pt-24">
        <Eyebrow>How it works</Eyebrow>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          The paperwork problem, solved from both sides
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-ink-muted">
          You need a contractor to start work. They need to prove they&apos;re
          insured and licensed. Subbies makes that exchange fast for you and
          almost effortless for them — then keeps it current long after.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <PrimaryLink href="/signup">Get started</PrimaryLink>
          <SecondaryLink href="/pricing">See pricing</SecondaryLink>
        </div>
      </Section>

      <div className="border-y border-line bg-surface">
        <Section className="py-16">
          <h2 className="max-w-2xl text-2xl font-semibold sm:text-3xl">
            Why compliance paperwork drags
          </h2>
          <div className="mt-6 grid gap-6 text-ink-muted sm:grid-cols-2">
            <p>
              A contractor is meant to start Monday. On Friday you realise you
              still don&apos;t have their current insurance certificate. You
              email. You text. They send a photo of the wrong document. You email
              again. Monday comes and you&apos;re making a judgement call you
              shouldn&apos;t have to.
            </p>
            <p>
              Multiply that by every contractor, every renewal, every job. The
              information exists — it&apos;s just scattered across inboxes and
              phones with no single answer to the only question that matters:{" "}
              <span className="text-ink">is this person cleared to work?</span>
            </p>
          </div>
        </Section>
      </div>

      <Section className="py-16">
        <Eyebrow>The workflow</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-2xl font-semibold sm:text-3xl">
          Four steps, most of which you only touch once
        </h2>
        <div className="mt-10 space-y-10">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="grid gap-4 border-t border-line pt-8 sm:grid-cols-[auto_1fr] sm:gap-6"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-brand-tint text-brand-ink">
                  <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-ink-muted">{step.lead}</p>
                  <ul className="mt-4 space-y-2">
                    {step.points.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm">
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-approved"
                          strokeWidth={2.5}
                          aria-hidden
                        />
                        <span className="text-ink-muted">{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <div className="border-y border-line bg-surface">
        <Section className="py-16">
          <Eyebrow>What makes it different</Eyebrow>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {DIFFERENT.map((d) => (
              <div key={d.title}>
                <h3 className="text-base font-semibold">{d.title}</h3>
                <p className="mt-2 text-sm text-ink-muted">{d.body}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section className="py-16">
        <Eyebrow>Questions</Eyebrow>
        <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
          Frequently asked
        </h2>
        <dl className="mt-8 divide-y divide-line border-y border-line">
          {FAQ.map((item) => (
            <div key={item.q} className="py-5">
              <dt className="text-base font-semibold">{item.q}</dt>
              <dd className="mt-2 text-sm text-ink-muted">{item.a}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <CtaBand
        heading="See it with your own documents"
        sub="Create an account, add one contractor, and send a real onboarding request in a few minutes."
      />
    </>
  );
}
