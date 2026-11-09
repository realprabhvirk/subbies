import type { Metadata } from "next";
import Link from "next/link";

import { PRIVACY_LAST_UPDATED } from "@/lib/legal/privacy";
import { Section, Eyebrow } from "../_components/ui";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Subbies collects, uses, and retains your information.",
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl sm:text-2xl">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 max-w-[68ch] text-sm leading-relaxed text-ink sm:text-base">{children}</p>;
}

function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-3 max-w-[68ch] list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink marker:text-ink-subtle sm:text-base">
      {children}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <Section className="pb-section pt-14 sm:pt-20">
      <div className="max-w-3xl">
        <Eyebrow>Legal</Eyebrow>
        <h1 className="mt-5 text-4xl leading-[1.02] tracking-display sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-4 font-mono text-xs text-ink-muted">Last updated: {PRIVACY_LAST_UPDATED}</p>

        <div className="mt-10 space-y-10 border-t border-ink pt-10">
          <P>
            Subbies (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) provides a subcontractor
            compliance and document tracking platform for construction
            businesses. This policy explains what information we collect, how
            we use it, and the choices you have.
          </P>

          <section>
            <H2>1. Who this applies to</H2>
            <P>This policy covers:</P>
            <UL>
              <li>
                <strong className="text-ink">Business users</strong> — the
                construction business/builder that creates a Subbies account
              </li>
              <li>
                <strong className="text-ink">Subcontractors</strong> —
                individuals or businesses who receive a document request link
                and upload compliance documents, without creating an account
              </li>
            </UL>
          </section>

          <section>
            <H2>2. Information we collect</H2>

            <p className="mt-3 text-sm font-semibold text-ink sm:text-base">
              From business users (account holders):
            </p>
            <UL>
              <li>Name, email address, phone number, business name and ABN (where provided)</li>
              <li>Login credentials (managed securely via our authentication provider)</li>
              <li>
                Payment and billing information. Billing details (such as your
                name, email and card details) are collected and held by
                Stripe. Our servers never see or store your card number. We
                keep only your Stripe customer and subscription IDs, your
                plan, subscription status and billing dates
              </li>
              <li>
                Subcontractor records you add: names, contact details, trade
                type, required document types
              </li>
              <li>
                A record that you agreed to our Terms of Service and Privacy
                Policy when you signed up: the date and time, and the version
                you agreed to
              </li>
              <li>
                Documents uploaded on your or your subcontractors&rsquo;
                behalf (e.g. insurance certificates, licences, workers
                compensation documents)
              </li>
            </UL>

            <p className="mt-5 text-sm font-semibold text-ink sm:text-base">
              From subcontractors (via secure upload links):
            </p>
            <UL>
              <li>Name and contact details as provided by the business that added them</li>
              <li>Documents uploaded through the secure, token-based upload link</li>
              <li>
                A record of your agreement each time you upload: before you can
                submit a document you tick a box agreeing to this Privacy
                Policy and the parts of our Terms of Service that apply to you.
                We save the date and time and the version of each that you
                agreed to, against the document you submitted
              </li>
              <li>Subcontractors are not required to create an account, set a password, or log in</li>
            </UL>

            <p className="mt-5 text-sm font-semibold text-ink sm:text-base">
              Automatically collected:
            </p>
            <UL>
              <li>
                Basic technical data (IP address, browser type, device
                information) for security and troubleshooting purposes
              </li>
            </UL>
          </section>

          <section>
            <H2>3. How we use your information</H2>
            <P>We use collected information to:</P>
            <UL>
              <li>
                Provide the core service: tracking document expiry, sending
                reminders, managing compliance status
              </li>
              <li>
                Send transactional emails (document requests, expiry
                reminders, account notifications, billing receipts)
              </li>
              <li>Process subscription payments via Stripe</li>
              <li>
                Check whether a business has already claimed a free trial, using
                email address, IP address and card details (processed through
                Stripe), so we can refuse a second trial
              </li>
              <li>
                Keep a record of who agreed to our Terms and Privacy Policy,
                when, and which version, so we can show what was agreed
              </li>
              <li>Maintain account security (login verification, password reset)</li>
              <li>Improve and maintain the platform</li>
            </UL>
            <P>We do not sell your personal information to third parties.</P>
          </section>

          <section>
            <H2>4. Third-party services we use</H2>
            <P>
              Subbies is built on the following infrastructure providers,
              each of which processes data on our behalf under their own
              security and privacy standards:
            </P>
            <div className="mt-4 overflow-x-auto rounded-md border border-line">
              <table className="w-full min-w-[400px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-muted">
                    <th className="px-4 py-2.5 font-semibold text-ink">Service</th>
                    <th className="px-4 py-2.5 font-semibold text-ink">Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Supabase", "Database, authentication, and document storage"],
                    ["Stripe", "Payment processing and subscription billing"],
                    ["Resend", "Transactional email delivery"],
                    ["Vercel", "Application hosting"],
                  ].map(([service, purpose]) => (
                    <tr key={service} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-2.5 text-ink">{service}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <P>
              Most of these providers process data only to provide their
              service to us. Stripe is the exception: it also uses payment
              data for its own legal, fraud-prevention and financial-reporting
              purposes, as described in{" "}
              <a
                href="https://stripe.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand hover:underline"
              >
                Stripe&rsquo;s privacy policy
              </a>
              .
            </P>
          </section>

          <section>
            <H2>5. Document storage and security</H2>
            <P>
              Uploaded documents (insurance certificates, licences, and
              similar compliance records) are stored securely and are not
              publicly accessible. Access is restricted to the business
              account that requested the document and, where applicable, the
              subcontractor who uploaded it via their unique secure link.
            </P>
          </section>

          <section>
            <H2>6. Data retention</H2>
            <UL>
              <li>Your account data is retained for as long as your account is active.</li>
              <li>
                <strong className="text-ink">If you delete your account</strong>, we
                cancel your subscription and permanently delete your company
                data, subcontractor records, all uploaded documents, and the
                records of agreement saved with them, from Subbies.
              </li>
              <li>
                <strong className="text-ink">Exception 1, trial records:</strong> we
                retain your email address indefinitely, separate from all
                other account data, solely to prevent the same account from
                claiming more than one free trial. This retained record
                contains nothing beyond the email address itself — no
                documents, no business data, no subcontractor information.
              </li>
              <li>
                <strong className="text-ink">Exception 2, payment records:</strong>{" "}
                Stripe keeps its own records of your payments and invoices
                (such as your name, email and payment history) after your
                Subbies account is deleted, as required by tax, financial and
                anti-fraud laws. These records are held and governed by Stripe,
                not Subbies, and we can&rsquo;t delete them on request.
              </li>
              <li>
                <strong className="text-ink">Exception 3, account locking:</strong>{" "}
                If your subscription ends, your account is locked, but locking
                doesn&rsquo;t mean your data is deleted. Your company data,
                subcontractor records and documents stay in place until you
                delete your account. See Section 8 of our{" "}
                <Link href="/terms" className="text-brand hover:underline">
                  Terms of Service
                </Link>
                .
              </li>
            </UL>
          </section>

          <section>
            <H2>7. Your rights</H2>
            <P>Subject to applicable law, you may have the right to:</P>
            <UL>
              <li>Access the personal information we hold about you</li>
              <li>Correct inaccurate information</li>
              <li>
                Request deletion of your account and associated data (noting
                the retention exceptions in Section 6)
              </li>
            </UL>
            <P>
              To exercise these rights, contact us at{" "}
              <a href="mailto:privacy@yourdomain.com" className="text-brand hover:underline">
                privacy@yourdomain.com
              </a>
              .
            </P>
          </section>

          <section>
            <H2>8. Subcontractor data</H2>
            <P>
              If you are a subcontractor who received a document request
              link, the business that added you controls the information
              associated with your record. Requests to access or correct that
              information should be directed to the business you&rsquo;re
              contracted with. You may contact us directly regarding
              documents you&rsquo;ve uploaded via a secure link.
            </P>
          </section>

          <section>
            <H2>9. Children&rsquo;s privacy</H2>
            <P>
              Subbies is a business-to-business product not directed at or
              intended for use by children. We do not knowingly collect
              information from individuals under 18.
            </P>
          </section>

          <section>
            <H2>10. Changes to this policy</H2>
            <P>
              We may update this policy from time to time. Material changes
              will be communicated via email to account holders or a notice
              within the platform.
            </P>
          </section>

          <section>
            <H2>11. Contact us</H2>
            <P>Questions about this policy or your data can be directed to:</P>
            <div className="mt-3 text-sm leading-relaxed text-ink-muted sm:text-base">
              <p className="font-semibold text-ink">[Business name / trading name]</p>
              <p>ABN: [Your ABN]</p>
              <p>
                Email:{" "}
                <a href="mailto:privacy@yourdomain.com" className="text-brand hover:underline">
                  [privacy@yourdomain.com]
                </a>
              </p>
            </div>
          </section>
        </div>

        <p className="mt-12 border-t border-line pt-6 text-sm text-ink-muted">
          Questions before you sign up? See our{" "}
          <Link href="/contact" className="text-brand hover:underline">
            contact page
          </Link>
          .
        </p>
      </div>
    </Section>
  );
}
