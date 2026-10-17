import type { Metadata } from "next";
import { Check, X } from "lucide-react";

import {
  Section,
  SectionHead,
  Eyebrow,
  PrimaryLink,
  SecondaryLink,
  CtaBand,
  Reveal,
} from "../_components/ui";
import { UploadPreview } from "../_components/upload-preview";
import { ReminderPreview } from "../_components/reminder-preview";

export const metadata: Metadata = {
  title: "How Subbies works",
  description:
    "A closer look at how Subbies collects, reviews, and tracks contractor compliance documents, and why contractors actually respond.",
};

const STEPS = [
  {
    title: "Onboard the contractor",
    lead: "Add their details once, pick the documents you need from your own list, and send.",
    points: [
      "Your document types are yours to define: Public Liability, trade licences, workers comp, site inductions, whatever you require.",
      "Each contractor gets a plain, professional email that looks like it came from your office, not a marketing tool.",
      "Need to chase? Resend the same request in one click.",
    ],
  },
  {
    title: "They upload from anywhere",
    lead: "The contractor opens one secure link. No account, no password, no app.",
    points: [
      "They see a simple checklist of what's required and what's still outstanding.",
      "Photos from a phone or PDFs from a desktop both work. Files go straight to encrypted storage.",
      "The link stays valid, so they can finish later or come back when a document renews.",
    ],
  },
  {
    title: "You review and decide",
    lead: "Every submission lands in one place for you to check.",
    points: [
      "Open each file, set its expiry date (pre-filled from your default for that document type), and approve.",
      "Not right? Reject with a short reason. The contractor is emailed exactly what to fix and uploads a replacement against the same link.",
      "Once every required document is approved, the contractor's status becomes Approved automatically.",
    ],
  },
  {
    title: "Stay ahead of expiry",
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
    body: "Asking a contractor to create an account is the step where onboarding stalls. Subbies removes it entirely. One link, done.",
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
    a: "In private, encrypted storage. Files are only ever accessed through short-lived signed links. They're never publicly reachable.",
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
    a: "Yes. Every plan starts with a free trial and you're not charged until it ends. You can cancel any time from your billing settings.",
  },
];

/** A static review decision bar — the step-3 visual. Example data. */
function ReviewPreview() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface text-left shadow-lg">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Public liability insurance</p>
          <p className="mt-0.5 truncate font-mono text-2xs text-ink-muted">
            certificate-of-currency.pdf
          </p>
        </div>
        <span className="rounded-sm border border-review-line bg-review-bg px-1.5 py-0.5 text-2xs font-semibold text-review">
          Awaiting review
        </span>
      </div>
      <div className="mx-4 mb-4 rounded-md border border-review-line bg-review-bg/40 p-3">
        <p className="label-caps text-review">Your review</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <p className="text-2xs font-semibold">Expiry date</p>
            <p className="mt-1 flex h-9 w-32 items-center rounded-md border border-field-line bg-surface px-2.5 font-mono text-xs">
              30/06/2027
            </p>
          </div>
          <span className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-semibold text-white">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            Approve
          </span>
          <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-xs font-semibold">
            <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            Reject
          </span>
        </div>
      </div>
    </div>
  );
}

const VISUALS = [null, <UploadPreview key="u" />, <ReviewPreview key="r" />, <ReminderPreview key="m" />];

export default function HowItWorksPage() {
  return (
    <>
      <Section className="grid gap-12 pb-16 pt-14 sm:pt-20 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end lg:pb-20">
        <div>
          <Eyebrow>How it works</Eyebrow>
          <h1 className="mt-5 text-4xl leading-[1] tracking-display sm:text-6xl">
            The paperwork problem, solved from both sides.
          </h1>
          <p className="mt-6 max-w-2xl text-base text-ink-muted sm:text-lg">
            You need a contractor to start work. They need to prove they&apos;re
            insured and licensed. Subbies makes that exchange fast for you and
            almost effortless for them, then keeps it current long after.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <PrimaryLink href="/signup">Get started</PrimaryLink>
            <SecondaryLink href="/pricing">See pricing</SecondaryLink>
          </div>
        </div>
        <nav aria-label="On this page" className="border-t border-ink">
          <ol className="divide-y divide-line">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <a
                  href={`#step-${i + 1}`}
                  className="group flex min-h-12 items-center gap-4 py-2 text-sm font-semibold transition-colors hover:text-brand"
                >
                  <span className="font-mono text-xs font-normal text-ink-muted">0{i + 1}</span>
                  {step.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </Section>

      <div className="border-y border-line bg-surface">
        <Section className="grid gap-8 py-section lg:grid-cols-2 lg:gap-16">
          <SectionHead label="The problem" title="Why compliance paperwork drags." />
          <div className="space-y-4 text-base text-ink-muted lg:pt-12">
            <p>
              A contractor is meant to start Monday. On Friday you realise you
              still don&apos;t have their current insurance certificate. You
              email. You text. They send a photo of the wrong document. You email
              again. Monday comes and you&apos;re making a judgement call you
              shouldn&apos;t have to.
            </p>
            <p>
              Multiply that by every contractor, every renewal, every job. The
              information exists. It&apos;s just scattered across inboxes and
              phones with no single answer to the only question that matters:{" "}
              <span className="font-semibold text-ink">is this person cleared to work?</span>
            </p>
          </div>
        </Section>
      </div>

      <Section className="py-section">
        <SectionHead
          label="The workflow"
          title="Four steps, most of which you only touch once."
        />
        <div className="mt-14 border-t border-ink">
          {STEPS.map((step, i) => (
            <Reveal key={step.title}>
              <div
                id={`step-${i + 1}`}
                className="grid scroll-mt-24 gap-8 border-b border-line py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16"
              >
                <div>
                  <span className="figure text-5xl text-line-strong">0{i + 1}</span>
                  <h3 className="mt-5 text-2xl sm:text-3xl">{step.title}</h3>
                  <p className="mt-3 max-w-lg text-base text-ink-muted">{step.lead}</p>
                  <ul className="mt-6 max-w-lg divide-y divide-line border-y border-line">
                    {step.points.map((p) => (
                      <li key={p} className="flex items-start gap-2.5 py-3 text-sm">
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-approved"
                          strokeWidth={2.5}
                          aria-hidden
                        />
                        <span className="text-ink">{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {VISUALS[i] && (
                  <div aria-hidden className="mx-auto w-full max-w-md self-center">
                    {VISUALS[i]}
                  </div>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <div className="border-y border-line bg-surface">
        <Section className="py-section">
          <SectionHead label="What makes it different" title="Built for one job, done properly." />
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {DIFFERENT.map((d, i) => (
              <div key={d.title} className="border-t-2 border-ink pt-5">
                <span className="font-mono text-xs text-ink-subtle">0{i + 1}</span>
                <h3 className="mt-2 text-lg">{d.title}</h3>
                <p className="mt-2 text-sm text-ink-muted">{d.body}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section className="grid gap-10 py-section lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <SectionHead label="Questions" title="Frequently asked." />
        <dl className="divide-y divide-line border-y border-line">
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
