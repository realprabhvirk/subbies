# Subbies — Security & Correctness Audit

Branch: `audit/full-security-pass` (nothing merged to `main`). Date: 2026-09-18.

## 1. Executive summary

The app is in better shape than a solo AI-built SaaS usually is. Multi-tenant isolation is real: every table created by a tracked migration has row-level security switched on with correctly-scoped read *and* write policies, every server action re-checks ownership in code, and the service-role key never reaches the browser. The Stripe webhook verifies signatures, billing sync is idempotent, plan limits are enforced on the server, the document bucket is private and only ever reached through short-lived signed URLs, and no secret has ever been committed (checked the full git history, not just the current files).

The scariest things found were not leaks — they were two *assumptions*. The `companies` table and the `contractor_tokens` table were created by hand before the migrations folder existed, and nothing in the repo could prove that `companies` actually has RLS on, or that upload tokens are actually random. Every other policy chains through `companies`, and the whole no-login upload flow rests on the token. Migration 0012 makes both true unconditionally; it is a no-op if they already were.

Signup was fragile by design: it created the company row from the browser, which only works because email confirmation is switched off. That is now fixed so it works either way, and any account already stuck with a login but no company can finish setup itself instead of hitting a dead end. A real open redirect on the login page is closed.

Two things need your decision, not code: the advertised **"automatic expiry reminders"** feature has never been built (customers set the schedule, nothing sends it), and a testing exemption for your own email is still in production code.

## 2. What to run, in order

| Step | What | Type |
|---|---|---|
| 1 | Run `supabase/migrations/0012_companies_rls_and_token_hardening.sql` in the Supabase SQL editor | **Database — run it** |
| 2 | Merge this branch's PR to `main` (Vercel deploys) | Code |
| 3 | `curl -H "Authorization: Bearer $CRON_SECRET" https://subbies-hazel.vercel.app/api/health/billing` and read `healthy` / `prices` | Verification |
| 4 | Decide on the flagged items in §5 | Founder |

Order between 1 and 2 doesn't actually matter — 0012 is purely additive and the new code relies on nothing the old code didn't — but migration-first means RLS is guaranteed before anything new touches it. 0012 is safe on the live database with no maintenance window: metadata-only, idempotent, reads and changes no rows. The one precondition (no `contractor_tokens` row with a null token) fails loudly and changes nothing if false.

## 3. Findings

Severity: **Critical** = active cross-tenant leak or exposed secret · **High** = isolation/auth/billing integrity risk or a broken core flow · **Medium** = real exposure with a mitigating factor · **Low** = worth knowing, not urgent.

| # | Sev | Where | What | Status |
|---|---|---|---|---|
| 1 | High | `companies` table (hand-created) | RLS is asserted in comments in 0001/0003 but never defined in any tracked migration. Every other policy resolves `company_id in (select id from companies where user_id = auth.uid())`. If RLS were actually off, any signed-in user could read and update every company's name, address and phone. | **Fixed** — 0012 enables RLS and adds select/insert/update own-row policies. No delete policy (deletion is service-role only). |
| 2 | High | `contractor_tokens` table (hand-created) | `createContractor` inserts only `{contractor_id}` and reads `token` back — the DB default is the token's *entire* source of randomness, and nothing in the repo says what that default is. No unique index visible either. | **Fixed** — 0012 sets `default gen_random_uuid()` (122 random bits, CSPRNG), `not null`, and a unique index. Existing tokens untouched. |
| 3 | High | `app/signup/page.tsx`, `dashboard-gate.tsx` | Signup created the `companies` row from the browser after `signUp()`. Only works when Supabase returns a *session* — i.e. only while email confirmation is off. Any other case left a login with no company, and the recovery screen said "sign up again", which fails with "already registered". Dead end. | **Fixed** — see §4. |
| 4 | High (correctness) | `app/(marketing)/page.tsx`, `lib/billing/plans.ts`, `document_types.reminder_days` | "Automatic expiry reminders" is on the homepage, in every plan's feature list, and configurable per document type — and **nothing sends them**. The only cron is trial reminders. Also, `recomputeContractorStatus` says time-based expiry is "handled by the Phase 2 scheduled job", which doesn't exist: a contractor's cached status never flips to expired on its own (the dashboard tiles compute it live so they're right; the contractors list badge is not). | **Flagged** — this is a feature to build, not a bug to patch. See §5. |
| 5 | Medium | `app/login/page.tsx` | Open redirect: `?redirectTo=` was passed straight to `router.replace()`. `/login?redirectTo=https://evil.example` would log the user in for real, then hand them to another site. Classic phishing shape. | **Fixed** — `lib/auth/redirect-path.ts`; only same-origin paths allowed (blocks `//host`, `/\host`, schemes). 8 tests. |
| 6 | Medium | `lib/auth/normalize-email.ts` | `pvirk0@outlook.com` is hard-coded as exempt from +tag collapsing, marked "TEMP, remove before production launch". Only affects that one inbox, so no customer risk — but it's a deliberate hole in an anti-abuse control, in a live billing app. | **Flagged** — your call. Removing it is a one-line delete plus its 4 tests. |
| 7 | Medium | `lib/billing/entitlements.ts` | A live, paying subscription whose Stripe price doesn't match any `STRIPE_PRICE_*` here gets `plan = null` → **every creation limit is 0**. The company is charged and can't add a contractor, and nothing said why. | **Partially fixed** — now logs loudly with the company id. Limits deliberately *not* widened (that's a billing decision). `/api/health/billing` is the check that catches the config. |
| 8 | Medium | `/onboard/[token]` | Tokens never expire and there's no "rotate link" action — a forwarded email is a valid link forever. No rate limiting on the public endpoint. Mitigations: 122-bit random tokens can't be guessed; `submitStagedDocuments` refuses once a document is approved; every write re-validates the token and ownership; Storage enforces size/type itself. | **Flagged** — expiry is a product decision (UI promises "come back any time"); rate limiting needs infra (Vercel WAF or Upstash). |
| 9 | Medium | Supabase Auth config | Email confirmation is off, so anyone can sign up with an address they don't own. What that actually buys them: nothing until they enter a card at Stripe Checkout — creating contractors (and therefore sending any email) is gated on `paidAccess`. So it's not an open spam relay. | **Flagged** — code now behaves correctly with confirmation on *or* off (finding 3), so turning it on is safe whenever you want. If the card gate is ever loosened, turn confirmation on first. |
| 10 | Medium | Storage | A file uploaded via signed URL whose `submitStagedDocuments` never completes (tab closed, or the table-missing bug of last week) sits in the bucket forever — orphaned, invisible, counting against the 1 GB tier. Only account deletion cleans a company's tree. | **Flagged** — needs a cleanup job. See §6. |
| 11 | Low | `app/api/webhooks/stripe/route.ts` | `checkout.session.completed` and `customer.subscription.created` both call `syncSubscription` + `sendActivationEmail`. If they arrive concurrently both can read `prevStatus = none` before either writes → two welcome emails. No money impact. | **Flagged** — fix is the same conditional-update pattern `markTrialReminderSent` already uses. |
| 12 | Low | `createContractor` | Contractor → documents → token is three inserts with a manual rollback, not a transaction. A crash between them leaves a contractor with no token. | **Flagged** — an RPC would make it atomic; not worth it at current volume. |
| 13 | Low | `/contact` | Honeypot only, no rate limit — can spam your `CONTACT_EMAIL` inbox. | **Flagged** |
| 14 | Low | `lib/email/resend.ts` | Sender falls back to `Subbies <onboarding@unknwnmoving.store>` if `RESEND_FROM` is unset. Your item 4. | **Flagged** — DNS/domain decision, not code. |
| 15 | Info | Supabase Storage | Free tier, 1 GB project-wide. Not enforced or surfaced anywhere in-app. Your item 5. | **Flagged** |

### Confirmed not an issue (checked, nothing to do)

- **Secrets:** no `.env*` ever committed in any branch; no key-shaped string anywhere in git history; `.env*` gitignored; only `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` / `_APP_URL` are public (all safe by design); no hard-coded fallback secrets; `SUPABASE_SERVICE_ROLE_KEY` is only ever imported by files marked `server-only`, `"use server"`, or route handlers (all 13 checked individually); no `"use client"` file imports anything server-side.
- **RLS on every migration-tracked table:** `document_types`, `contractors`, `contractor_documents`, `contractor_tokens`, `contractor_document_files`, `projects`, `project_contractors` — `for all` with both `using` and `with check` scoped through `companies.user_id = auth.uid()`. `notifications` select+update only. `subscriptions` select only (writes are service-role). `account_deletion_codes` and `used_trial_emails` — RLS on, zero policies, service-role only.
- **Every service-role code path re-checks authorisation in code** before touching data: token resolution (`resolveOnboardingToken`) + per-document `contractor_id` ownership on every onboard action; `CRON_SECRET` on cron and health routes; Stripe signature on the webhook.
- **Every `[id]` route/action** filters by `company_id` in code *and* is covered by RLS (double-checked `approve/reject/revoke/resend/updateExpiry/getDocumentFileUrl`, `assign/removeContractor`, `update/deleteDocumentType`, `updateProject`, contractor and project detail pages). No ID-swap path found.
- **Stripe:** signature verified with `constructEventAsync`; sync is an upsert on `company_id` (retry-safe); `company_id` comes from our own signed subscription metadata or the DB, never the client; plan limits enforced in the server actions, not the UI; `/billing/return` reconciles straight from Stripe so a late or failed webhook can't strand a customer.
- **Storage:** bucket `public = false`; size and MIME enforced by the bucket itself *and* server-side in the actions (client checks are convenience only); signed download URLs 120–300 s; paths are `company/contractor/document/<random-uuid>.<ext>` — no user-supplied filename in the path, no enumerable structure; the original filename is stored in a DB column and rendered as text by React.
- **Injection / XSS:** no `dangerouslySetInnerHTML`, no `.rpc()`, no raw SQL. Every user-supplied string in every email template goes through `escapeHtml`.
- **Auth:** session verified server-side via `getClaims()` (real signature check) in both middleware and the DAL; password reset uses Supabase's single-use time-limited tokens, doesn't reveal account existence, and strips the token from the URL after exchange.
- **API hygiene:** route handlers only export the methods they serve (others 405); server actions are same-origin by construction; error responses are generic strings with the real error going to `console.error`.
- **Performance:** no N+1 — dashboard, contractor list, project list all batch with `.in()` or PostgREST embeds.
- **Structure / deps:** nothing under `src/`; `npm audit` reports 0 vulnerabilities at every severity; every dependency is imported (`react-dom` is the React runtime peer).

## 4. The two known bugs — root cause

### Signup

**What was actually wrong.** After `supabase.auth.signUp()`, the signup page immediately did `supabase.from("companies").insert(...)` through the browser client. That insert is governed by the `companies` RLS policy, which requires `auth.uid() = user_id` — so it needs a session. `signUp()` only returns a session when email confirmation is *off*. The moment confirmation is on (or Supabase returns a user without a session for any other reason), the insert is silently refused, the page shows "couldn't set up your company, contact support", and the account exists in Auth with no company. Logging in then lands on a screen that says "sign out and sign up again" — which fails with "already registered". This is very likely the exact sequence behind the "signup broken" report, and it's why confirmation had to stay off.

(The earlier fix in `e8de6ac` was a *different* signup-adjacent bug — the trial ledger denying every new customer their 7 days — and is already resolved.)

**The fix**, code only, no migration:

- `signUp()` now carries `company_name` in the user's metadata, so the name survives to the first signed-in visit.
- `lib/auth/signup-logic.ts` classifies the result honestly: session → create the company now; user-but-no-session → show "check your email", don't attempt an insert that can't succeed; empty-identities → "already registered". 9 tests.
- The dashboard gate's dead-end screen is now a one-field **"Finish setting up your account"** form, prefilled from that metadata, backed by a server action that inserts the company for the *signed-in* user through the RLS-scoped client (so it can only ever create a company the caller owns). Idempotent.
- Net effect: signup works with confirmation on or off, and every account already stuck today can self-recover on next login.

An `auth.users` trigger was considered and rejected — commit `abc521d` already made that call ("Supabase manages that schema; triggers against it are fragile across upgrades") and I saw no reason to overturn it.

### Stripe checkout

**What I found.** The code path is complete and correct: plan id validated → entitlement re-checked → price id resolved from env (trimmed) → Stripe customer created/reused → Checkout Session with trial settings and signed metadata → `/billing/return` pulls the subscription straight from Stripe and syncs it → dashboard reads the synced row. Every failure mode I could construct traces to **environment configuration, not code**: a `STRIPE_PRICE_*` value from test mode used against a live `STRIPE_SECRET_KEY` (Stripe returns `resource_missing`), a missing or whitespace-padded price id, or a webhook secret mismatch (which the return-page reconcile already survives). Commit `59e8a1e` already made every one of those surface as a specific message naming the env var, and `/api/health/billing` verifies all of them against the deployed environment in one request.

**What I could not do:** execute a checkout against your live Stripe account or read Vercel's logs from this sandbox. Step 3 in §2 is the verification — if `healthy: true` and every price shows `ok: true` with `livemode: true`, checkout is configured correctly.

## 5. Flagged, not fixed — and what to do

| # | Item | Why not fixed here | Recommended next step |
|---|---|---|---|
| 4 | Expiry reminders don't exist | New feature, not a hardening fix. Also a product truth issue: it's advertised and sold. | Decide: build it (a daily cron reading `document_types.reminder_days` + approved docs' `expiry_date`, emailing the contractor and stamping a sent marker — same shape as the trial cron), or remove the claim from the homepage and plan lists until it exists. Either way, add a status-refresh step so `contractors.status` flips to `expired` on time. |
| 6 | Founder email test exemption | You may be actively using it for QA. | Delete the `NORMALIZATION_EXEMPT_BASE_EMAILS` set and the `if` that reads it in `normalize-email.ts`, plus the four "TEMP" tests. Use a non-Gmail/Outlook domain for QA accounts instead — those aren't collapsed. |
| 7 | Paid + unknown plan = 0 limits | Widening limits on a misconfigured account is a billing decision. | Run `/api/health/billing`. If you'd rather fail open (give Starter limits and log) say so — it's a 3-line change. |
| 8 | Token expiry / rotation / rate limiting | Product decision + infrastructure. | Cheapest meaningful step: a "Send a new link" action that rotates the contractor's token (one `update … set token = gen_random_uuid()`), so a leaked link can be killed without deleting the contractor. Rate limiting: Vercel WAF rules on `/onboard/*` are the zero-code option. |
| 9 | Email confirmation off | Founder decision. | Safe to turn on now — the code handles it. Turning it on also closes the unverified-signup trial-abuse angle. Check the Supabase redirect allowlist includes your production URL first (same gotcha as password reset). |
| 10 | Orphaned storage objects | Needs a cleanup job. | A weekly cron that lists each `company/contractor/document/` prefix and removes objects not present in `contractor_document_files`. Report-only mode first. |
| 11–13 | Duplicate welcome email, non-atomic contractor create, contact spam | Low, no customer-visible harm today. | Batch into a later pass. |
| 14, 15 | Sending domain, storage tier | Infra / billing, not code. | Verify SPF/DKIM/DMARC for whichever domain you settle on in Resend; watch bucket size in the Supabase dashboard. |

**Not done from this sandbox, disclosed plainly:** no Vercel preview was exercised, no live database or Stripe call was made — this environment has no credentials for either. Opening the PR triggers a Vercel preview automatically; migration 0012 and the health-check curl are yours to run. Everything else was verified by reading every file on the path, by 127 passing tests (17 new, covering the exact failure shapes of findings 3 and 5), and by a clean `tsc` / `eslint` / production build.

## 6. If I had more time

- Build the expiry-reminder cron (finding 4) — it's the one place the product promises something it doesn't do.
- Storage orphan cleanup (finding 10), report-only first.
- Token rotation action + Vercel WAF rate limit on `/onboard/*` (finding 8).
- Make the welcome email decision atomic (finding 11) and contractor creation transactional via an RPC (finding 12).
- Generate DB types with `supabase gen types typescript` so hand-written `lib/types.ts` can't drift from the schema — which is exactly how two hand-created tables ended up unverifiable.
- Replace the create-next-app README with the actual env var list and the migration order.
