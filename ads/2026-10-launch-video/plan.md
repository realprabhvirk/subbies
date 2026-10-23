# /brag plan: Subbies

**Input:** this project (Subbies, `design/overhaul-v3` branch, the v3 "site register" design).
**Format:** landscape 1920×1080, 30fps. **Duration:** 21.0s. **Tone:** `default`: punchy, clean, a dry trades-site edge.

## Rubric
- **What is it?** Subbies collects your subcontractors' compliance documents through one link, lets you approve them, and keeps them current with expiry reminders.
- **Who is it for, and what does it do for them?** Builders, property-maintenance and facilities teams who hire subbies. They stop chasing insurance certificates and licences, and they know who's cleared for site.
- **What sets it apart?** The contractor uploads from one link on their phone, with no login or account. The dashboard leads with what needs you, worst first.
- **Most impressive or funniest claim:** "Know who's cleared for site before they arrive." The funny truth: an expired policy is "invisible right up until it isn't."
- **Visual hook:** the product's own signature, the solid red **EXPIRED** stamp, slamming onto a certificate on a Monday morning.
- **Real UI to show:**
  - the Add contractor document checklist;
  - the contractor's phone upload docket with its segmented progress;
  - the review decision bar with Approve;
  - the "Expiring in the next 30 days" list;
  - the stamps.
- **Tone:** default. Clean motion, one dry joke up front, then the product does the work.
- **Share caption:** "Your subbies' insurance expires whether you check or not."

## Angle
**The Monday-morning problem, solved on Friday.** Open on the moment every builder dreads: a contractor on site whose insurance lapsed. Then show Subbies quietly making sure that never happens: one link out, a phone upload back, one click to approve, reminders before anything expires.

## Visual identity (from the code)
- **Canvas:** warm paper `warm-25` with ruled hairlines (the register motif from the marketing hero and auth panel).
- **Ink:** warm-900. **Accent:** steel blue `#1E3A5F`. **Rail:** navy `sidebar-bg`.
- **Type:**
  - Mona Sans, with semi-expanded headings and figures;
  - JetBrains Mono for dates and file names.
- **Status stamps:** Approved (green tint), Awaiting review (blue tint), Attention (orange tint), and **Expired (solid red)**.
- **Source of the visuals:**
  - the real compiled app stylesheet, fonts and brand mark;
  - markup reproduced from the real components (`status-badge`, `onboard-checklist`, `document-review-list`, `new-contractor-form`, dashboard).

## Data
All names are the fictional demo data used for local QA (Apex Build Group, Flowline Electrical, Redline Concreting, Harbour Electrical…). No real customers, emails, keys or internal URLs. The only URL shown is the public app address.

## Storyboard (cuts land on beats at 120 BPM, 0.5s per beat)

| # | Time | Scene | On screen | Motion | Sound |
|---|---|---|---|---|---|
| 1 | 0.0–3.0 | **Hook** | Ruled paper. "Monday, 7am. On site." A certificate card ("Public liability insurance · Redline Concreting · Expiry 10 Oct 2026"). A solid EXPIRED stamp slams on at 0.9s. "Their insurance expired last week." | Card rises in; the stamp drops from 1.5× with a small rotation; slight camera shake | Filtered intro; stamp thunk on the downbeat |
| 2 | 3.0–6.0 | **Reveal** | Subbies mark and wordmark. "Know who's cleared for site." The four stamps file in underneath. | Old content out, then dip to paper, then new in; stamps stagger | Beat drops in full; soft plucks per stamp |
| 3 | 6.0–10.0 | **Send one link** | Left: "Tick what you need. Send one link." Right: the real "Documents to request" checklist. Three ticks, a cursor presses "Send onboarding request", and a success alert appears. | Ticks one by one; button press-in; alert slides down | In-key pluck per tick; click; bright chime |
| 4 | 10.0–14.0 | **Phone upload** | Right: "They upload from their phone. No login." Left: phone with the upload docket. A tap on "Add a file or take a photo" stages `certificate-of-currency.pdf`; Submit; the stamp goes to Awaiting review and the progress fills, then the second doc and "You're all done". | Tap ripple; segments fill | Taps; rising plucks; done chime |
| 5 | 14.0–18.0 | **Approve + reminders** | Left: "You approve. Reminders do the chasing." Right: the "Your review" decision bar; a cursor clicks Approve and the stamp flips to Approved; then the "Expiring in the next 30 days" list with mono day chips and "Reminded at 30d · 14d · 7d". | Press, stamp flip, list rows stagger in | Click; soft thunk; ticks |
| 6 | 18.0–21.0 | **Outro** | Navy rail colour. Subbies logo (inverse). "Stop chasing paperwork." "Plans from A$19/month · 7 days free" · `subbies-hazel.vercel.app` | Type sets in; holds | Final chord, ring-out |

Durations: 3 + 3 + 4 + 4 + 4 + 3 = **21.0s**.

## Sound plan
An original track synthesised for this video at 120 BPM in D major:
- soft kick;
- clap on beats 2 and 4;
- closed hats;
- plucked bass;
- warm Dmaj7 → Bm7 → Gmaj7 → A6 pads;
- a bell motif.

Sound effects are pitched to D-major notes and mixed under the music: a low thump for stamps, filtered-noise clicks for taps, and plucks for ticks. The intro is low-passed; the full band comes in at the reveal (3.0s).
