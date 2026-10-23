# Subbies: Full Project Context

> **Purpose:** one file that carries everything about Subbies so any AI (or human) can pick the project up cold: what it is, why it exists, every feature added/removed/changed, every bug and what caused it, every decision and why, what is merged vs not merged, and what's next.
>
> **Snapshot:** written 2026-10-23. Repo state = `main` at commit `41bfcc5` (117 commits, 2026-08-30 to 2026-10-17).
>
> **Sources used:** the full git history on `main` (every commit message), the unmerged side branches (PRs #9 to #12), `AUDIT_REPORT.md`, the migrations, key source files, the founder's original planning brief, saved project notes, and summaries of past Claude chats on this project.
>
> **Handling note:** this repo is currently private. This file describes security status and legal gaps. If the repo is ever made public, review sections 9, 12 and 13 first. **No secrets, keys or passwords are in this file** (env var *names* only).

---

## Table of contents

1. TL;DR: where things stand right now
2. What Subbies is (product, positioning, non-goals)
3. Goals, business model and validation plan
4. Market and competitors
5. How the product works (the core loops)
6. Pricing, trials and billing: full history
7. Tech stack, architecture and conventions
8. Data model, migrations and storage
9. Security and trust posture
10. Design and brand history
11. Complete build timeline (phase by phase)
12. Branches, PRs and what is NOT on main
13. Open items, risks and pre-launch checklist
14. Decision log: added, removed, reversed, rejected
15. Bugs and root causes (the lessons)
16. Ideas discussed but not built
17. Founder, ways of working and rules for AI agents
18. Appendix: routes, env vars, tests, file map

---

## 1. TL;DR: where things stand right now

- **Subbies** is a live, deployed, billing-enabled SaaS that lets construction and trade businesses onboard subcontractors, collect compliance documents (insurance, licences, workers comp), review/approve them, and track expiry with automatic reminders. Contractors never create an account: they use a secure emailed link.
- **Production:** Vercel, auto-deploy from GitHub `main`. Prod URL used so far: `subbies-hazel.vercel.app`. Billing runs on **live Stripe keys** (deliberate founder choice; the 7-day trial is the safety window).
- **Core loop is complete and personally tested end to end by the founder:** signup, plan pick, Stripe trial, add contractor, onboarding email, contractor uploads (multi-file), company reviews (approve/reject with reason), status computation, dashboard, notifications, expiry reminders, contractor management (edit, delete, archive, notes, resend).
- **Latest thing merged to `main` (2026-10-17):** a full visual overhaul ("design overhaul v3": Mona Sans + JetBrains Mono, hairline "register" style, status stamps, editorial marketing site, mobile-first contractor upload page). The colour palette was deliberately left unchanged.
- **Biggest open flag:** a second audit (2026-10-16) found issues that are fixed on **four unmerged branches (PRs #9 to #12)** but **not on `main`**. The most serious is a cross-company document access bug (C1) plus a critical Next.js CVE (fixed by bumping Next 16.3.3 to 16.3.8). PR #9 should merge cleanly; PRs #10 to #12 need rebasing because the design overhaul touched the same files. Three new migrations (0016, 0017, 0018) exist only on those branches. See section 12.
- **Not yet validated with real paying customers.** The repo and chats show no evidence of paying customers yet. Founder's stated targets: $200 / $500 / $1,000 MRR.
- **Company not yet legally registered.** Founder is a sole trader with an ABN; the legal pages still have placeholders for business name/ABN/contact email.

---

## 2. What Subbies is

**One-liner:** "Stop chasing subcontractors for expired documents."

**What it does:** A construction business (the "company") adds subcontractors ("contractors" in the UI), chooses which documents each must provide, and Subbies emails them a secure link. The contractor uploads files on their phone, no login. The company reviews each document, approves or rejects (with a reason, which is emailed back). Approved documents carry an expiry date; Subbies emails the contractor before expiry on a schedule the company sets per document type, and escalates to the company once something lapses. A dashboard shows what needs attention, worst first.

**Positioning decision (made during MVP validation):** the primary hook is **contractor onboarding**, with **expiry tracking as the retention layer**. This was a deliberate scope and messaging choice, repositioned away from "pure expiry tracker".

**The "simple middle ground" thesis:** big incumbents (HazardCo etc.) are broad, expensive and overkill for a small builder. Newer competitors identified the same problem but (per the founder's hands-on testing) shipped unpolished products. Subbies aims to be focused, affordable, polished, reliable and easy for contractors to use.

**Explicit non-goals (from the founder's original brief, still the thesis):**
- NOT a replacement for Xero, Tradify, ServiceM8, Procore, a CRM or full construction management software. It should plug into an existing workflow.
- No contractor accounts or contractor portal for the MVP.
- No AI as a selling point (possible later: reading expiry dates off uploaded documents).
- No mobile app, enterprise features, dozens of integrations, or complex analytics early on.

**Trust principle:** the app stores important business documents, so it must feel professional, reliable, clean, secure and simple. Avoid broken links, placeholder content, fake features, dead buttons and an obviously "vibe-coded" look. The founder repeatedly requires that builds **do not look like generic AI output**.

---

## 3. Goals, business model and validation plan

### Business goal
Bootstrapped recurring-subscription SaaS. No investors planned. Proof of concept = first paying customers, then $200 / $500 / $1,000 MRR. Infrastructure budget in the original brief: roughly AUD $50 to $100/month, free tiers where possible (Vercel, Supabase, Cloudflare, GitHub).

### Original validation plan (from the founder's planning brief)
The brief was explicit that the idea was a hypothesis and the next step was real-world validation before heavy building:
1. Talk to real construction businesses (target area: Beenleigh, Yatala, Logan, Ormeau, northern Gold Coast, wider South-East Queensland; small and medium builders managing multiple subcontractors).
2. Confirm the problem repeats; learn how they handle it today (spreadsheets, email, folders) and what they dislike about existing tools.
3. Get several businesses to test a beta; define the MVP from their feedback; build the smallest functional MVP; give it to real businesses; fix and improve; then introduce paid subscriptions.
- Interview rule: ask about **existing behaviour**, never "would you use my app?". Strong signals: showing a real spreadsheet, complaining about the current process, asking when it's available, agreeing to beta or to pay.
- **Founding-customer idea:** first few customers get a locked discounted price in return for feedback and support (proposed, never confirmed as built).

**Reality check:** the build ran well ahead of the validation plan. The product is live and billing-enabled; customer discovery results are not recorded anywhere in the repo or the chats reviewed. Treat real customer validation as the biggest unresolved risk, not any technical item.

### Original pricing hypothesis (from the brief, superseded)
Starter ~$29 (up to 20 subs), Business ~$49 to $59, Pro ~$99, plus founding-customer pricing. This changed (see section 6).

---

## 4. Market and competitors

From the founder's hands-on research (stated as observations, not facts about those businesses):

- **HazardCo**: the most serious and established competitor. Broad construction safety and contractor management; likely more expensive and more than a small builder needs. Needs more investigation.
- **SubPass**: personally tested. Observed: hard to find on Google, heavy "vibe-coded" look, text errors, auth visibly tied to a builder tool, broken Facebook/LinkedIn links, checkout accepted test cards, purchase did not unlock the app. Assessment: *"Based on hands-on testing, the publicly available product experience appeared incomplete and unreliable."* Do not claim they have no customers.
- **Vettit**: personally tested. Observed: poor navigation, vibe-coded look, unreliable functionality. Hosting on Vercel is **not** evidence of anything (many real apps use it). Same careful wording rule.
- A competitor screenshot was used once purely for *scale/contrast principles* in the scale-up UI pass (explicitly not copying design, colours or layout).
- The marketing copy on "How it works" had one unverifiable competitor claim softened during the v3 redesign: **never claim things about competitors that can't be backed up.**

---

## 5. How the product works (the core loops)

### 5.1 Company side (has an account)
Signup (company name, email, password, 18+/terms checkbox) -> forced plan selection at `/onboarding` -> Stripe Checkout with 7-day trial -> dashboard.

Main app areas (all under `/dashboard`):
- **Dashboard:** figures row led by the compliant share; "Needs you" queue sorted worst-first (expired > rejected > awaiting review) with plain-words reasons; side list "Expiring in the next 30 days"; project warning when a project has a non-compliant contractor; first-run setup panel for new companies.
- **Contractors:** register table (documents meter, status stamp, added date, resend). Whole row clickable. Add-contractor is a two-step form (details, then pick documents).
- **Contractor detail** (`/dashboard/contractors/[id]`): header (phone, ABN), tabs: Documents, Projects, Activity, Details, Notes. Per-document actions menu. Resend panel with checkboxes + select all. Document history (archived records).
- **Document types:** company-wide CRUD (name, default validity in months, reminder schedule).
- **Projects:** light job-assignment feature. Assign contractors to projects, see each contractor's compliance inline, project-level "N not compliant" banner. **Not** project management (see section 16).
- **Settings:** Company (name, address, phone), Account (email, change password, delete account), Billing (plan, usage vs limits, manage billing, cancel).
- **Notifications bell:** in-app, created when a contractor submits; streamed so it never blocks page render.

### 5.2 Contractor side (no account)
Emailed link `/onboard/[token]` -> mobile-first "docket" page: numbered document cards, big dashed "Add a file or take a photo" target, stage multiple files locally, one **Submit**. Files upload straight to private Supabase Storage via one-time signed URLs (bypasses function body-size limits). Shows status per document, rejection reason in its own panel, progress bar, calm all-done state. Invalid/expired link page explains next steps.

### 5.3 Review flow
Contractor submits -> document `uploaded`, company notified (in-app + email, best effort) -> company views files via short-lived signed URLs, sets expiry (prefilled from the document type's default months), **approves** or **rejects with a required reason** (reason emailed to the contractor via their existing link) -> contractor status recomputed -> when everything is approved the contractor gets an "approved to work" email.

### 5.4 Document and contractor statuses
- Document status: `requested`, `uploaded`, `approved`, `rejected`, `revoked` (company cancelled the request; excluded from compliance entirely).
- Contractor status (derived, cached in a column), worst first: `expired` > `attention_required` (a rejection) > `awaiting_review` > `pending` > `approved`. Revoked docs are ignored; a contractor with only revoked docs reads as `pending`.
- "Expiring soon" window = 30 days (dashboard tile and per-document expiry badge share the number).
- The cached status is refreshed on every document change **and** by the daily expiry cron (because time passing is not a document mutation).

### 5.5 Expiry reminders (built 2026-09-19, PR #8)
- Daily cron `/api/cron/expiry-reminders` at 21:00 UTC (7am AEST / 8am AEDT).
- Per document type the company picks a reminder schedule via preset dropdown: Standard (30/14/7), Aggressive, Minimal, No reminders, or Custom removable day-chips (max 10 reminders, max 3650 days).
- One email per contractor batching everything due, reusing their existing upload link and stating the real days left. When a document lapses the **company** gets an escalation email.
- Idempotency: `expiry_reminder_log` has a unique key on `(document, expiry_date, threshold)`. The expiry date is in the key so a renewal starts a clean cycle (documents are updated in place).
- Fires on `daysLeft <= threshold` (not equality) so a missed day catches up; skipped windows are burned so they don't fire retroactively.
- `past_due` subscriptions are treated as active (don't drop compliance reminders while Stripe retries a card).
- Log read **fails closed** (can't read log -> send nothing; re-emailing everyone is worse). Supports `?dry=1` dry run. Gated by `CRON_SECRET`.
- *Known issue fixed only on an unmerged branch:* date maths uses UTC, so around the 21:00 UTC run "expires today" can read as "1 day left" in Brisbane. PR #11 (M4) fixes it with a Brisbane-time helper. See section 12.

### 5.6 Contractor management (built 2026-09-28)
- **Edit** contractor (business name, contact, email, phone, trade, ABN). ABN = 11 digits, spaces stripped, empty allowed, deliberately **not** the ATO checksum.
- **Delete** contractor: strictly ordered so any failure leaves something recoverable (confirm ownership, expire link, remove files, then delete the row which cascades). If any file can't be removed, nothing is deleted (the rows are the only record of which files belong to whom).
- **Resend** requests from three places all go through one sender (`lib/contractors/request-email.ts`): list button, per-document "Send new request", and the checkbox panel. **5-minute cooldown** claimed with one conditional UPDATE (no double-click double send), fails **open**, restored if the send fails. Works on **any** status, including approved.
- **Resend on an approved document** adds a *second* row (`replaces_document_id`) so the approved copy stays valid and the contractor's status doesn't move until the new copy is uploaded **and approved**; approving it auto-archives the old one (kept, not deleted). Email says "updated copy requested" when a valid copy exists.
- **Archive** a document (kept as a private record, ignored by compliance, dashboard, reminders and emails; a "Missing" placeholder takes its place if it was the only live copy) and **permanent delete** (files first, then record; deleting the only live copy resets the same row to `requested` so the requirement never vanishes).
- **Private notes** per contractor (timestamped, newest first, delete with confirm, no editing). Notes are never visible to contractors or in emails; a test enforces that no contractor-facing file references the notes table.
- **Link expiry:** new contractors' links get 60 days; sending anything to a contractor extends it. Existing links stay `NULL` = never expire (so no existing email in someone's inbox was silently fused). The link is **refreshed, not rotated** (rotating would break links in earlier emails: the "link isn't valid" bug).
- A structural test (`lib/document-reads-guard.test.ts`) scans the source and fails if any query on `contractor_documents` neither filters `archived_at` nor writes.

### 5.7 Account lifecycle
- **Password reset:** `/forgot-password` -> neutral "check your email" (doesn't reveal if the account exists) -> `/reset-password` (handles expired/invalid/network-failed links gracefully, strips the token from the URL) -> back to login.
- **+tag email abuse blocked:** `prabh+1@gmail.com` style aliases are collapsed for gmail/googlemail/outlook/hotmail/live only (other providers may treat `+` literally). Applied at signup, login and forgot-password. A **TEMP exemption for the founder's own Outlook address** exists in code for QA and must be removed before real launch.
- **Account deletion:** Settings -> Account. Warning, then emailed 6-digit code (10-min expiry, 5 attempts, 60s resend), then a consent checkbox screen (checked server-side too). On confirm: cancel Stripe immediately (stop everything if that fails), write the email to a permanent trial ledger, delete the Supabase auth user (cascades to company and everything under it), wipe the storage bucket prefix. Preflight checks the ledger is reachable before anything irreversible.
- **Trial abuse prevention:** a company that subscribed before, or an email that used a trial on a now-deleted account, gets no trial (charged immediately; the onboarding page says so before checkout). The ledger lookup **fails open**.

---

## 6. Pricing, trials and billing: full history

| Date | State |
|---|---|
| Brief (pre-build) | Hypothesis: Starter ~$29 (20 subs), Business ~$49-59, Pro ~$99 |
| 2026-08-30 (Phase 2.7) | Stripe built on **live keys**. Plans $29/$49/$99 AUD; contractor limits 20/75/unlimited; **14-day trial** with card up front |
| 2026-08-30 (2.4) | Marketing `/pricing` showed $29/$49/$99 as "indicative placeholders" |
| 2026-08-31 (3.2) | **New pricing A$19 / A$39 / A$79.** Limits per plan: Starter 5 contractors / 7 doc types / 10 projects; Business 25 / 15 / unlimited projects; Pro unlimited everything. 14-day trial **removed** entirely |
| 2026-08-31 (3.3) | Card-free **7-day free tier** with forced onboarding (free caps 3 contractors / 3 doc types / 2 projects) |
| 2026-09-04 | **Free tier removed.** Replaced by a **per-plan 7-day Stripe trial**: card required up front, A$0 today, converts on day 7. Chosen plan's real limits apply from day one. First-subscription only (re-subscribers get no trial, to stop a cancel/resubscribe free-week loop) |

**Current state (main):**
- Starter A$19, Business A$39 (featured), Pro A$79. `TRIAL_DAYS = 7`. Promo codes allowed at Checkout.
- `lib/billing/plans.ts` is the single source for prices, limits and features (marketing pages derive prices from it).
- Storage figures on the pricing page (200 / 750) are **marketing only and not enforced**; the real constraint is the shared Supabase project. PR #12 (unmerged) changes this to "Fair use / Unlimited" so the site stops advertising unenforced numbers.
- Limits are enforced server-side at creation time (`createContractor`, `createDocumentType`, `createProject`), with at-limit banners in the UI.
- **Access model:** `paidAccess` = status `trialing`, `active` or `past_due`. No plan / lapsed = **soft-lock** screen (dashboard replaced with plan selection, no data touched). Unrecognised Stripe price on a paying subscription = limits of 0 (logged loudly, deliberately not widened because that's a billing decision).
- **Flow:** onboarding -> `startCheckout` server action -> Stripe Checkout (subscription mode, `trial_period_days`, card required, `missing_payment_method: cancel`) -> `/billing/return` reconciles straight from Stripe (so a late/failed webhook can't strand a customer) -> dashboard reads the synced `subscriptions` row. Stripe is source of truth; the app only reads that table via RLS and writes via service role.
- **Webhook** `/api/webhooks/stripe`: signature verified; handles `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `customer.subscription.trial_will_end`, `invoice.payment_failed`. Idempotent upsert on `company_id`.
- **Emails:** trial started, subscription active (charged), payment failed, trial ending (day 5 and day 7). Daily cron `/api/cron/trial-reminders` at 09:00 UTC; each reminder claimed once per company (`markTrialReminderSent`, shared with the webhook so they can't double-send).
- **Cancel/resume** via Stripe API (`cancel_at_period_end`) from the billing tab with a confirm step; "Manage billing" opens the Stripe portal.
- **Orphaned subscriptions (2026-09-30):** if an account is deleted directly in the Supabase dashboard (bypassing the in-app flow), Stripe keeps billing a customer no company maps to. On `invoice.payment_failed` with no matching company, all live subscriptions on that customer are cancelled and `ORPHANED BILLING` is logged. **Gap:** this only catches failed charges, not working cards. A daily sweep cron was proposed but never approved or built.
- `/api/health/billing` (CRON_SECRET-gated) verifies in the deployed environment: env vars present, each price exists/active/recurring/AUD, amounts match, key and price mode (test/live) agree, subscriptions table columns exist. Never returns secrets.
- Checkout failures now show the *real* reason (`describeBillingError` names the env var for a missing price, flags auth/permission failures), instead of one generic message.

---

## 7. Tech stack, architecture and conventions

### Stack
- **Frontend/app:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, lucide-react icons.
- **Backend/DB/Auth/Storage:** Supabase (Postgres, RLS everywhere, Auth, private Storage bucket).
- **Hosting:** Vercel with GitHub auto-deploy and preview deployments.
- **Email:** Resend (sending domain `unknwnmoving.store`; see risks). Table-based inline-style HTML templates with plain-text parts.
- **Payments:** Stripe (live mode).
- **Design:** Claude Design produced the design systems; Claude Code is the primary implementation tool.
- **Dev machine:** the founder's Windows desktop (PowerShell). Most agent work happens in cloud sandboxes against the GitHub repo.
- Dependencies are deliberately minimal: `@supabase/ssr`, `@supabase/supabase-js`, `lucide-react`, `next`, `react`, `react-dom`, `resend`, `stripe`. No test framework (uses Node's built-in `node --test`).

### Hard structural conventions
- **`app/` and `lib/` live at the project root. NEVER under `src/`.** `@/*` resolves to the project root. Creating `src/app/...` once caused a big silent-404 debugging detour.
- **Next.js 16 has breaking changes** (e.g. `proxy.ts` replaces `middleware.ts`). `AGENTS.md` says: read the relevant guide in `node_modules/next/dist/docs/` before writing Next code.
- **Pure `*-logic.ts` modules** hold decisions with no I/O and no `server-only`, so they run under plain `node --test`. Files that touch the service-role client import `server-only` and can't be unit-tested directly. This split is used everywhere (signup, redirects, deletion codes, trial eligibility, reminders, resend/archive/delete rules, notes, ABN, etc.).
- **Service-role key is server-only.** Imported only by files marked `server-only`, `"use server"`, or route handlers. Never reaches the browser.
- **Every service-role code path re-checks authorisation in code** (token + ownership), because RLS does not apply to the service role.
- **Fail-open vs fail-closed is decided per feature, on purpose:** trial ledger = open, resend cooldown = open, token expiry parse = open, error classification default = transient; but the reminder log = **closed**, and the account-deletion preflight = closed. Rule of thumb: an anti-abuse/nice-to-have check that breaks must never block legitimate users; a check whose failure would cause an irreversible or mass action must stop.
- **Don't let a display-only query take down a load-bearing one** (the "link shows invalid" bug): fetch decorative data in a separate query and swallow-and-log its failure.
- **Never swallow errors.** Classify and log them (`lib/save-error-logic.ts` classifies Postgres/PostgREST errors as transient vs permanent).
- **One way to send email** (`lib/email/template.ts` + a private `send()` wrapper) and **one sender for resend requests**.
- **Dates:** `expiry_date` is a Postgres `date` (no zone). Reminder maths is UTC-pinned on main; PR #11 moves compliance "today" to `Australia/Brisbane`. Notes timestamps and emails are pinned to `Australia/Sydney`. (Known inconsistency between Sydney and Brisbane pinning: only matters around daylight saving.)
- **Copy rules:** no em dashes in user-facing copy (they read as AI-written); plain sentences. Keep the word "Contractors" (not "Subcontractors") in the UI. Don't add nav items for pages that don't exist; don't add UI that does nothing (a search box with no search was removed from the mockup).
- **Env files:** `.env*` is gitignored. `.env.local` was once nearly committed to a public repo after being saved without its leading dot (caught by `git status`). Always check.
- **Migrations before merges.** Migrations are run by hand in the Supabase SQL editor. Shipping code before the migration it depends on broke production twice (a foreign-key violation; every new trial silently denied). Rule: write migration -> founder runs it -> confirm -> then merge. Migrations are idempotent and additive where possible, and code falls back gracefully on missing-column errors during the gap.
- **Performance patterns:** `getClaims()` (local JWT verification, no network hop) instead of `getUser()`; company + subscription fetched in one embedded query; independent queries run in `Promise.all`; the dashboard access gate sits inside `<Suspense>` with a skeleton that mirrors the real shell; notifications stream in a slot; Settings tabs are client state, not navigations.
- **Testing in the agent sandbox:** `npx tsc --noEmit` needs `npx next typegen` first; production builds need placeholder env vars; the sandbox can't reach Google Fonts (local builds fail on font loading even when code is correct) and often can't complete a live Supabase login, so verification uses Vercel's build status plus preview harnesses with real components and fake data.

---

## 8. Data model, migrations and storage

### Tables
- `companies` (id, user_id -> auth.users, name, address, phone, created_at). **Hand-created before migrations existed**; RLS now guaranteed by 0012.
- `document_types` (company_id, name, default_duration_months, reminder_days int[])
- `contractors` (company_id, business_name, contact_name, email, phone, abn, trade, status, created_at)
- `contractor_documents` (contractor_id, document_type_id, status, file_url [legacy], expiry_date, rejection_reason, reminder_count, archived_at, replaces_document_id, timestamps). One row per requirement, updated in place.
- `contractor_tokens` (contractor_id, token default `gen_random_uuid()`, unique, expires_at, last_request_sent_at). **Hand-created originally**; hardened by 0012.
- `contractor_document_files` (contractor_document_id, file_path, file_name, created_at): one row per uploaded file (multi-file support)
- `contractor_notes` (company_id, contractor_id, author, body, created_at), no update policy
- `notifications`, `projects`, `project_contractors` (soft remove via `removed_at`, unique active assignment)
- `subscriptions` (one per company; stripe ids, plan, status, current_period_end, trial_end, cancel_at_period_end, onboarding_completed_at, trial_reminder_day5_at, trial_reminder_day7_at)
- `account_deletion_codes`, `used_trial_emails`, `expiry_reminder_log` (RLS on, **zero policies**, service role only)

### Migrations on `main` (run by hand in the Supabase SQL editor, in order)
| # | What |
|---|---|
| 0001 | Company-scoped RLS for all dashboard tables |
| 0002 | Private `contractor-documents` bucket (15 MB cap; PDF, JPEG, PNG, HEIC, HEIF) + notifications table |
| 0003 | `companies.address`, `companies.phone` |
| 0004 | `projects` + `project_contractors` |
| 0005 | `subscriptions` (read-only RLS, writes via service role) |
| 0006 | Card-free free tier columns (**superseded**, columns dropped by 0007) |
| 0007 | Per-plan trials: reminder stamps, drop free-tier columns, send leftover free users back through onboarding |
| 0008 | Cascade-delete companies when the auth user is deleted (drops the FK by name, then a dynamic fallback) |
| 0009 | `account_deletion_codes` + `used_trial_emails` |
| 0010 | Guarantee cascade deletes on four hand-created tables' FKs |
| 0011 | `contractor_document_files` (+ backfill of existing `file_url`; `file_url` kept as unused legacy mirror) |
| 0012 | Guarantee `companies` RLS + `contractor_tokens.token` random/unique/not null |
| 0013 | `expiry_reminder_log` |
| 0014 | `contractors.abn` (+ check), `contractor_tokens.expires_at` (default set *after* adding the column so existing links stay NULL), `last_request_sent_at` |
| 0015 | `archived_at`, `replaces_document_id`, `contractor_notes` |

Also `supabase/find_plus_tag_duplicates.sql`: a read-only query to find existing accounts colliding under the +tag rule.

**Migrations that exist only on unmerged branches:** 0016 (DB triggers rejecting file paths outside the owning company's folder), 0017 (Supabase-backed rate limiter), 0018 (drop unused duplicate `trial_reminder_5_at` / `trial_reminder_7_at` columns lingering in the live DB). They must be run in Supabase before the matching code merges.

### Storage
- Private bucket, no storage RLS policies on purpose (service role only), size and MIME enforced by the bucket itself **and** server-side.
- Paths: `company/contractor/document/<random-uuid>.<ext>`. No user-supplied filename in the path; the original filename is stored in a DB column and rendered as text.
- Signed download URLs live 120 to 300 seconds. Archived files are the company's private record and a contractor link to one stops working the moment it's archived.
- Account deletion recursively wipes `${companyId}/` (storage has no FK to cascade from; this was missed at first). Per-contractor and per-document deletes are strict: a failed listing is an error, never "nothing to delete".
- Free-tier Supabase storage is **1 GB project-wide**: needs an upgrade at customer scale; nothing in-app measures it. There is no orphan-cleanup job (a half-finished upload leaves an orphan object).

---

## 9. Security and trust posture

### What's solid (verified by the 2026-09-18 audit, `AUDIT_REPORT.md`)
Multi-tenant RLS on every tracked table; every server action re-checks ownership in code; service-role key never client-exposed; Stripe webhook signature-verified and idempotent; plan limits enforced server-side; private bucket + short signed URLs; no secrets ever committed (full history checked); no `dangerouslySetInnerHTML`, no raw SQL, all email strings HTML-escaped; session verified with `getClaims()`; password reset uses single-use tokens and doesn't reveal account existence; `npm audit` clean at that time; 127 tests passing at that time.

### Fixed on `main` by that audit (PR #7)
- Signup creating the company row from the browser (only worked with email confirmation off) -> now works either way, with a "Finish setting up your account" self-recovery form for stuck accounts.
- Open redirect on `/login?redirectTo=` -> `safeRedirectPath()`.
- RLS on `companies` and token randomness assumed but never proven -> migration 0012.
- Paying subscription with unrecognised price silently granting zero limits -> loud logging.

### Fixed on `main` since
Resend/cooldown/link expiry, orphaned Stripe subscription cancel, Terms + Privacy updates (Stripe data disclosure, retention after deletion), expiry reminders (the advertised feature that didn't exist).

### Second audit (2026-10-16): fixes sitting on UNMERGED branches
| Finding | Where it's fixed |
|---|---|
| **C1 (critical):** a company could read another company's uploaded files by saving a file row under its own document with a path in another company's folder; the server then signed it with the service role. Fix: strict path-ownership helper + DB triggers (0016) | PR #9 `fix/phase-0-security` |
| **H1 (critical/high):** Next 16.3.3 had a critical RCE in `next/og`, SSG/ISR cache poisoning and an image-optimizer SSRF. Fix: bump to 16.3.8 | PR #9 |
| H2: privacy policy banner "NOT IN USE AND IS NOT VALID" until legal review (one switch: `PRIVACY_POLICY_IN_FORCE`) | PR #10 `fix/phase-1-trust` |
| H3: `RESEND_FROM` single source of truth, no hardcoded real-domain fallback | PR #10 |
| H4: missing `/auth/callback` route (confirmation links were a dead end), resend-confirmation button, clearer pre-confirmation login message | PR #10 |
| M1: security headers (CSP, X-Frame-Options DENY, nosniff, referrer policy, permissions policy) | PR #11 `fix/phase-2-hardening` |
| M2: one password rule (10+ chars, common-password block) across signup/reset/change (UI said 8, server accepted 6) | PR #11 |
| M3: Supabase-backed rate limiting on contact form (per IP) and contractor upload actions (per token); fails open | PR #11 |
| M4: compliance dates in Brisbane time, not UTC | PR #11 |
| M8: drop duplicate trial-reminder columns (0018) | PR #11 |
| M9: Secure flag on auth cookies in production | PR #11 |
| M6: robots, sitemap, Open Graph/Twitter metadata and share image | PR #12 `fix/phase-3-polish` |
| M7: pricing page stops advertising unenforced storage numbers | PR #12 |
| L1-L4: unique titles + noindex on auth pages; no "Not uploaded" flash after submit; branded 404; homepage mock no longer shows a domain Subbies doesn't own | PR #12 |

### Still-known gaps (not fixed anywhere yet)
- Supabase **email confirmation is still off**. Safe to turn on only once PR #10 (`/auth/callback`) is merged. Check the Supabase redirect allowlist includes the production URL first.
- TEMP +tag exemption for the founder's inbox is still in code.
- Duplicate welcome email race (two webhook events can both send) and non-atomic `createContractor` (three inserts, manual rollback). Low impact.
- No storage orphan-cleanup job. No in-app storage metering.
- Stripe orphan sweep (working cards on deleted accounts) not built.
- Auth endpoints (signup/login/reset) are rate-limited only by Supabase's own dashboard settings.
- Sending domain `unknwnmoving.store` carries deliverability risk for production; SPF/DKIM/DMARC need verifying for whichever domain is finally chosen. A Resend API key was already rotated once after exposure.
- A live Stripe secret key was pasted in plain text into an early chat (2026-08-31). Treat as exposed in that transcript and consider rolling it in Stripe.
- Hand-written `lib/types.ts` can drift from the schema (how two hand-created tables ended up unverifiable). Consider `supabase gen types typescript`.

### Legal posture
- `/terms` (added 2026-09-30): eligibility (18+, business use only), "tool, not advice", compliance responsibility, trial/billing/cancellation as the app actually behaves, account deletion, liability (Australian Consumer Law preserved), Queensland governing law. Version/date in `lib/legal/terms.ts`. Signup requires a checkbox and stores `age_confirmed`, `terms_version`, `terms_accepted_at`.
- `/privacy`: discloses Stripe data and post-deletion retention exceptions; linked from signup, footer and (on the unmerged branch) the contractor upload page.
- **Known gaps from the founder's own review:** the Terms don't explicitly disclaim liability for customers who ignore warnings or let subcontractors work unlicensed; placeholders for business name / ABN / contact email remain on the privacy page; overseas data storage isn't disclosed; the company isn't legally registered yet, which blocks finalising the entity name. Legal review options discussed: LegalVision (~$1,500/month membership) vs cheaper Australian options (Lawpath ~$155/month, Sprintlaw, Legal123).

---

## 10. Design and brand history

The founder's standing rules: **must not look like generic AI/SaaS-template output**; senior-designer standard; premium, warm, trustworthy "construction trade brand" feel; avoid gradient blobs and glassmorphism; palette discipline.

| Date | Direction |
|---|---|
| 2026-08-30 | v1: navy + warm grey, IBM Plex Sans (Phase 1 shell) |
| 2026-08-31 | Design system v2 (from Claude Design export in `Branding/`, gitignored): warm neutral ramp, **single orange accent**, oklch tokens, soft shadows, Space Grotesk / Hanken Grotesk / IBM Plex Mono |
| 2026-09-04 | Real favicon from the actual brand mark; every transactional email reskinned with sampled-exact colours; em dashes removed from all copy |
| 2026-09-10 | **Accent recoloured orange -> steel blue** (`#1E3A5F` base; accent-600 `#2C4F7C` hover; accent-700 `#16283F` pressed). "Attention" amber was **decoupled** from the accent scale so the expiring/rejected status colour didn't turn blue |
| 2026-09-11 | Full steel-blue rebrand: dark navy sidebar rail on every dashboard page, shared primitives (Button, Card, StatCard, Alert, EmptyState, Field, IconButton, Chip), sidebar-specific focus ring, bell inherits colour; consistency passes; "premium visual upgrade" (motion tokens, homepage rebuild); real Unsplash photos via the official API (credits in `IMAGE_CREDITS.md`) |
| 2026-10-02 | **Scale-up pass:** body text 14px -> 16px at the token level, bigger buttons (sm 38 / md 46 / lg 54px), 16px inputs (stops iOS zoom), wider layout constants, fixed two mobile horizontal-scroll bugs |
| 2026-10-17 | **Design overhaul v3** (PR #13, fast-forwarded to `main`): see below |

### v3 (current, on `main`)
- **Fonts:** Mona Sans (variable, width axis) for UI/display; JetBrains Mono for reference data (timestamps, numbers, ABN, reminder-day chips). Space Grotesk, Hanken Grotesk, IBM Plex Mono removed. *The earlier font choices no longer bind; the founder explicitly allowed fonts to change.*
- **Palette locked and unchanged** (steel blue accent, dark navy sidebar `oklch(17% 0.025 258)`, warm neutral canvas, status colours: approved green, review blue, attention amber, expired red). Muted/subtle ink re-pointed at existing greys for WCAG AA.
- **Language of the UI:** hairline structure, "register" tables, radius scale 4/6/8/12, elevation only for floating UI, press feedback instead of hover lifts, shorter motion tokens, honest reduced-motion support.
- **Status stamp:** squared, bordered, icon + word; "expired" is the one solid fill.
- **Shell:** slimmer navy rail, context top bar (company / section + notifications), neutral trial strip (attention colour only on the last day), 44px touch targets.
- **Dashboard:** figures row + worst-first "Needs you" queue + 30-day expiring list.
- **Contractors/Projects/Document types:** ruled register tables on desktop (container queries so they respond to their own width), tidy stacked rows on phones.
- **Auth:** split layout, form on calm paper, navy product panel on desktop (dropped on phones); 44px fields.
- **Contractor upload page:** mobile-first "docket" with segmented progress bar, 64px upload target, 52px submit.
- **Marketing site:** editorial, left-set hero built from the app's real components (no fake logos or invented stats), numbered sections, alternating feature rows with real product previews, phone-framed upload page, founder note, navy closing band.
- **Emails:** steel top edge, caps-label headings, ruled document lists; plain-text bodies unchanged.
- **Finishing:** branded 404 and error pages, dependency-light so they don't bloat every page's JS. Measured gzipped JS vs before: login -6.5 KB, upload +1 KB, home/signup +3.5 KB.
- Unused legacy stock images (`blueprint.jpg`, `build.jpg`, `crew.jpg`) still sit in `public/marketing/`. One Unsplash photo has incidental third-party logos on safety gear (documented in `IMAGE_CREDITS.md`).

---

## 11. Complete build timeline (phase by phase)

**Phase 0: founding (before 2026-08-30)**
Concept chosen in a planning chat (with ChatGPT/Gemini/Claude), competitor research, MVP scoping and repositioning (onboarding-first), database design (companies, document_types, contractors, contractor_documents, contractor_tokens), decision to reject contractor accounts and use token links, reminder/escalation cadence settled, stack chosen. Setup problems solved along the way: a duplicate `src/app` vs `app` folder causing silent 404s; cached credentials for an unrelated GitHub account blocking pushes; `env.local` saved without its dot; RLS blocking signups; Vercel drag-and-drop deploy 404 -> switched to GitHub-connected deploys.

**2026-08-30: Phase 1 (PR #1): the core loop**
1.1 protected dashboard shell + design tokens + `proxy.ts` session refresh + RLS (0001); 1.2 document types CRUD; 1.3-1.4 add-contractor flow + onboarding email via Resend (reply-to set to the company's login email; degrades gracefully without an API key) + public read-only `/onboard/[token]`; 1.5 contractor document upload (signed URLs, private bucket, 0002); 1.6-1.7 company review (view file, set expiry, approve/reject with reason, rejection email, status computation, "approved" email); 1.8 dashboard buckets + notifications bell.

**2026-08-30: Phase 2 (PRs #2, #3)**
2.1-2.2 perceived speed (loading skeletons, spinners, `useTransition`, optimistic approve) + show/hide password; 2.3 settings page (0003); 2.4 marketing site (landing, how-it-works, pricing, contact -> Resend with honeypot); 2.5 projects / job assignment (0004); 2.6 expanded contractor file view with Documents/Projects/Activity tabs (activity timeline derived from existing timestamps, no new table); 2.7 Stripe billing on live keys (0005).

**2026-08-31: Phase 3 (PRs #4, #5)**
3.1 password reset; 3.2 new pricing A$19/39/79 + per-resource limits; 3.3-3.4 card-free 7-day free tier + forced onboarding gate + soft-lock (0006); 3.5 landing rebuild with stock photography; design system v2 (orange) merged.

**2026-09-04: bug sweep and per-plan trials (merge `11d877b`)**
Free tier replaced by per-plan 7-day trials (0007); checkout failures made diagnosable; `/api/health/billing`; cascade-delete (0008); pricing prefix/duplicate-shadow fixes; real favicon; all emails reskinned; em dashes removed.

**2026-09-10: performance, auth hardening, recolour**
Perf stages 1-3 (auth/company round trips cut from ~5 to 2; independent queries parallelised; bell streamed); password-reset hardening; +tag abuse loophole closed (with TEMP founder exemption); accent recoloured to steel blue.

**2026-09-11: biggest single day**
Account deletion + trial ledger (0009), then the fail-open fix when the missing ledger table denied every new signup a trial; deletion consent + storage wipe + cascade guarantee (0010) + `/privacy`; full steel-blue rebrand (navy shell); reminder-schedule preset/chips UI; design consistency passes; premium visual upgrade; Settings tab-switch and sidebar-navigation performance fixes; real Unsplash images; **document actions menu** (revoke, resend, edit expiry) + **multi-file contractor uploads** (0011); fixes for "link shows invalid after Send new request", swallowed multi-file submit errors, and an uploads health endpoint.

**2026-09-18: security and correctness audit (PR #7)**: see section 9. AUDIT_REPORT.md written. 0012.

**2026-09-19: automatic expiry reminders (PR #8)**: see section 5.5. 0013.

**2026-09-28: contractor management (preview/contractors-v2 merged)**: see section 5.6. 0014, 0015.

**2026-09-30: legal and billing safety**: orphaned Stripe subscription cancel, Privacy updated for Stripe, Terms of Service + 18+/terms checkbox at signup.

**2026-10-02: scale-up UI pass.**

**2026-10-10: domain/name discussion** (see section 16).

**2026-10-16 to 17: second audit + fix branches (PRs #9-12, unmerged) and design overhaul v3 (PR #13, merged).** In the final step of that session the design branch was fast-forwarded to `main` before the open critical fixes were merged. Post-deploy browser verification could not be completed (no computer linked for Chrome tools); Vercel's build of the exact commit succeeded.

---

## 12. Branches, PRs and what is NOT on main

### PR map
| PR | Branch | What | On main? |
|---|---|---|---|
| #1 | `phase1-dashboard-shell` | Phase 1 core loop | Yes |
| #2 | `phase2-expansion` | Phase 2 up to contractor file view | Yes |
| #3 | `phase2-stripe` | Stripe billing | Yes |
| #4 | `design-system-v2` | Orange design system | Yes |
| #5 | `phase3-freetier` | Phase 3 | Yes |
| #6 | `phase3-fixes` | Per-plan trials | Branch tip is not in main's history as-is; the same change landed on 2026-09-04 via commit `7e61644` |
| #7 | `audit/full-security-pass` | First audit | Yes |
| #8 | `feature/expiry-reminders` | Expiry reminders | Yes |
| #9 | `fix/phase-0-security` | **C1 cross-company file access, Next CVE bump, migration 0016** | **NO** |
| #10 | `fix/phase-1-trust` | Privacy banner, email sender, `/auth/callback` | **NO** |
| #11 | `fix/phase-2-hardening` | CSP/headers, rate limiting (0017), password policy, Brisbane dates, secure cookies, drop columns (0018). Also carries PR #9's commits | **NO** |
| #12 | `fix/phase-3-polish` | robots/sitemap/OG, storage claims, 404, auth page titles, upload flash fix | **NO** |
| #13 | `design/overhaul-v3` | Design overhaul v3 | Yes (fast-forward; `main` == this commit) |

Other branches (`feature/*`, `fix/*`, `claude/*`, `preview/contractors-v2`, `privacy-stripe-retention`) were merged into main by local merge commits and are historical.

### Merge guidance (from the 2026-10-17 session)
- **PR #9 merges cleanly.** It also carries the two most serious fixes, so it is the first priority.
- **PRs #10, #11, #12 need rebasing** onto the new `main` because the v3 redesign touched overlapping files (auth pages, marketing pages, error/404 pages, pricing).
- PR #11 includes #9's commits (merge order: #9 then #11).
- **Migrations 0016, 0017 and 0018 must be run in Supabase before the code that depends on them merges** (standing rule).
- Intended cadence per the founder: build -> check -> fast-forward merge to `main` (the founder has twice asked for direct `--ff-only` pushes to `main` rather than leaving PRs open).

---

## 13. Open items, risks and pre-launch checklist

**Do first**
1. Merge PR #9 (C1 cross-company file access + Next 16.3.8). Run migration 0016 first.
2. Rebase and merge PRs #10, #11, #12 (run 0017 and 0018 first). Run the read-only diagnostics queries included with the branches before 0018.
3. After PR #10 is in: enable Supabase email confirmation (check the redirect allowlist).
4. Remove the TEMP +tag exemption (`NORMALIZATION_EXEMPT_BASE_EMAILS` in `lib/auth/normalize-email.ts` plus its 4 tests); use a non-Gmail/Outlook domain for QA accounts.
5. Run `GET /api/health/billing` (with `Authorization: Bearer $CRON_SECRET`) and confirm `healthy: true`, every price `ok: true` and `livemode: true`.
6. Dry-run the reminder cron (`?dry=1`) before trusting the live one.

**Business and legal**
7. Register the company; replace placeholders (business name, ABN, contact email) in Terms/Privacy; get a legal review; flip `PRIVACY_POLICY_IN_FORCE` after review (PR #10); strengthen Terms on ignored warnings/unlicensed work; add data-location disclosure.
8. Settle the name/domain (subbies.com.au and subbies.app were taken) and sending domain; verify SPF/DKIM/DMARC; set `RESEND_FROM` properly.
9. Consider rolling the live Stripe secret key that was pasted into a chat transcript.

**Product and infra**
10. Storage: upgrade the Supabase plan at customer scale; build orphan cleanup (report-only first); consider real metering if storage is ever advertised.
11. Stripe orphan sweep cron (optional, never approved).
12. Fix duplicate welcome email race; make `createContractor` atomic (RPC).
13. Generate DB types; replace the stock `README.md` with env vars + migration order; delete unused legacy images.
14. Wire in a real `CONTACT_EMAIL` and do one live contact-form test send.
15. Browser-test the merged v3 design on real devices (console errors, 390px mobile, full click-through). This was **not** completed in the last session.

**Validation (the real priority)**
16. Talk to real builders; get 3 paying customers. Founding-customer pricing is still an unbuilt idea.

---

## 14. Decision log: added, removed, reversed, rejected

**Product**
- Repositioned from "expiry tracker" to "contractor onboarding" as the hook; expiry is the retention layer.
- **Rejected:** contractor accounts / portal. Token links only.
- **Rejected:** replacing incumbents or becoming project-management software (see section 16 for the advisor's scope proposal).
- Nav kept to five real routes. Mockup items Documents / Reminders / Reports / header search were **not built** (no dead links, no fake search).
- "Contractors" kept instead of "Subcontractors" (renaming is a copy change across every page and route, not a reskin).

**Billing**
- 14-day trial -> removed -> card-free 7-day free tier -> removed -> per-plan 7-day trial with card.
- $29/$49/$99 -> A$19/A$39/A$79; limits rebuilt per resource.
- Live Stripe keys used from day one by deliberate founder choice.
- Trial is first-subscription only; deleted-account emails permanently flagged.

**Design**
- Orange accent -> steel blue (attention amber decoupled so status colours were unchanged).
- Space Grotesk / Hanken Grotesk / IBM Plex Mono -> Mona Sans / JetBrains Mono (palette stays locked).
- Hover lifts -> press feedback; heavy shadows -> hairlines; stat tiles -> ruled figures row; "Action required" -> worst-first "Needs you".
- Stock/placeholder photos -> labelled placeholders -> real Unsplash via the proper API -> editorial site using real product components. (Scraping Unsplash pages was rejected as bad advice; the proper API was required.)

**Data and code**
- `file_url` single column -> `contractor_document_files` table (legacy column kept, unread, not dropped, to avoid a drop-column ordering risk).
- Added `revoked` document status (plain text column, no CHECK constraint, so no schema change).
- Documents updated in place -> replacement rows for "updated copy" on approved docs.
- Settings tabs: URL navigations -> client state with the History API.
- Resend: three hand-rolled senders -> one sender with cooldown.
- Rejected with reasons recorded: TTL-caching auth (leaks across companies if the key is ever wrong, and `cookies()` can't run inside `unstable_cache`); an `auth.users` trigger for company creation (Supabase owns that schema); rotating tokens on resend (breaks earlier emails); ATO ABN checksum (would reject a typo with no way to save); per-row rename or required/optional flags on documents (would silently rename company-wide); moving auth server-side just to rate-limit it; moving to Next 16.4 just for the CVE fix.
- Considered and not built: required/optional document flag; CSV import; multi-user teams; advanced reporting (all in the original brief's Pro-tier ideas).

**Security trade-offs documented**
- Local JWT verification trusts a token until it expires (~1 hour); session revocation isn't noticed until then. There is no admin revocation flow, so it isn't reachable today.
- CSP keeps `'unsafe-inline'` (nonces would be a large change) as a documented compromise.

---

## 15. Bugs and root causes (the lessons)

1. **Silent 404s on every new route:** files created in `src/app/` while the project root used `app/`. Check placement before creating files.
2. **`.env.local` nearly committed:** saved as `env.local`. Caught by `git status`.
3. **Signup dead end:** company row created from the browser needs a session; `signUp()` only returns one when email confirmation is off. Fixed to work either way with a self-recovery form.
4. **Checkout failures with no explanation:** every error collapsed into one generic message. Now classified; the usual real cause is environment (test-mode price ID against a live key, missing/whitespace-padded price ID).
5. **Password reset links pointing at localhost:** Supabase dashboard Site URL / redirect allowlist, not code. Code was hardened anyway (token exchange crash on network failure, 4s timeout -> 20s, expired-link messages).
6. **Trial ledger denied every new signup a trial:** migration 0009 wasn't run in production; lookup failed closed. Fixed to fail open, deletion preflights ledger reachability before cancelling Stripe.
7. **Deletion cancelled Stripe then failed:** same root cause; now preflighted.
8. **Storage never wiped on deletion:** `storage.objects` has no FK to cascade from. Now recursively removed.
9. **Foreign-key violation deleting a user:** `companies.user_id` lacked `ON DELETE CASCADE` (0008 -> 0010).
10. **"Replace file" button never worked** at `uploaded` status (server only accepted requested/rejected). Fixed.
11. **Onboarding link shows "invalid" after "Send new request":** a display-only embed (`contractor_document_files`) failing poisoned the query that gates the link; likely PostgREST schema-cache lag after a migration. Fixed by separating the queries. Same latent bug found and fixed on the company detail page.
12. **Multi-file submit "Couldn't save the upload":** every cause collapsed into one string; proved RLS/storage weren't the cause (all service-role). Classifier added (transient vs permanent) plus `/api/health/uploads`.
13. **Dashboard felt slow:** ~5 serial Supabase round trips per navigation, then a layout that blocked every sidebar click with no Suspense; Settings tabs were full navigations. All fixed (measured, not guessed).
14. **Orphaned Stripe subscription:** a test user was deleted directly in Supabase, bypassing the in-app delete flow, so Stripe kept retrying charges. Claude first misdiagnosed it, then corrected after reading the code. Safety net added for failed payments only.
15. **Pricing page overflowed on 390px phones** (sr-only labels escaping the scroll box); contractor tab bar ran off screen. Fixed in the scale-up pass.
16. **Contractor register collapsing at ~1024px:** viewport breakpoints vs a narrower column. Fixed with container queries.
17. **Expiry date off by one** around the cron's 21:00 UTC run (Brisbane is already the next day). Fixed on PR #11 only.
18. **Cross-company file read (C1)** and **Next.js CVEs**: fixed on PR #9 only.
19. **Sandbox verification limits:** the agent sandbox often can't reach live Supabase/Stripe/Vercel logs or fonts; every fix commit states plainly what it could and couldn't verify. Founder verification (running migrations, clicking through live flows) remains part of the process.

---

## 16. Ideas discussed but not built

- **Scope expansion proposed by the founder's advisor (2026-09-04):** "Contractor Management + Project Coordination + Compliance", with a build order of project schedule, tasks, daily/site updates (notes + photos), a "Today" dashboard, and notifications, turning Subbies into "the place I check every morning". Claude's assessment at the time: this contradicts the founding thesis (not replacing ServiceM8/Tradify/Procore, "the simple middle ground") and walks toward becoming HazardCo; "check every morning" is a different, harder product. **No decision is recorded in the material reviewed.** The existing Projects feature is intentionally light job-assignment only.
- **Name/domain (2026-10-10):** subbies.com.au and subbies.app were taken. Suggested alternatives: SubCheck (top pick), SubTrack, TickSub, SubbieCheck, ClearSub, SiteReady (backup, wider scope), or GetSubbies/UseSubbies workarounds. Advice: prefer `.com.au` for trust with Australian builders, avoid hyphens and numbers, check ABN/IP Australia trademark and the Instagram handle, then commit quickly. **No decision recorded.**
- **AI features:** reading expiry dates from uploaded certificates. Deferred until the core works and economics make sense.
- **Founding-customer pricing** (locked discounted price for early customers).
- **Video ads:** Gemini/Veo prompts were written (Apple-style cinematic and problem/solution variants), with the real dashboard screenshot as a locked asset.
- **Other:** CSV import of contractors; multiple team members per company; advanced reporting; per-contractor token rotation action ("send a new link" that kills a leaked link); Vercel WAF rate limit on `/onboard/*`; weekly storage orphan cleanup; Stripe orphan sweep cron.
- **Test accounts:** a test account was granted free Pro access via a database-only change (no real Stripe billing) for QA; cancelling it triggers no real charge.

---

## 17. Founder, ways of working and rules for AI agents

### Who
Solo, non-technical founder (Mr Virk / Prabh Virk), Queensland (Brisbane/Logan), building Subbies as a bootstrapped product alongside other freelance web and marketing work. Starting a business with a partner (Harman); the company isn't registered yet. Operates as a sole trader with an ABN.

### How he works
- **Briefs, not piecemeal instructions:** describes the problem or goal in plain language, wants Claude to clarify intent first, then hands off one detailed consolidated brief to Claude Code. Briefs are usually delivered as a `.md` file. Expects them paste-ready.
- **Plain English after every autonomous run:** what was wrong, what changed, what's left. No jargon, no padding. Short and direct, casual-professional tone, "go hard" on real issues, don't be soft.
- **One step at a time** in unfamiliar dashboards (Stripe, Supabase).
- **Verifies independently** (checks GitHub branches himself when a session looks stuck) and pushes back on overclaiming, partial fixes presented as full ones, and workarounds that contradict safety rules.
- **Branching:** earlier "always new branches off main, preview deploys before merging"; later, twice stated, "build, check, then fast-forward straight to `main`". The pre-push hook can falsely report "push failed" after a successful push: verify with `git ls-remote` vs `git rev-parse HEAD`.
- **Model choice:** Opus-class at high effort for ambiguous visual-design work; sometimes chooses a lighter model for a single brief.
- A reusable `app-skill.md` and session summaries were produced to carry context between AI tools (this file continues that practice).

### Rules for any AI working in this repo
1. Read `AGENTS.md` and the Next.js docs in `node_modules/next/dist/docs/` before writing Next code. `app/` and `lib/` at the root, never `src/`.
2. Never commit secrets or `.env*`. Never print keys. Never rotate live credentials unilaterally. Never run live Stripe charges or write to the production database from a sandbox.
3. Migrations are run by the founder by hand, **before** the code that needs them merges. Write them idempotent and additive; make code tolerate the gap.
4. Don't overbuild. Build the customer workflow. No AI features or impressive-sounding features without real value. No dead buttons, fake data, placeholder content or broken links.
5. No generic AI look. No em dashes in copy. Respect the locked palette. Don't copy competitors.
6. Prefer pure, tested `*-logic.ts` for decisions; keep server actions thin; re-check ownership in code on every service-role path; scope writes by `company_id` as well as `id`.
7. Report limits honestly: say what couldn't be verified in the sandbox.
8. Never claim things about competitors that can't be evidenced.
9. Surface still-open critical issues **before** pushing to `main`, not after.

---

## 18. Appendix

### Routes
Public marketing: `/`, `/how-it-works`, `/pricing`, `/contact`, `/privacy`, `/terms`.
Auth: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/onboarding` (plan picker), `/billing/return`.
Contractor (no login): `/onboard/[token]`.
App: `/dashboard`, `/dashboard/contractors`, `/dashboard/contractors/new`, `/dashboard/contractors/[id]`, `/dashboard/document-types`, `/dashboard/projects`, `/dashboard/projects/[id]`, `/dashboard/settings`.
API: `/api/webhooks/stripe`; crons `/api/cron/expiry-reminders` (21:00 UTC) and `/api/cron/trial-reminders` (09:00 UTC) in `vercel.json`; health `/api/health/billing` and `/api/health/uploads` (all CRON_SECRET-gated).
On unmerged branches: `/auth/callback`, `robots`, `sitemap`, `opengraph-image`.

### Environment variable names (values live in Vercel and `.env.local`, never in the repo)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_BUSINESS`, `STRIPE_PRICE_PRO`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `CONTACT_EMAIL`. Branches add `RESEND_REPLY_TO`, `PRIVACY_EMAIL` (optional).

### Webhook endpoint
`/api/webhooks/stripe` on the production URL, registered in Stripe, listening to six events (listed in section 6).

### Tests
`npm test` runs `node --test lib/*.test.ts lib/**/*.test.ts`. 17 test files on `main`, roughly 230 test cases; the combined fix branches report 260. Covers: signup classification, safe redirect, +tag normalization, deletion codes, trial eligibility (including fail-open direction), contractor status, expiry-reminder boundaries and renewals, request-email copy, document actions/lifecycle, resend/archive/delete rules, notes, storage cleanup, save-error classification, reminder-schedule logic, ABN/edit/cooldown/link-expiry, the document-reads structural guard, and file grouping.

### Where things live
- `app/(marketing)/` public site; `app/dashboard/` the app (each route has `loading.tsx`); `app/onboard/[token]/` contractor flow; `app/components/` shared primitives (button, card, input, status-badge, dialog, confirm-dialog, empty-state, page-header, plan-cards, chip, avatar, logo, skeleton, spinner, alert, password-field, auth-shell).
- `lib/billing/` plans, entitlements, Stripe client, sync, trial eligibility/reminders, error mapping. `lib/email/` templates and senders (`template.ts` is the shared shell). `lib/supabase/` clients, middleware, `dal.ts` (cached data access). `lib/reminders/`, `lib/contractors/`, `lib/document-*`, `lib/storage*.ts`, `lib/auth/`, `lib/legal/terms.ts`.
- `supabase/migrations/` numbered SQL. `proxy.ts` session refresh and route protection. `Branding/` design-reference images (gitignored source). `public/brand/` real logo assets; `public/marketing/` photos (`IMAGE_CREDITS.md`).
- `AUDIT_REPORT.md` first audit; `AGENTS.md` / `CLAUDE.md` agent rules; `.claude/launch.json` dev server config (`npm run dev`, port 3000).

### One-paragraph summary for pasting into another AI
Subbies is a live Next.js 16 / Supabase / Stripe / Resend SaaS (A$19/39/79, 7-day card-up-front trial) that lets Queensland construction and trade businesses onboard subcontractors via no-login secure email links, review and approve compliance documents, and get automatic expiry reminders and escalations. It is built by a non-technical solo founder using detailed briefs executed by Claude Code, with a strict "don't overbuild, don't look AI-generated, never ship code before its migration" philosophy. `main` carries the full core loop, contractor management, billing, and the v3 design overhaul; four audit-fix branches (cross-company file access fix, Next.js CVE bump, privacy/trust, hardening, polish) are still unmerged and are the top priority, followed by company registration and legal placeholders, email confirmation, and, above all, validating with real paying builders.
