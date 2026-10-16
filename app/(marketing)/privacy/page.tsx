import type { Metadata } from "next";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { Section, Eyebrow } from "../_components/ui";
import {
  PRIVACY_POLICY_IN_FORCE,
  PRIVACY_LAST_UPDATED,
  PRIVACY_EMAIL,
  LEGAL_ENTITY_NAME,
  LEGAL_ENTITY_ABN,
  DATA_REGION_SUPABASE,
  DATA_REGION_EMAIL,
} from "@/lib/legal/privacy";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Subbies collects, uses, and retains your information.",
};

/**
 * The unmissable "this policy isn't live yet" banner. Shown whenever
 * PRIVACY_POLICY_IN_FORCE is false (the one switch in lib/legal/privacy.ts).
 * Full-width, large display type, the design system's "expired" red, and
 * role="alert" so assistive tech announces it.
 */
function NotInForceBanner() {
  return (
    <div
      role="alert"
      className="border-b-2 border-expired-line bg-expired-bg"
    >
      <div className="mx-auto flex max-w-5xl items-start gap-4 px-4 py-8 sm:px-6 sm:py-10">
        <TriangleAlert
          className="mt-1 h-8 w-8 shrink-0 text-expired sm:h-10 sm:w-10"
          strokeWidth={2.25}
          aria-hidden
        />
        <div>
          <p className="font-display text-2xl font-bold leading-tight tracking-tight text-expired sm:text-4xl">
            This privacy policy is not in use and is not valid.
          </p>
          <p className="mt-3 max-w-2xl text-base font-medium text-expired/90 sm:text-lg">
            Subbies is currently in a testing phase. This document is a draft,
            has no legal effect, and should not be relied on.
          </p>
        </div>
      </div>
    </div>
  );
}

/** "To exercise these rights…"-style contact line, used in two places. */
function PrivacyContact() {
  if (PRIVACY_EMAIL) {
    return (
      <a href={`mailto:${PRIVACY_EMAIL}`} className="text-brand hover:underline">
        {PRIVACY_EMAIL}
      </a>
    );
  }
  return (
    <Link href="/contact" className="text-brand hover:underline">
      our contact page
    </Link>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-semibold sm:text-2xl">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-ink-muted sm:text-base">{children}</p>;
}

function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-muted sm:text-base">
      {children}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <>
      {!PRIVACY_POLICY_IN_FORCE && <NotInForceBanner />}
      <Section className="py-section">
      <div className="mx-auto max-w-3xl">
        <Eyebrow>Legal</Eyebrow>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-ink-subtle">Last updated: {PRIVACY_LAST_UPDATED}</p>

        <div className="mt-10 space-y-10 border-t border-line pt-10">
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
            <P>
              <strong className="text-ink">Where your data is held:</strong>{" "}
              our database and uploaded documents are hosted with Supabase in{" "}
              {DATA_REGION_SUPABASE}. Transactional email is delivered from{" "}
              {DATA_REGION_EMAIL}. Payment data is held by Stripe. Some
              providers may process limited data in other regions to run their
              service.
            </P>
            <P>
              <strong className="text-ink">Data breaches:</strong> if an
              eligible data breach occurs, we will notify affected individuals
              and the Office of the Australian Information Commissioner (OAIC)
              as required by the Notifiable Data Breaches scheme under the
              Privacy Act 1988 (Cth).
            </P>
          </section>

          <section>
            <H2>6. Data retention</H2>
            <UL>
              <li>Your account data is retained for as long as your account is active.</li>
              <li>
                <strong className="text-ink">If you delete your account</strong>, we
                cancel your subscription and permanently delete your company
                data, subcontractor records, and all uploaded documents from
                Subbies.
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
              To exercise these rights, get in touch through <PrivacyContact />.
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
              <p className="font-semibold text-ink">{LEGAL_ENTITY_NAME}</p>
              <p>ABN: {LEGAL_ENTITY_ABN}</p>
              <p>
                {PRIVACY_EMAIL ? "Email: " : "Reach us through "}
                <PrivacyContact />
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
    </>
  );
}
