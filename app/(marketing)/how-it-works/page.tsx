import type { Metadata } from "next";
import { Check } from "lucide-react";

import { Band, Section, SectionHead, H1, PrimaryLink, SecondaryLink, CtaBand, FaqList } from "../_components/ui";
import { InView, StoryScroller } from "../_components/motion";
import { UploadPreview } from "../_components/upload-preview";
import { ReminderPreview } from "../_components/reminder-preview";
import { RequestPreview, ReviewPreview } from "../_components/step-previews";

export const metadata: Metadata = {
  title: "How Subbies works",
  description:
    "A closer look at how Subbies collects, reviews, and tracks contractor compliance documents, and why contractors actually respond.",
};

function Points({ lead, points }: { lead: string; points: string[] }) {
  return (
    <>
      <p>{lead}</p>
      <ul className="mt-5 space-y-2.5 text-base text-ink">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2.5">
            <Check className="mt-1 h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden />
            {p}
          </li>
        ))}
      </ul>
    </>
  );
}

const STEPS = [
  {
    title: "Onboard the contractor",
    body: <Points lead="Pick the documents you need from your own list and send." points={["Your document types, your rules", "Email comes from your business", "Resend in one click"]} />,
    visual: <RequestPreview />,
  },
  {
    title: "They upload from anywhere",
    body: <Points lead="One secure link. No account, no password, no app." points={["Checklist of what's outstanding", "Phone photos or PDFs", "Same link works at renewal"]} />,
    visual: <UploadPreview />,
  },
  {
    title: "You review and decide",
    body: <Points lead="Every submission lands in one place." points={["Expiry pre-filled per document type", "Reject with a reason, they fix it", "Approved once every document is"]} />,
    visual: <ReviewPreview />,
  },
  {
    title: "Stay ahead of expiry",
    body: <Points lead="Records stay current after onboarding." points={["Reminders on your schedule", "Escalates to you if ignored", "Dashboard shows who needs you"]} />,
    visual: <ReminderPreview />,
  },
];

const DIFFERENT = [
  { title: "No contractor sign-up.", body: "Account creation is where onboarding stalls. It's gone." },
  { title: "Approval, not storage.", body: "A shared drive holds files. Subbies tells you who's cleared." },
  { title: "Tied to your jobs.", body: "See whether everyone on a site is compliant right now." },
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

export default function HowItWorksPage() {
  return (
    <>
      <Section className="grid grid-cols-[minmax(0,1fr)] items-center gap-14 py-16 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <h1 className={`rise max-w-[18ch] ${H1}`}>The paperwork problem, solved from both sides.</h1>
          <p className="rise mt-6 max-w-[34rem] text-lg text-ink-muted [--anim-delay:120ms]">
            Fast for you, almost effortless for your contractors, and current long after.
          </p>
          <div className="rise mt-9 flex flex-col gap-3 [--anim-delay:220ms] sm:flex-row sm:flex-wrap">
            <PrimaryLink href="/signup">Get started</PrimaryLink>
            <SecondaryLink href="/pricing">See pricing</SecondaryLink>
          </div>
        </div>
        {/* Both sides: the contractor's phone, and your review of what they sent. */}
        <div aria-hidden className="relative mx-auto hidden w-full max-w-[34rem] sm:block">
          <div className="rise w-[62%] [--anim-delay:150ms]">
            <UploadPreview />
          </div>
          <div className="pop-in absolute bottom-10 right-0 w-[64%] [--anim-delay:700ms]">
            <ReviewPreview />
          </div>
        </div>
      </Section>

      <Band tone="surface" bordered innerClassName="py-section">
        <StoryScroller steps={STEPS} />
      </Band>

      <Band tone="canvas" innerClassName="py-section">
        <InView>
          <SectionHead label="Why it works" title="Built for one job, done properly." />
        </InView>
        <ol className="mt-12 divide-y divide-line border-y border-line">
          {DIFFERENT.map((d, i) => (
            <li key={d.title}>
              <InView delay={i * 100} className="grid gap-2 py-7 sm:grid-cols-[4rem_minmax(0,1fr)_minmax(0,1fr)] sm:items-baseline sm:gap-8">
                <span className="font-mono text-sm text-ink-subtle">0{i + 1}</span>
                <p className="font-display text-2xl font-semibold leading-tight sm:text-[1.75rem]">{d.title}</p>
                <p className="text-lg text-ink-muted">{d.body}</p>
              </InView>
            </li>
          ))}
        </ol>
      </Band>

      <Band tone="deep" bordered innerClassName="grid gap-10 py-section lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
        <SectionHead label="Questions" title="Frequently asked." />
        <FaqList items={FAQ} />
      </Band>

      <CtaBand heading="See it with your own documents" secondary={{ href: "/pricing", label: "See pricing" }} />
    </>
  );
}
