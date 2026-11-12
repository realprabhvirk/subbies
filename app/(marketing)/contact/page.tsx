import type { Metadata } from "next";

import { Band, H1 } from "../_components/ui";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the Subbies team.",
};

export default function ContactPage() {
  return (
    <Band tone="canvas" innerClassName="py-14 sm:py-20 lg:py-24">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
        <div>
          <h1 className={`rise ${H1}`}>
            Talk to us.
          </h1>
          <p className="rise mt-5 max-w-[30rem] text-lg text-ink-muted [--anim-delay:120ms]">
            Send a note. We reply personally.
          </p>
          <ul className="rise mt-9 max-w-[30rem] divide-y divide-line border-y border-line text-base [--anim-delay:200ms]">
            <li className="py-4">
              <span className="font-semibold">Already a customer?</span>{" "}
              <span className="text-ink-muted">Use this form too. Include your company name.</span>
            </li>
            <li className="py-4">
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
