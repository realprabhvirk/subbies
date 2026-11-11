import type { Metadata } from "next";
import { Check, Send, X } from "lucide-react";

import {
  Band,
  Section,
  SectionHead,
  Eyebrow,
  PrimaryLink,
  SecondaryLink,
  CtaBand,
  FaqList,
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
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="font-mono text-2xs text-ink-subtle">Example</span>
          <span className="rounded-sm border border-review-line bg-review-bg px-1.5 py-0.5 text-2xs font-semibold text-review">
            Awaiting review
          </span>
        </div>
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

/** The step-1 visual: an onboarding request about to be sent. Example data. */
const REQUEST_DOCS = [
  { name: "Public liability insurance", on: true },
  { name: "Electrical licence", on: true },
  { name: "Workers' compensation", on: true },
  { name: "Site induction", on: false },
];

function RequestPreview() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface text-left shadow-lg">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <p className="text-sm font-semibold">New onboarding request</p>
        <span className="font-mono text-2xs text-ink-subtle">Example</span>
      </div>
      <div className="space-y-3 px-4 py-4">
        <div>
          <p className="text-2xs font-semibold">Contractor</p>
          <p className="mt-1 flex h-9 items-center rounded-md border border-field-line bg-surface px-2.5 text-xs">
            Dave&apos;s Electrical
          </p>
        </div>
        <div>
          <p className="text-2xs font-semibold">Documents to request</p>
          <ul className="mt-1.5 divide-y divide-line rounded-md border border-line">
            {REQUEST_DOCS.map((d) => (
              <li key={d.name} className="flex items-center gap-2.5 px-2.5 py-2 text-xs">
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${
                    d.on ? "border-brand bg-brand text-white" : "border-field-line bg-surface"
                  }`}
                >
                  {d.on && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className={d.on ? "" : "text-ink-muted"}>{d.name}</span>
              </li>
            ))}
          </ul>
        </div>
        <span className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-brand text-xs font-semibold text-white">
          <Send className="h-3.5 w-3.5" strokeWidth={2.25} />
          Send onboarding request
        </span>
      </div>
    </div>
  );
}

const VISUALS = [
  <RequestPreview key="q" />,
  <UploadPreview key="u" />,
  <ReviewPreview key="r" />,
  <ReminderPreview key="m" />,
];

export default function HowItWorksPage() {
  return (
    <>
      <Section className="grid gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end lg:gap-20 lg:py-28">
        <div>
          <Eyebrow>How it works</Eyebrow>
          <h1 className="mt-5 max-w-[16ch] text-[2.6rem] leading-[0.98] tracking-display sm:text-6xl xl:text-[4.5rem]">
            The paperwork problem, solved from both sides.
          </h1>
          <p className="mt-7 max-w-[40rem] text-lg text-ink-muted sm:text-xl xl:text-[1.375rem] xl:leading-[1.5]">
            You need a contractor to start work. They need to prove they&apos;re
            insured and licensed. Subbies makes that exchange fast for you and
            almost effortless for them, then keeps it current long after.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <PrimaryLink href="/signup">Get started</PrimaryLink>
            <SecondaryLink href="/pricing">See pricing</SecondaryLink>
          </div>
        </div>
        <nav aria-label="On this page" className="border-t-2 border-ink">
          <ol className="divide-y divide-line">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <a
                  href={`#step-${i + 1}`}
                  className="group flex min-h-16 items-center gap-5 py-3 text-lg font-semibold transition-colors hover:text-brand sm:text-xl"
                >
                  <span className="font-mono text-sm font-normal text-ink-muted">0{i + 1}</span>
                  {step.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </Section>

      <Band tone="surface" bordered innerClassName="grid gap-8 py-section lg:grid-cols-2 lg:gap-20">
        <SectionHead label="The problem" title="Why compliance paperwork drags." />
        <div className="max-w-[62ch] space-y-5 text-lg text-ink-muted sm:text-xl lg:pt-12">
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
      </Band>

      <Band tone="canvas" innerClassName="py-section">
        <SectionHead
          label="The workflow"
          title="Four steps, most of which you only touch once."
        />
        {/* Full-row steps on a numbered rail; the visual alternates sides on
            desktop and sits under the text on a phone. */}
        <ol className="mt-16 lg:mt-20">
          {STEPS.map((step, i) => {
            const last = i === STEPS.length - 1;
            return (
              <li
                key={step.title}
                id={`step-${i + 1}`}
                className="grid scroll-mt-28 grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-x-8"
              >
                <div className="relative flex justify-center">
                  <span className="figure relative z-10 flex h-11 w-11 items-center justify-center rounded-full border-2 border-brand bg-canvas text-base text-brand sm:h-16 sm:w-16 sm:text-2xl">
                    0{i + 1}
                  </span>
                  {!last && (
                    <span aria-hidden className="absolute bottom-0 top-11 w-0.5 bg-line-strong sm:top-16" />
                  )}
                </div>
                <Reveal
                  className={`grid grid-cols-[minmax(0,1fr)] items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20 ${last ? "" : "pb-20 lg:pb-28"}`}
                >
                  <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                    <h3 className="pt-1.5 text-[1.75rem] leading-tight sm:pt-3 sm:text-4xl">{step.title}</h3>
                    <p className="mt-4 max-w-[62ch] text-lg text-ink-muted sm:text-xl">{step.lead}</p>
                    <ul className="mt-7 max-w-[62ch] divide-y divide-line border-y border-line">
                      {step.points.map((p) => (
                        <li key={p} className="flex items-start gap-3 py-3.5 text-base sm:text-lg">
                          <Check
                            className="mt-1 h-5 w-5 shrink-0 text-brand"
                            strokeWidth={2.5}
                            aria-hidden
                          />
                          <span className="text-ink">{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div
                    aria-hidden
                    className={`mx-auto w-full max-w-md lg:[zoom:1.1] xl:[zoom:1.2] ${i % 2 === 1 ? "lg:order-1" : ""}`}
                  >
                    {VISUALS[i]}
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </Band>

      <Band tone="deep" bordered innerClassName="py-section">
        <SectionHead label="What makes it different" title="Built for one job, done properly." />
        <div className="mt-14 grid gap-10 sm:grid-cols-3 lg:gap-14">
          {DIFFERENT.map((d, i) => (
            <div key={d.title} className="border-t-2 border-ink pt-6">
              <span className="font-mono text-sm text-ink-subtle">0{i + 1}</span>
              <h3 className="mt-3 text-2xl leading-tight">{d.title}</h3>
              <p className="mt-3 text-lg text-ink-muted">{d.body}</p>
            </div>
          ))}
        </div>
      </Band>

      <Band tone="canvas" innerClassName="grid gap-10 py-section lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
        <SectionHead label="Questions" title="Frequently asked." />
        <FaqList items={FAQ} />
      </Band>

      <CtaBand
        heading="See it with your own documents"
        sub="Create an account, add one contractor, and send a real onboarding request in a few minutes."
      />
    </>
  );
}
