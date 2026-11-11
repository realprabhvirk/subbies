import type { Metadata } from "next";

import { Band, Eyebrow } from "../_components/ui";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the Subbies team.",
};

export default function ContactPage() {
  return (
    <Band tone="canvas" innerClassName="py-14 sm:py-20 lg:py-28">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-24">
        <div>
          <Eyebrow>Contact</Eyebrow>
          <h1 className="mt-5 text-[2.6rem] leading-[0.98] tracking-display sm:text-6xl xl:text-[4.5rem]">
            Talk to us.
          </h1>
          <p className="mt-7 max-w-[34rem] text-lg text-ink-muted sm:text-xl">
            Questions about whether Subbies fits your business, founding-customer
            pricing, or anything else, send a note and we&apos;ll reply
            personally.
          </p>
          <ul className="mt-10 max-w-[34rem] divide-y divide-line border-y border-line text-base sm:text-lg">
            <li className="py-5">
              <span className="font-semibold">Already a customer?</span>{" "}
              <span className="text-ink-muted">Use this form too. Include your company name.</span>
            </li>
            <li className="py-5">
              <span className="font-semibold">A contractor with an upload link?</span>{" "}
              <span className="text-ink-muted">
                Reply to the email the company sent you. They manage your request.
              </span>
            </li>
          </ul>
        </div>
        <ContactForm />
      </div>
    </Band>
  );
}
