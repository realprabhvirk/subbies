# Subbies — Security & Product Audit

**Date:** 15 October 2026
**Auditor:** Claude (hands-on QA + security + first-use review)
**Live app:** https://subbies-hazel.vercel.app
**Code reviewed at:** `origin/main` @ `1df932e`
**Method:** Live black-box testing (desktop 1280px + iPhone viewport) against production, two real test accounts, direct Supabase REST probes with real user JWTs, plus full code and migration review. Stripe left in live mode — checkout loaded but no card entered, no payment completed.

---

## 1. Verdict

**No — not safe to put real paying customers on today, because of one specific thing.** There is a confirmed, reproducible hole where one business can read another business's uploaded compliance documents (insurance certificates, licences) — I did it end to end between two test accounts and pulled a real file. Everything *else* is in unusually good shape for a solo build: the database tenant isolation is genuinely solid (15 of 15 other cross-company attacks blocked), storage is locked down, Stripe and the trial logic are sound, and there's no XSS. Fix the file-access hole, patch the critical Next.js CVE, finish the placeholder-filled Privacy Policy, and sort the email sending domain, and this flips to "yes, with a short cleanup list." Realistically that's a few days of focused work, not a rebuild.

---

## 2. Top 10 fix-first list (ranked by what hurts you most)

1. **C1 — Cross-tenant document theft.** Any logged-in customer can read any other customer's uploaded files. This is the one that can sink you (a builder's insurance certificates leaking to a competitor). Proven live. **Fix before any real customer.**
2. **H1 — Next.js 16.3.3 has a critical RCE + cross-user cache-poisoning CVE.** One `npm` bump. Do it today.
3. **H2 — Privacy Policy is live with placeholder text** (`[Your ABN]`, `privacy@yourdomain.com`, `[Business name]`). It's legally your published promise and it's half-filled. Also a dead `mailto:privacy@yourdomain.com` link.
4. **H3 — Emails send from `unknwnmoving.store`,** an unrelated parked domain. Your entire product is "we email your contractors a link." Those emails will look like spam/phishing and land in junk.
5. **M4 — Expiry reminders and "expired" status are a day late for Queensland.** The whole product is about not missing an expiry; the date maths runs in UTC, so a cert that expired yesterday in Brisbane still shows "0 days" and reminders fire a day behind.
6. **H4 — No email verification on signup** (Supabase auto-confirm on). Anyone can register with anyone's email, and there's no rate limiting to slow abuse.
7. **M1 — No security headers** (no CSP, no X-Frame-Options). Your dashboard can be embedded in a hostile page (clickjacking) and there's no second line of defence against script injection.
8. **M2 — Password rules too weak.** `password` was accepted. UI claims 8 chars; the server only enforces 6; no strength check.
9. **M3 — No rate limiting** on the public upload link, contact form, or signup.
10. **M6 — No `robots.txt`, `sitemap.xml`, or social-share image.** You're invisible to search and link previews look blank — this is your growth, not your security.

---

## 3. Findings table

| ID | Severity | Area | What's wrong | How to reproduce | Suggested fix (one line) |
|----|----------|------|--------------|------------------|--------------------------|
| C1 | **Critical** | Multi-tenant / Storage | A company can read another company's uploaded files by inserting a `contractor_document_files` row that points at the other company's storage path; the file-URL functions sign the path without checking it belongs to the caller's company | See §4 C1 — reproduced live, pulled Company A's PDF from Company B's account (signed URL, HTTP 200) | Validate `file_path` starts with `${companyId}/` before signing (in `getDocumentFileUrl`/`getSubmittedFileUrl`) **and** add a DB CHECK/RLS `with check` on `contractor_document_files` insert |
| H1 | High | Dependencies | `next@16.3.3` has a critical RCE (`next/og`), SSG/ISR cache poisoning (cross-user content), and image-optimization SSRF | `npm audit` → 1 critical, 8 high | `npm i next@16.4.1` (or latest 16.x), redeploy |
| H2 | High | Legal | Privacy Policy published with unfilled placeholders and a fake contact email | Visit `/privacy` §7 & §11: `[Your ABN]`, `[Business name / trading name]`, `privacy@yourdomain.com` (also a live `mailto:` to it) | Fill real trading name, ABN, and a working privacy contact; APP compliance needs an identifiable entity |
| H3 | High | Email deliverability | All mail sends `From: Subbies <onboarding@unknwnmoving.store>` — an unrelated parked domain | `lib/email/resend.ts:13`; DNS of `unknwnmoving.store` is an AWS/SES parking setup | Buy/verify a real `subbies.au` sending domain in Resend; set `RESEND_FROM` |
| H4 | High | Auth | Email confirmation disabled (`mailer_autoconfirm:true`); anyone can sign up as any email, no verification | `GET /auth/v1/settings` on the project shows `mailer_autoconfirm:true` | Turn on email confirmation (the code already handles the `confirmation_pending` path); add signup rate limiting |
| M1 | Medium | Headers | No CSP, X-Frame-Options, Referrer-Policy, or Permissions-Policy; only HSTS is set | `curl -I https://subbies-hazel.vercel.app/dashboard` | Add a `headers()` block in `next.config.ts` (frame-ancestors 'none', a CSP, nosniff, referrer-policy) |
| M2 | Medium | Auth | Weak passwords accepted; UI says 8 chars, server enforces 6, no strength meter | Signed up with password `password` → accepted; API rejects only <6 | Raise Supabase min length to ≥10, add a zxcvbn-style check, make UI and server agree |
| M3 | Medium | Abuse | No rate limiting on `/onboard/[token]`, contact form, or signup | No throttle observed; token guard is UUID entropy only | Add per-IP throttling (Vercel middleware / Upstash) on public routes |
| M4 | Medium | Core logic | Expiry reminders + "expired" status use UTC date maths; cron runs 21:00 UTC (7am AEST). Doc expiring *today* in QLD shows "1 day left"; overdue-by-1 shows "0" | `lib/reminders/expiry-logic.ts:5` `daysUntilExpiry` uses `Date.UTC`; proven with a script (expiry 2026-10-15 at cron time → 1, should be 0) | Compute "today" in `Australia/Brisbane`, not UTC, in `daysUntilExpiry` and `contractor-status.ts:isPast` |
| M5 | Medium | Billing | A Stripe **live-mode** customer is created the moment checkout starts, even if abandoned → orphaned customers | Started checkout as test account A → `cus_VRhlVLa6yJ0ulS` created with no subscription | Create the customer lazily (only on `checkout.session.completed`) or sweep orphans periodically |
| M6 | Medium | SEO/growth | No `robots.txt`, no `sitemap.xml`, no OG/Twitter image on any page | `/robots.txt` & `/sitemap.xml` → 404; crawl shows `og:image` null everywhere | Add `app/robots.ts`, `app/sitemap.ts`, and an `opengraph-image` |
| M7 | Medium | Billing/limits | Pricing advertises per-plan storage (200/750 GB) but storage is **not enforced**; real limit is the shared Supabase project cap | `lib/billing/plans.ts` comment "Marketing display only — not enforced" | Either enforce a per-company storage cap or soften the pricing wording |
| M8 | Low-Med | Schema | `subscriptions` has duplicate reminder columns (`trial_reminder_5_at` + `trial_reminder_day5_at`, same for `_7_`) | Visible in any `subscriptions` row | Drop the unused pair in a cleanup migration |
| M9 | Medium | Session | Auth cookies set `Secure=false` on the production HTTPS site (httpOnly=false is Supabase SSR by design) | Playwright cookie dump on prod: `secure:false` on `sb-…-auth-token.*` | Set cookies `Secure` in the Supabase SSR cookie options (HSTS-preload currently masks the risk) |
| L1 | Low | SEO | `/login`, `/signup`, `/forgot-password`, `/reset-password` all share title "Subbies" and the generic dashboard meta description | Crawl output | Give each auth page its own `metadata` title/description |
| L2 | Low | UX | After a successful upload the contractor's screen can still read "Not uploaded" until reload (stale client state); correct after refresh | Uploaded PNG on 2nd requirement; screen lagged, DB was `uploaded`; reload fixed it | Refresh the item state from the server response after submit |
| L3 | Low | Branding | 404 page is the unbranded Next default "This page could not be found." | Visit any bad URL | Add `app/not-found.tsx` with the Subbies shell |
| L4 | Low | Content | Homepage mock UI shows `subbies.com/onboard/…` but the brand/app is `subbies.au` / `subbies-hazel.vercel.app` | Homepage "How it works" card | Use the real domain in the mock |

---

## 4. Security findings (with exact steps)

### C1 — CRITICAL: One business can read another business's uploaded documents

**What it is:** The compliance documents customers upload (insurance, licences) are the most sensitive data in the product. I confirmed that any logged-in customer can retrieve another customer's actual files.

**Root cause (two layers, both needed):**
1. **RLS gap** — the insert policy on `contractor_document_files` (migration `0011`) only checks that the *document row* belongs to your company. It does **not** check that `file_path` is inside your company's own storage folder. So you can insert a file record, under one of your own documents, whose path points anywhere in the bucket.
2. **No prefix check on read** — `getDocumentFileUrl` (`app/dashboard/contractors/[id]/actions.ts:395`) and `getSubmittedFileUrl` (`app/onboard/[token]/actions.ts:273`) verify you *own the file row*, then hand that row's `file_path` straight to `createSignedDownload`, which signs with the service-role key (bypasses storage RLS). Neither checks the path is under your company prefix. (The `submitStagedDocuments` flow *does* check `startsWith(expectedPrefix)` at line 142 — but that only guards the normal upload path, not a direct row insert.)

**Reproduced live, end to end:**
1. Created two real accounts: Company A and Company B (both via the live signup page).
2. As Company A, uploaded a PDF through the normal contractor flow. Its stored path was `A_company_id/A_contractor_id/A_doc_id/<uuid>.pdf`.
3. As Company B (B's own JWT, B's own anon key — exactly what B's browser has), inserted a `contractor_document_files` row under one of B's own documents with `file_path` set to **A's** path. The database **accepted it (HTTP 201)** — the RLS `with check` passed because B owns the document row.
4. Opened B's own contractor upload link, clicked the file → got a valid signed URL whose object path is **A's company folder**, and fetching it returned **HTTP 200** (A's actual file).

**Impact:** Full read access to any other tenant's documents, given a path. Paths are UUID-structured so not trivially guessable wholesale, but (a) the company-id prefix is discoverable from your own paths/URLs, and (b) a single leaked path (forwarded email, screenshot, support ticket) exposes that file to any account. For a compliance product this is the worst-case data class.

**Fix:**
- In both `getDocumentFileUrl` and `getSubmittedFileUrl`, reject any `file_path` that doesn't start with the resolved owner's `${companyId}/` before signing.
- Add a defence-in-depth DB constraint: an RLS `with check` (or trigger) on `contractor_document_files` insert/update requiring `file_path` to start with the owning company's id. (A plain CHECK can't join, so a trigger or a policy that recomputes the company prefix is the robust form.)
- Consider a one-off scan for any existing rows whose `file_path` prefix doesn't match their document's company (cheap to run, confirms nobody's already done this).

**Cleanup done:** I deleted both test contractors, their documents, the planted file row, the test document types, and removed the 3 test storage objects I uploaded (verified 404). Two leftovers I could **not** remove (there's deliberately no delete policy on `companies`): the two test auth users + their `companies`/`subscriptions` rows (`AUDIT TEST A (delete me)` / `AUDIT TEST B (delete me)`, emails `pvirk0+subbiesaudit-a@outlook.com` / `-b@`), and one orphaned **live-mode** Stripe customer `cus_VRhlVLa6yJ0ulS` (no subscription, never charged). Please delete these two accounts via Settings → Delete account, or in the Supabase/Stripe dashboards.

### What held up well (I tried hard to break these)

- **Tenant isolation at the DB:** As Company B, I attempted 15 cross-company operations against Company A — read company/contractors/documents/tokens/files/notifications/document-types, and insert/update/delete/move. **Every single one was blocked** (reads returned empty, writes returned RLS `42501`). The only gap is the C1 path-confusion above, which is an app-layer check, not a hole in the row policies.
- **Storage bucket:** Private. Anonymous list, read, and the public-URL route are all denied; anonymous upload returns RLS `403`; a non-allowed MIME is rejected before RLS even. Signed URLs are short-lived (120s contractor view, 300s company view).
- **Subscription tampering:** As a user I could **not** insert or update my own `subscriptions` row (RLS `42501`) — entitlements can only be set by the service role via the Stripe webhook. Good.
- **Open redirect:** `safeRedirectPath` correctly rejects `//evil`, `/\evil`, and absolute URLs. Solid, and unit-tested.
- **XSS:** I planted `<b>bold</b>` / `<i>` in a contractor name. It renders as literal text everywhere (React auto-escaping) — onboard page, dashboard, and the notification message. Email templates use `escapeHtml` consistently.
- **Stripe webhook:** Signature verified via `constructEventAsync` before any handling; unknown events ignored; orphaned-customer cancellation on failed payment. No raw-body or signature-bypass gap found.
- **Token quality:** Upload tokens are `gen_random_uuid()` (v4), unique-indexed, with a 60-day `expires_at`; invalid/expired/malformed tokens return a clean "link isn't valid" 404.

### Things I flagged but are lower risk
- **M9 cookies `Secure=false`** on HTTPS — real misconfiguration, but HSTS-preload (`max-age=63072000; includeSubDomains; preload`, confirmed in headers) forces HTTPS in practice, so exploitation needs a pre-HSTS first contact. Still worth fixing.
- **No secrets in the client bundle or git history:** scanned all 57 JS chunks and 105 commits — only the public anon key is shipped (expected), no `.env` tracked, no live keys in history.

---

## 5. Legal / privacy findings

- **H2 (above): Privacy Policy is live with placeholders** — `[Business name / trading name]`, `ABN: [Your ABN]`, and `privacy@yourdomain.com` (which is also a clickable `mailto:` link). Under the Australian Privacy Act / APPs a published policy needs a real, identifiable entity and a working contact. Right now it reads as unfinished.
- **Privacy Policy is otherwise good:** it correctly names Supabase/Stripe/Resend/Vercel as processors, explains the Stripe card-data split, the trial-email retention, and the post-deletion Stripe record retention. Just needs the real details filled in and ideally a data-location line (where Supabase/Resend host — note your Resend/SES path routes via `ap-northeast-1`, i.e. Tokyo; worth stating).
- **Terms of Service are solid** for a v1: 18+/business-use, ACL preserved (s12), QLD governing law, liability cap, trial/billing described as the app actually behaves, deletion + retention cross-referenced. No placeholders. Contact is via the contact page (fine). One gap: no explicit **Notifiable Data Breaches** mention anywhere — worth a line given you hold others' compliance docs.
- **Consent/linking:** Terms + Privacy are both linked from the footer and the signup checkbox (required, with a server-side guard). The **contractor upload page does not link either policy** — a subcontractor uploads their licence with no privacy notice shown. Worth adding a one-line "handled per [Privacy Policy]" on `/onboard/[token]`.
- **Cookies:** no cookie banner. For purely functional auth cookies (no analytics/marketing cookies observed) this is generally acceptable in AU, but confirm you add nothing tracking later without revisiting.

---

## 6. Missing features

**Must-have before real customers (workflow gaps a builder will hit week one):**
- **Bulk / resend-all document requests** and a clear "who hasn't responded" view — chasing is the core job.
- **CSV export / print of compliance status** — builders get audited and asked for evidence; they'll need to hand someone a list.
- **An expiry/compliance summary the builder actually sees** — right now expiry lives in emails + per-contractor pages; a dated "expiring in 30 days" worklist on the dashboard is table stakes (HazardCo-style).
- **Timezone correctness (M4)** — counts as a feature gap: "expired" must mean expired in their timezone.
- **Contractor can't be re-notified easily if the first email is missed** — given the deliverability risk (H3), a "copy upload link" button for the builder to send via SMS/WhatsApp themselves is high value.

**Nice later:**
- Multiple users per company / team seats (today it's one login per business).
- Project-gate: block assigning a non-compliant contractor to a project, or at least warn at assignment.
- Document OCR / auto-read expiry dates from the certificate.
- White-label / per-company branding on the contractor upload page.
- Audit log / history export for the builder.
- Webhook or calendar feed of upcoming expiries.
- SMS reminders (not just email) — big for trades.

---

## 7. What works well (don't touch)

- **Database tenant isolation** — genuinely strong, 15/15 attacks blocked. This is the hard part and it's right.
- **Storage lockdown** — private bucket, no anon access, server-side MIME + size re-validation against the *stored* object, short-lived signed URLs.
- **Stripe integration** — signature-verified webhook, card-upfront trial, correct trial→active email transitions, trial-abuse ledger keyed on normalized email, orphaned-subscription cleanup.
- **Auth hardening** — open-redirect guard, email normalization (+tag handling), JWT verified locally via JWKS in middleware.
- **No XSS, thorough HTML-escaping in emails, honeypot on the contact form.**
- **Code quality** — pure-logic modules with real unit tests, documented fail-open/fail-closed decisions, tolerant migration/schema-cache handling. This is not vibe-coded; it's carefully reasoned.
- **Upload UX on mobile** — clean, no horizontal overflow at 390px, clear per-file validation messages, multi-file per requirement.
- **Marketing + legal copy** — honest, no fake logos, pricing page matches enforced limits (5/25/∞ contractors etc.), no console errors anywhere, fast (<2s).

---

## 8. What I could NOT test, and why

- **Actual email delivery, rendering, and spam placement** — no access to the `pvirk0@outlook.com` inbox. Judged From-domain/SPF/DKIM/DMARC from DNS and templates from code. DKIM, SPF, and a DMARC record (`p=quarantine`) **do** exist for `unknwnmoving.store`, so mail is authenticated — but from the wrong-brand domain (H3).
- **Completing a real Stripe payment / trial→active conversion / failed-payment flow** — live mode, rules said no real card. Loaded checkout (confirmed `cs_live`, A$ pricing, $0 due today, 7-day trial) and verified the cancel→return path; the rest is judged from the webhook + sync code (which looks correct).
- **Password-reset and account-deletion email round-trips** — both need the emailed link/code; no inbox. Code paths reviewed.
- **Cron execution** (`expiry-reminders`, `trial-reminders`) — protected by `CRON_SECRET` which I don't have; both correctly return 401 unauthenticated. Logic reviewed (the M4 timezone bug is from that review + a reproduction script).
- **Load / concurrency** — rules said don't hammer production.
- **Whether any real customer data already has mismatched file paths** (C1 pre-existing abuse) — would need a service-role query I didn't run.

---

## 9. Suggested order of work (hand these to Claude Code as batches)

**Phase 0 — stop-the-bleeding (before any real customer, ~1 day)**
1. Fix C1: prefix-check `file_path` in both file-URL functions + add the insert-side DB guard on `contractor_document_files`; scan for any existing mismatched rows.
2. `npm i next@16.4.1` (+ `sharp`, `source-map-js` via `npm audit fix`), redeploy, re-run `npm audit`.

**Phase 1 — trust & compliance (1–2 days)**
3. Fill the Privacy Policy placeholders (name, ABN, real privacy email, data-location line, NDB mention) and fix the `mailto:`.
4. Stand up a real sending domain (`subbies.au`) in Resend; set `RESEND_FROM`; add the policy link to the contractor upload page.
5. Turn on email confirmation; add signup + contact-form + onboard-route rate limiting.

**Phase 2 — correctness & hardening (1–2 days)**
6. Fix the timezone bug (M4) in `daysUntilExpiry` and `isPast` — compute "today" in `Australia/Brisbane`.
7. Add security headers (CSP, frame-ancestors, nosniff, referrer-policy) in `next.config.ts`; set `Secure` on auth cookies.
8. Raise password min length + add a strength check so UI and server agree.
9. Make Stripe customer creation lazy (M5); drop duplicate `subscriptions` columns (M8).

**Phase 3 — growth & polish (1 day)**
10. `robots.ts`, `sitemap.ts`, `opengraph-image`, per-auth-page titles, branded `not-found.tsx`, fix the `subbies.com` mock text, and the post-submit stale-state refresh (L2).

**Phase 4 — product gaps (ongoing)**
11. Dashboard "expiring in 30 days" worklist, CSV/print export, resend-all + copy-link, and project-assignment compliance gate.
