import type { Metadata } from "next";

import { Section, Eyebrow } from "../_components/ui";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the Subbies team.",
};

export default function ContactPage() {
  return (
    <Section className="py-16 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Eyebrow>Contact</Eyebrow>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Talk to us
          </h1>
          <p className="mt-4 text-ink-muted">
            Questions about whether Subbies fits your business, founding-customer
            pricing, or anything else — send a note and we&apos;ll reply
            personally.
          </p>
        </div>
        <ContactForm />
      </div>
    </Section>
  );
}
