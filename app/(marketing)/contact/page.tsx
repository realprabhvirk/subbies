import type { Metadata } from "next";

import { Section, Eyebrow } from "../_components/ui";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the Subbies team.",
};

export default function ContactPage() {
  return (
    <Section className="pb-section pt-14 sm:pt-20">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <div>
          <Eyebrow>Contact</Eyebrow>
          <h1 className="mt-5 text-4xl leading-[1] tracking-display sm:text-6xl">
            Talk to us.
          </h1>
          <p className="mt-6 max-w-md text-base text-ink-muted">
            Questions about whether Subbies fits your business, founding-customer
            pricing, or anything else, send a note and we&apos;ll reply
            personally.
          </p>
          <ul className="mt-8 max-w-md divide-y divide-line border-y border-line text-sm">
            <li className="py-3">
              <span className="font-semibold">Already a customer?</span>{" "}
              <span className="text-ink-muted">Use this form too. Include your company name.</span>
            </li>
            <li className="py-3">
              <span className="font-semibold">A contractor with an upload link?</span>{" "}
              <span className="text-ink-muted">
                Reply to the email the company sent you. They manage your request.
              </span>
            </li>
          </ul>
        </div>
        <ContactForm />
      </div>
    </Section>
  );
}
