# Inkbound Analytics — Handoff 5 of 5: Users tab + Calendar tab + Feature usage screen

**Read this whole file before writing any code. Handoffs 1–4 must be merged. Build ONLY what is in scope. This handoff runs as three parallel subagents with no approval stops — see ORCHESTRATION.md. "Checkpoint" below means: capture a screenshot for the final report and continue.**

## Scope (this handoff only)

1. **Users** tab (fourth position: Overview · Activity · Onboarding · Users). Every account in the database, grouped Customers · Leads · Parents · Likely fake, with a sub-filter row, search across everyone, and one paged list. Tap a row → profile (handoff 2).
2. **Calendar** tab (fifth position). Month grid of signups per day; tap a day → that day's signups; tap a person → profile.
3. **Feature usage** screen (pushed from the Overview → Usage view's "See all features" button and from each usage bar). Ranked · Trend · Share. Handoff 1 left `// TODO(handoff-5)` no-ops at both call sites.
4. The **fake-account rule** (`junk`) as a pure function in `lib/`, used by Users and (via `excludedFromMetrics`-style filtering) nowhere else yet.

Out of scope: any AI text, editing accounts, deleting accounts, changing the Overview/Activity/Onboarding tabs, exporting.

## Reference files (the truth for visuals)

> Files in `mock/` carry a `.txt` suffix so they don't compile inside the design-system project. Strip `.txt` when reading. Interactive mock: `ui_kits/analytics/index.html` in the design-system project → Users tab, Calendar tab, Overview → Usage → "See all features".

- `mock/Users.jsx.txt` — `UsersTab`, `NameRow`, `RIGHT` (the right-hand caption per status). **Copy structure and inline style values verbatim.**
- `mock/Calendar.jsx.txt` — `CalendarTab`. Verbatim.
- `mock/Usage.jsx.txt` — `UsageScreen`, `Spark`, `Delta`. Verbatim.
- `mock/App.jsx.txt` — how tabs mount, how `real` / `everyone` are derived, `open(u)`.
- `mock/data.js.txt` — search `seed(` for the account mix the UI must handle (~187 accounts: 23 paying, 6 churned, 14 trial ended, 45 signups that never paid, 12 parents, 88 junk), `junkReason` for the four rule labels, `FEATURES` / `ICON` / `usage` for the feature list and its shape, `PLANS`.
- Already ported: `Card`, `Input`, `SegmentedControl`, `StatusBadge`, `Button`, `SectionHeading`, `Hero`, `Mini`, `MiniToggle`, `Fade`, `CountUp`, `usePager`, `ScreenStack`, `SubHeader`, `FIcon`, `InkLineChart`, `PeopleScreen`, `ProfileScreen`.

## Existing codebase facts (do not re-architect)

- `lib/types.ts` `UserRecord` already carries `status`, `plan`, `excludedFromMetrics`, `onboarding`, `stepId`, `signupDate`, `isParent` / `athleteId` (if these two do not exist, derive parent from the `account_type` onboarding answer and the `parent_links` table — or whatever the athlete app uses — and note it). Extend the record; do not fork it.
- Feature events live in `product_events`. The feature list is the `FEATURES` array in the mock: `highlights`, `campaign`, `inbox`, `coaches`, `profile`, `calls`, `checkin`, `parent`. Map each to the real event name(s) at the top of `lib/usage.ts`. If a feature has no event yet, keep it in the list, render `—`, add `// TODO: emit <event>`. **Do not fabricate numbers.**
- Stripe data comes from `lib/stripe-revenue.ts` as in handoff 1. Plan label = `planLabel` there.
- `formatDay` exists; the mock shows "Aug 25" (no year). Use the mock's format here.

## Definitions (use these words in code and UI)

- **everyone** = all accounts minus `excludedFromMetrics`.
- **junk** = `everyone` matching the fake rule. **real** = everyone − junk − parents. **parents** = everyone with `isParent`, not junk.
- **Fake rule** (`lib/fake-accounts.ts`, `isLikelyFake(u): { fake: boolean, reason?: string }`), first match wins, reason text exact:
  1. `Test-looking name` — name (case-insensitive, trimmed) is in `{test, asdf, qwerty, demo, hello, user, tester, tmp, aaa, abc, xyz, delete me, player one, john doe, fake user, test account, coach test}` or contains the word `test`.
  2. `No last name, no activity` — single-word name and zero product events and `onboarding !== 'completed'`.
  3. `Duplicate email` — another account has the same normalised email (lowercase, dots and `+tag` stripped for gmail) and this one signed up later.
  4. `Never opened the app` — zero product events and no onboarding rows and signed up ≥ 7 days ago.
  Real founders/test accounts already flagged `excludedFromMetrics` stay excluded before this rule runs.
- **Customers** = real with status paying · trialing · churned. **Leads** = real with status trial_ended · signed_up. Sub-filters exactly as `buckets` in the mock (Paying/Trialing/Churned; Trial ended/Saw paywall/Stuck; All/Athlete paying/Athlete trialing/Opened app; All).
- **Saw paywall** = signed_up, onboarding completed, a `paywall_viewed` event, no subscription. **Stuck** = signed_up with `onboarding === 'in_progress'`.
- Right-hand caption per row = `RIGHT[status]` in the mock: plan label · "ends in {h}h" · "left {ago}" · "ended {ago}" · "stuck · {stepId}" / "saw paywall" / "joined {Mon d}" · "comped". Parents: "athlete {status}" or "no athlete linked", sub "Parent of {name} · opened the app / never opened".
- Sort: newest signup first. Page size 8 (6 for Parents and Likely fake). Search ignores buckets and searches `everyone` by name, email, team, phone; header shows "{n} match(es)" and each row's sub is the status label.
- **Calendar**: signups per day from `real` (no parents, no junk). Today = ink-50 cell; selected = ink-700, scale 1.04. Count pill only when n > 0. Selected day panel lists name · email · `StatusBadge`. Month arrows clear the selection.
- **Feature usage**: `users30` = distinct users with ≥ 1 event for the feature in 30d; `events30` = events in 30d; `perUser` = events30 / users30 (1 decimal); `days` = 30 daily event counts oldest → newest; `delta` = (last 15d − first 15d) / first 15d × 100, rounded, 0 when first 15d is 0. Ranked sort by the chosen metric; Share = events30 / total events.

## Step-by-step (one commit per step)

### Step 1 — Data (no UI)
- `lib/fake-accounts.ts` + tests: each of the four reasons, the first-match order, and a clean real account.
- `lib/users.ts`: `loadEveryone()` → `UserRecord[]` with `junk`, `junkReason`, `isParent`, `athleteId`, `parentActive` (parent has ≥ 1 product event), `stoppedAtPaywall`, `trialEndsIn` (hours), `trialEndedAgo`, `cancelledAgo` (days). Reuse whatever loader handoff 1's People screen uses; add fields, do not duplicate queries.
- `lib/usage.ts`: `loadUsage(days = 30)` → `Feature[]` `{ id, label, desc, users30, events30, perUser, days: number[30], delta }` in `FEATURES` order. Event-name map at the top of the file. Tests with a small `product_events` fixture: users30, events30, perUser, delta, a feature with no events → zeros and `missing: true`.
- **Checkpoint 1:** test output + logged counts: everyone / real / parents / junk, and `usage.map(f => [f.id, f.users30, f.events30])`.

### Step 2 — Users tab
- `components/users/UsersTab.tsx`, `components/users/NameRow.tsx` from the mock. Header line "{everyone} accounts · {paying} paying · {real} athletes · {parents} parents · {junk} fake" (paying in `--metric-money`). `Input type="search"` "Search anyone". `SegmentedControl` with counts in the labels ("Customers 43"). `MiniToggle` sub-filters with counts, horizontally scrollable via the `margin: 0 -16px; padding: 0 16px` wrapper — hidden when the bucket has one sub-filter or a search is active. List in `Card padding="none"` inside `Fade` keyed by bucket+sub+search. Empty state "Nobody here." Footer note under Likely fake, verbatim from the mock.
- Switching bucket resets the sub-filter to the first one.
- Row tap → `open(user)` from the nav context.
- Add `{ key: 'users', label: 'Users' }` fourth in the tabs array; mount branch in the shell.
- **Checkpoint 2:** screenshots at 393×852 of Customers · Paying, Leads · Stuck, Parents · All, Likely fake, and a search with 3 matches. `scrollHeight <= innerHeight` on each, numbers reported.

### Step 3 — Calendar tab
- `components/calendar/CalendarTab.tsx` from the mock. `Card padding="wide"`; ghost `Button size="sm"` arrows; 7-column grid, `gap 4`, `aspectRatio 1` cells, `radius-md`; month grid keyed by month with `ink-fade`; selected-day panel keyed by day with `ink-fade`.
- Add `{ key: 'calendar', label: 'Calendar' }` fifth in the tabs array; mount branch in the shell. If five tabs do not fit at 393px, the tab row scrolls horizontally with the active tab kept in view (`scrollLeft`, not `scrollIntoView`); do not shrink the labels.
- **Checkpoint 3:** screenshots of the current month with no selection, a selected day with 2+ signups, and a selected day with none. A 6-row month (e.g. one starting on Saturday with 31 days) with a selected-day panel of 3 rows must still not scroll; if it does, cap the panel to 3 rows + `usePager` and report.

### Step 4 — Feature usage screen
- `components/usage/UsageScreen.tsx`, `Spark.tsx`, `Delta.tsx` from the mock. Three views on a `SegmentedControl`: **Ranked** (metric `MiniToggle` Users · Events · Per user; rows with `FIcon`, label + `Delta`, 6px track bar of value/max, `Spark` 80×28, `CountUp` value + unit; tap selects, tinting the row ink-50), **Trend** (feature chips row, `Hero` "{label} · 30 days", `InkLineChart` height 170 of `days`, three `Mini`: Best day · Avg / day · Last 15d), **Share** (three `Mini` Events · Active users · Least used; 12px stacked bar of event share in the 8-step ink ramp from the mock; legend with percentages).
- `focus` prop: when opened from a usage bar, start on Trend with that feature selected; from "See all features", start on Ranked.
- Replace the two `// TODO(handoff-5)` no-ops in the Overview Usage view with `push({ key: 'usage', node: <UsageScreen focus={f.id} /> })` and `push({ key: 'usage', node: <UsageScreen /> })`.
- Missing-event features show `—` for value and no sparkline.
- **Checkpoint 4:** screenshots of Ranked (Events), Trend for one feature, Share. Back returns to Overview → Usage with its state intact.

### Step 5 — Wire-through
- Tab crossfade unchanged. Tab order Overview · Activity · Onboarding · Users · Calendar.
- Users row → profile → back lands on the same bucket, sub-filter, page and search text (keep the tab's state in the tab component or lift it to the shell; do not remount).
- **Checkpoint 5:** Users → Leads · Stuck → page 2 → row → profile → back (state kept). Calendar → day → person → profile → back. Overview → Usage → bar → Trend → back. Nothing scrolls. `tsc --noEmit` clean, all tests pass.

## Rules for Cursor
- One step at a time; wait at each checkpoint.
- Never fabricate a number. Missing events render "—".
- No new libraries. No AI text. No account editing or deletion.
- Only touch: `lib/fake-accounts.ts`, `lib/users.ts`, `lib/usage.ts`, their tests, `components/users/*`, `components/calendar/*`, `components/usage/*`, the two TODO(handoff-5) call sites in the Overview Usage view, the tabs array and tab mount in the shell.

## Definition of done
- Users tab: four buckets with counts, sub-filters, search across everyone, paged list, every row opens the profile, fake rule documented and tested.
- Calendar tab: month grid with per-day signup counts, day panel, profile on tap, month navigation.
- Feature usage screen reachable from Overview with Ranked · Trend · Share on real `product_events`.
- Every screen fits 393×852 without scrolling. All five tabs live.
