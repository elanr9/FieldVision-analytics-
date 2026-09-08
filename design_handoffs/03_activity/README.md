# Inkbound Analytics — Handoff 3 of N: Activity tab (notification feed + weekly check-ins)

**Read this whole file before writing any code. Handoffs 1 and 2 must be merged. Build ONLY what is in scope. Stop at each checkpoint.**

## Scope (this handoff only)

1. Add the **Activity** tab to the tab bar (second position: Overview · Activity). Its badge = number of events today.
2. **Feed view**: every product event we already push (or should push) to the founders' phones, as a tappable list. Tap → the user's profile (handoff 2).
3. **Check-ins view**: who is due a weekly check-in text, with a Text button that opens a bottom sheet showing the drafted message and an "Open Messages" button (`sms:` link with the body prefilled).
4. **Persist notifications** in a table so the feed has history. Today they are fire-and-forget pushes from `app/api/notify/route.ts`.

Out of scope: Onboarding tab, Users tab, Calendar, feature-usage detail, sending SMS automatically (the founder taps Open Messages; nothing is sent by the server), any AI text. Leave `// TODO(handoff-4)` where needed.

## Reference files (the truth for visuals)

> Files in `mock/` carry a `.txt` suffix so they don't compile inside the design-system project. Strip `.txt` when reading. Interactive mock: `ui_kits/analytics/index.html` in the design-system project → Activity tab.

- `mock/Activity.jsx.txt` — `ActivityTab`, `NotifRow`, `CheckinRow`, `CheckinSheet`. **Copy structure and inline style values verbatim.**
- `mock/Motion.jsx.txt` — `Sheet` (bottom sheet; not yet ported), `usePager` (ported in handoff 1).
- `mock/data.js.txt` — search `notifications` (the 11 event types and their exact copy), `NOTIF_DOT` (dot colour per type), `CHECKIN_TEXTS` (the six message variations, verbatim), `checkinText` (rotation rule), `checkinsDue` (eligibility rule).
- `mock/keyframes.css` — `ink-sheet` is the only new keyframe; add it if handoff 1 skipped it.

## Existing codebase facts (do not re-architect)

- `app/api/notify/route.ts` receives Supabase trigger webhooks (`user_profiles` insert, `user_subscriptions` insert/update, `founder_calls` insert) and calls `sendPushToAll` in `lib/apns.ts`. **Keep it.** Add one line that also inserts a row into the new `analytics_notifications` table (Step 2). Do not change the push copy or auth.
- Tabs come from `AppHeader` (handoff 1). Add `{ key: 'activity', label: 'Activity', badge }` after Overview. Nothing else in the header changes.
- Profile push is `open(user)` from the nav context (handoff 2).

## Event catalogue (copy is exact; {first} = first name, {school} = school)

| type | title | sub | dot |
|---|---|---|---|
| paywall | {first} is in the paywall | Finished onboarding {n} days ago | violet-500 |
| wheel | {first} is on the 90% off screen | — | violet-500 |
| stalled | {first} stopped at paywall | 10 min without action | amber-500 |
| trial | {first} started a 3 day free trial | {plan} plan | sky-500 |
| paid | {first} paid {$amount} | {plan} plan | green-600 |
| cancel | {first} cancelled his/her subscription | {plan} | red-500 |
| save | {first} tried to cancel, accepted free month | — | green-500 |
| reply | {school} replied to {first} | {coach} | ink-500 |
| campaign | {first} just sent his/her campaign | {n} coaches · {m} schools | ink-500 |
| video | {first} just made a highlight video | {video title} | ink-500 |
| call | {first} booked a call with Elan | {Thu 4:30pm} | ink-700 |

Use the token names (`var(--violet-500)` etc.), not hex. Use "their" if gender is unknown.

## Step-by-step (one commit per step)

### Step 1 — Sheet primitive
- Port `Sheet` from `mock/Motion.jsx.txt` to `components/motion/Sheet.tsx`: fixed scrim `rgb(20 25 32 / .4)` fading in 200ms; panel max-width 768, white, radius `20px 20px 0 0`, padding `12px 16px calc(safe-area-bottom + 20px)`, slides up 320ms `--ease-out`; 36×4 gray-300 grabber; tap on scrim closes.
- **Checkpoint 1:** open/close it from a scratch button. Delete the scratch.

### Step 2 — Persist notifications (no UI)
- Migration: table `analytics_notifications (id uuid pk, created_at timestamptz default now(), type text, user_id uuid, title text, sub text null)`. Index on `created_at desc`.
- In `app/api/notify/route.ts`, after computing the push text for each existing event, also insert a row with the catalogue `type`, the exact catalogue `title`/`sub` (not the push wording), and `user_id`. Existing events map: profile insert → (no feed row; signups are not feed events), subscription insert with `paid_at` → `paid`, subscription insert without → `trial`, subscription update to cancelled → `cancel`, founder_calls insert → `call`.
- The remaining types (`paywall`, `wheel`, `stalled`, `save`, `reply`, `campaign`, `video`) need triggers from the athlete app's tables. **Add the insert helper `lib/notifications.ts: recordEvent(type, userId, vars)` that builds title/sub from the catalogue, and list in a comment which table/trigger should call it for each type.** Do not write those triggers in this handoff unless the tables already exist and are obvious; mark `// TODO(handoff-4)` otherwise.
- `lib/notifications.ts: loadNotifications(days = 14)` returns rows newest first, joined with the user's name.
- Unit-test `recordEvent` title/sub output for each of the 11 types.
- **Checkpoint 2:** test output + a manual insert visible via `loadNotifications()`.

### Step 3 — Check-in rules (no UI)
- Migration: table `checkin_log (id, user_id, sent_at timestamptz, variation int)`.
- `lib/checkins.ts`:
  - `checkinsDue(users, log)`: status paying or trialing, phone present, not internal/fake, and last `sent_at` ≥ 7 days ago or none. Churned/trial_ended users never appear.
  - `checkinText(user, log)`: the six `CHECKIN_TEXTS` verbatim from `mock/data.js.txt`, `{first}` replaced. Variation index = `(hash(user.id) + timesSent) % 6` so a user never gets the same text twice in a row and different users start on different variations.
  - `markSent(userId, variation)` inserts into `checkin_log`. Called when the founder taps Open Messages.
- Test: 6 consecutive calls for one user yield 6 distinct variations; churned user never due.
- **Checkpoint 3:** test output.

### Step 4 — Activity tab UI
- `components/activity/ActivityTab.tsx`, mounted when `tab === 'activity'`. Top: `SegmentedControl` **Feed · Check-ins · N** (N only when > 0). Content crossfades via `Fade`.
- **Feed:** row of two `MiniToggle`s side by side: left **Today · Yesterday · Earlier**, right **All · $ · Paywall · Coaches** (`$` = paid, trial, cancel, save; Paywall = paywall, wheel, stalled; Coaches = reply, campaign, video, call). Below, `Card padding="none"` with `NotifRow`s **paged 7 per page** via `usePager`. `NotifRow`: grid `10px 1fr auto`, padding 9×14; 10px dot; title 13px/500 single line; sub "{name} · {sub}" 12px gray-500 single line; right "38m ago" 11px gray-400. Tap → `open(user)`. Empty: "Nothing here."
- **Check-ins:** `Card padding="none"` with `CheckinRow`s paged 6 per page: name 14px/500 + `StatusBadge`; sub "{plan} · Last check-in 8d ago" or "· Never checked in"; right a **sm money Button "Text"**. Tap name → profile. Under the card, gray-400 12px note: "Paying and trialing users get a check-in text from Elan once a week. Stops when they churn." Empty: "Everyone's been checked in on this week."
- Time labels: `m ago` under 60 min, `h ago` under 24h, else `d ago`.
- **No vertical scroll** at 393×852 in either view at any page.
- **Checkpoint 4:** screenshots of Feed (Today/All) and Check-ins.

### Step 5 — Check-in sheet
- `components/activity/CheckinSheet.tsx` using `Sheet`. Content: "Text {first}" 15px/600; "{phone} · variation 3 of 6" 12px gray-500; the message in an ink-700 bubble (white text, radius `18 18 18 4`, padding 10×14, 15px/1.45, max-width 85%); two full-width buttons: **Not now** (secondary) and **Open Messages** (money).
- Open Messages: `window.location.href = \`sms:${phone}&body=${encodeURIComponent(text)}\`` (iOS format; use `?body=` on Android), then `markSent`, close the sheet, and remove the user from the due list for this session. Header badge and "Check-ins · N" update.
- Also wire the profile's **Text** button (handoff 2) to open this sheet when the user is check-in eligible; otherwise keep the plain `sms:` link.
- **Checkpoint 5:** tap Text → sheet → Open Messages → row disappears; count decrements.

## Rules for Cursor
- One step at a time; wait at each checkpoint.
- Copy the eleven titles and six texts character for character. Do not "improve" the copy.
- No new libraries. No server-side SMS sending. No AI.
- Only touch: `components/motion/Sheet.tsx`, `components/activity/*`, `lib/notifications.ts`, `lib/checkins.ts`, migrations, the one insert in `app/api/notify/route.ts`, the tab list in `AppHeader`, the Text handler in `ProfileScreen`.

## Definition of done
- Activity tab with today's-count badge; Feed filters by day and kind, 7 per page; every row opens the profile.
- Check-ins list is rule-driven, 6 per page; Text opens the sheet with the right variation; Open Messages prefills iMessage and logs the send.
- New events from the webhook appear in the feed after refresh.
