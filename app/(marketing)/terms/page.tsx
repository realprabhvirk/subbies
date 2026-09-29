import type { Metadata } from "next";
import Link from "next/link";

import { TRIAL_DAYS } from "@/lib/billing/plans";
import { TERMS_LAST_UPDATED } from "@/lib/legal/terms";
import { Section, Eyebrow } from "../_components/ui";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that apply when you use Subbies.",
};

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

export default function TermsPage() {
  return (
    <Section className="py-16 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <Eyebrow>Legal</Eyebrow>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-ink-subtle">Last updated: {TERMS_LAST_UPDATED}</p>

        <div className="mt-10 space-y-10 border-t border-line pt-10">
          <P>
            These terms are the agreement between you and Subbies
            (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;), the
            operator of the Subbies service. By creating an account or using
            Subbies, you agree to them. If you don&rsquo;t agree, don&rsquo;t
            use Subbies.
          </P>

          <section>
            <H2>1. Who can use Subbies</H2>
            <UL>
              <li>You must be 18 or over.</li>
              <li>
                Subbies is for business use. You confirm you&rsquo;re signing
                up on behalf of a business and have authority to agree to these
                terms for it.
              </li>
              <li>
                If we learn that an account was opened by someone under 18, we
                may close it, refund any payments, and delete the data.
              </li>
            </UL>
          </section>

          <section>
            <H2>2. What Subbies does</H2>
            <P>
              Subbies helps you track your subcontractors&rsquo; compliance
              documents (such as licences and insurance certificates), send
              them secure upload links and reminders, and review what they
              submit.
            </P>
            <P>
              Subbies is a tracking tool. It is not legal, safety, insurance or
              compliance advice.
            </P>
          </section>

          <section>
            <H2>3. Compliance is still your responsibility</H2>
            <UL>
              <li>
                We don&rsquo;t verify that any uploaded document is genuine,
                current, or enough to meet your legal, licensing, insurance or
                safety obligations. You decide what to accept, and you review
                and approve documents yourself.
              </li>
              <li>
                Reminders and document requests are sent by email. Emails can
                be delayed, filtered, bounce, or go unread. Don&rsquo;t rely on
                reminders alone; check your dashboard.
              </li>
              <li>
                Subbies showing a subcontractor as compliant does not mean they
                are compliant.
              </li>
            </UL>
          </section>

          <section>
            <H2>4. Your account</H2>
            <UL>
              <li>Give us accurate information and keep it up to date.</li>
              <li>Keep your password secure. You&rsquo;re responsible for what happens under your account.</li>
              <li>Tell us straight away if you think someone has accessed your account without permission.</li>
            </UL>
          </section>

          <section>
            <H2>5. Your data and your subcontractors</H2>
            <UL>
              <li>
                You own the data and documents you put into Subbies. You give
                us permission to store and process them only as needed to run
                the service for you.
              </li>
              <li>
                You confirm you&rsquo;re entitled to give us your
                subcontractors&rsquo; contact details and documents, and to
                have us email them on your behalf about their compliance
                documents.
              </li>
              <li>
                You&rsquo;re responsible for telling your subcontractors how
                their information is used, as your own privacy obligations
                require.
              </li>
              <li>
                How we handle personal information is set out in our{" "}
                <Link href="/privacy" className="text-brand hover:underline">
                  Privacy Policy
                </Link>
                .
              </li>
            </UL>
          </section>

          <section>
            <H2>6. Acceptable use</H2>
            <P>You must not:</P>
            <UL>
              <li>use Subbies for anything unlawful, or to upload content you have no right to upload;</li>
              <li>upload malware, or anything harmful to us, our providers, or other people;</li>
              <li>try to break, probe, overload, or get around the security or limits of Subbies;</li>
              <li>use Subbies to send spam or marketing unrelated to your subcontractors&rsquo; compliance;</li>
              <li>resell or share access to Subbies outside your business.</li>
            </UL>
          </section>

          <section>
            <H2>7. Plans, free trial and billing</H2>
            <UL>
              <li>
                Plans and prices are shown on our{" "}
                <Link href="/pricing" className="text-brand hover:underline">
                  pricing page
                </Link>{" "}
                in Australian dollars. Subscriptions are billed monthly in
                advance through Stripe.
              </li>
              <li>
                <strong className="text-ink">Free trial:</strong> your first
                subscription starts with a {TRIAL_DAYS}-day free trial. You
                enter a card at signup and nothing is charged during the trial.
                Unless you cancel before it ends, your card is charged the
                plan price on day {TRIAL_DAYS}, and then every month.
              </li>
              <li>
                A trial is available once per business. If your business or
                email address has already had a trial, we may charge you from
                the start of the subscription instead.
              </li>
              <li>
                If a payment fails, Stripe may retry it, and we may limit your
                access until it&rsquo;s paid.
              </li>
              <li>
                We may change prices. We&rsquo;ll give you at least 30
                days&rsquo; notice by email before a change applies to you, and
                you can cancel before it does.
              </li>
              <li>
                <strong className="text-ink">Cancelling:</strong> you can
                cancel any time in Settings &rarr; Billing. Your plan stays
                active until the end of the period you&rsquo;ve paid for. Apart
                from what the law requires (see section 12), we don&rsquo;t
                give refunds for part-used periods.
              </li>
            </UL>
          </section>

          <section>
            <H2>8. If your subscription ends</H2>
            <P>
              If your subscription is cancelled or lapses, your account is
              locked: you can&rsquo;t add new subcontractors, document types or
              projects until you subscribe again. We don&rsquo;t delete your
              data just because your subscription ended. It stays until you
              delete your account.
            </P>
          </section>

          <section>
            <H2>9. Deleting your account</H2>
            <UL>
              <li>You can delete your account any time in Settings. We&rsquo;ll ask you to confirm with a code sent to your email.</li>
              <li>
                Deleting cancels your billing immediately and permanently
                deletes your company data, subcontractor records and uploaded
                documents from Subbies. It can&rsquo;t be undone.
              </li>
              <li>
                Some records are kept after deletion (your email address for
                free-trial purposes, and payment records held by Stripe). See
                Section 6 of our{" "}
                <Link href="/privacy" className="text-brand hover:underline">
                  Privacy Policy
                </Link>
                .
              </li>
            </UL>
          </section>

          <section>
            <H2>10. Availability and changes to the service</H2>
            <P>
              We aim to keep Subbies running reliably, but we don&rsquo;t
              promise it will always be available or error-free. It depends on
              third-party providers, and we may need to carry out maintenance.
              We may add, change or remove features over time.
            </P>
          </section>

          <section>
            <H2>11. Suspension and termination</H2>
            <P>
              We may suspend or close your account if you breach these terms,
              don&rsquo;t pay, or use Subbies in a way that puts our service,
              other customers, or the law at risk. Where it&rsquo;s reasonable
              to do so, we&rsquo;ll tell you first.
            </P>
          </section>

          <section>
            <H2>12. Your rights and our liability</H2>
            <UL>
              <li>
                Nothing in these terms excludes, restricts or modifies any
                right or remedy you have under the Australian Consumer Law or
                any other law that can&rsquo;t be excluded.
              </li>
              <li>
                Subject to that, and to the extent the law allows, we
                aren&rsquo;t liable for indirect or consequential loss, or for
                loss of profit, revenue or business, including fines, penalties
                or losses arising from a missed expiry, a missed or delayed
                reminder, or a subcontractor being found non-compliant.
              </li>
              <li>
                Subject to the same limits, our total liability to you for
                anything arising from your use of Subbies is limited to the
                amount you paid us in the 12 months before the claim arose.
              </li>
              <li>
                Where the law allows us to limit our liability for a breach of a
                consumer guarantee, our liability is limited (at our choice) to
                supplying the service again or paying the cost of having it
                supplied again.
              </li>
            </UL>
          </section>

          <section>
            <H2>13. Changes to these terms</H2>
            <P>
              We may update these terms. For changes that matter, we&rsquo;ll
              tell you by email or in the app before they take effect.
              If you keep using Subbies after that, you accept the updated
              terms. If you don&rsquo;t agree, you can cancel or delete your
              account.
            </P>
          </section>

          <section>
            <H2>14. Governing law</H2>
            <P>
              These terms are governed by the laws of Queensland, Australia. You
              and we submit to the non-exclusive jurisdiction of the courts of
              Queensland.
            </P>
          </section>

          <section>
            <H2>15. Contact us</H2>
            <P>
              Questions about these terms? Get in touch through our{" "}
              <Link href="/contact" className="text-brand hover:underline">
                contact page
              </Link>
              .
            </P>
          </section>
        </div>
      </div>
    </Section>
  );
}
