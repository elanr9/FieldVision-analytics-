# Inkbound Analytics — Handoff 1 of N: App shell + Home (Overview tab)

**Read this whole file before writing any code. Build ONLY what is in scope. Stop at each checkpoint and wait for me to review.**

## Scope (this handoff only)

Build two things, in this order:

1. **App shell**: the sticky header (mark + "Inkbound" + 4 header stats) and the tab bar with ONE tab: **Overview**. No other tabs exist yet. Do not stub Activity / Onboarding / Users / Calendar. Do not create routes, files, or components for them.
2. **Overview tab**: mini nav **Revenue · Growth · Usage**, each view fits one phone screen with no vertical scrolling.

Also build the one screen Overview pushes to: **People list** (tap a header stat or metric tile → list of names). Nothing else pushes anywhere. Tapping a person does nothing yet (no profile screen in this handoff).

Out of scope, do not build: profile screen, feature-usage detail screen, Activity feed, check-in texts, onboarding funnel, users tab, calendar, login changes, push notifications, any AI features. If you think something is missing, leave a `// TODO(handoff-2)` comment and move on.

## Reference files (the truth for visuals)

> Source files in `mock/` and `components/` carry a `.txt` suffix (`Overview.jsx.txt`, `Button.d.ts.txt`) so they don't compile inside the design-system project. Strip the `.txt` when reading; the content is plain JSX/TS. The interactive mock runs in the design-system project at `ui_kits/analytics/index.html`; this zip has no runnable copy.

Open the working mock in a browser and match it pixel for pixel:

- Interactive mock: `ui_kits/analytics/index.html` in the design-system project (iPhone frame). Click Overview → Revenue / Growth / Usage, tap bars, tap a header stat. The mock shows all five tabs; **ignore every tab except Overview** for this handoff.
- `mock/Overview.jsx.txt` — the Overview tab. **Copy its structure and inline style values verbatim.** Component names: `OverviewTab`, `Hero`, `Mini`, `MiniToggle`, `UsageBar`, `FIcon`, `PeopleScreen`. Ignore `RangePicker`/`Tile` (unused here).
- Other files in `mock/` (`Activity.jsx`, `Onboarding.jsx`, `Users.jsx`, `Calendar.jsx`, `Profile.jsx`, `Usage.jsx`) are for LATER handoffs. Do not port them.
- `mock/Header.jsx.txt` — `AppHeader`, `SubHeader`.
- `mock/Charts.jsx.txt` — `InkBars` (grouped bar chart, tappable). Only `InkBars` is needed in this handoff; ignore `InkLineChart`, `InkBarChart`, `InkFunnelChart`.
- `mock/Motion.jsx.txt` — `CountUp`, `Fade`, `ScreenStack`, `usePager`. Ignore `Sheet`.
- `mock/data.js` — shape of the data. Search for `months`, `weeks`, `totals`, `usage`, `FEATURES`, `platform`.
- `tokens/*.css` + `styles.css` — CSS custom properties. Use the variables, never raw hex.
- `components/` — design-system primitives (`Button`, `Card`, `SectionHeading`, `SegmentedControl`, `Tabs`, `HeaderStat`, `StatCard`, `UserRow`, `StatusBadge`, `ChartLegend`). Port these as-is into `components/ui/`; they are plain React with inline styles.
- `assets/inkbound-mark-flat.png` — the only logo.

## Existing codebase facts (do not re-architect)

- Next.js 15 app router, React 19, Tailwind 4, Recharts, Supabase (read-only), Stripe. Entry: `app/page.tsx` loads `loadUsers()` and `loadRevenueSnapshot()` server-side and hands them to `components/Dashboard.tsx`.
- Keep `app/page.tsx` data loading as-is. Replace the *body* of `components/Dashboard.tsx` with the new shell. Delete nothing else yet; the old tab components (`Pipeline.tsx`, `OnboardingAnalytics.tsx`, `UserTable.tsx`, `CalendarView.tsx`) stay on disk, unimported, until later handoffs.
- Rename the product string "FieldVision" → "Inkbound" only in `app/layout.tsx` metadata and the header. Leave SMS/email templates alone.
- Keep the iOS shell behaviour: `max-width: 768px`, 16px side padding, `env(safe-area-inset-top)` on the sticky header.

## Step-by-step (do them in order; one commit per step)

### Step 1 — Tokens and fonts
- Add `styles.css` and `tokens/` to `app/globals.css` via `@import`. Keep Tailwind's `@import 'tailwindcss'`.
- Add Google Fonts link for **Figtree 400/500/600/700** and **Geist Mono 400/500** in `app/layout.tsx`.
- Set `body { font-family: var(--font-sans); background: var(--surface-page); color: var(--text-primary) }`.
- **Checkpoint 1:** page renders with the old dashboard but new font and page colour. Stop and show me.

### Step 2 — Port design-system primitives
- Create `components/ui/` and copy these files from `components/` in this folder, unchanged except for `import React from 'react'` → Next.js compatible imports: `Button`, `Card`, `SectionHeading`, `SegmentedControl`, `Tabs`, `HeaderStat`, `StatCard`, `UserRow`, `StatusBadge`, `Tag`, `ChartLegend`.
- Do not restyle them. Do not convert to Tailwind. Inline styles with CSS variables are intentional.
- **Checkpoint 2:** a throwaway `app/dev/page.tsx` renders one of each. Show me, then delete the dev page.

### Step 3 — Motion helpers
- Create `components/motion/` with `CountUp`, `Fade`, `ScreenStack`, `usePager` copied from `mock/Motion.jsx.txt`. Add the `@keyframes` from `mock/index.html` (`ink-fade`, `ink-push`, `ink-pop`, `ink-under`, `ink-under-back`, `ink-grow`, `ink-grow-x`, `ink-draw`) to `app/globals.css`.
- **No checkpoint**; continue.

### Step 4 — Shell: header + single tab
- `components/Dashboard.tsx` becomes: `<ScreenStack>` wrapping `<AppHeader>` + `<Fade>` + `<OverviewTab>`.
- `AppHeader` exactly as `mock/Header.jsx.txt`: mark 28px + "Inkbound" 18/700 on the left; four `HeaderStat`s on the right in this order: **Users** (all non-internal accounts) · **Paying** (green) · **MRR** · **Trialing**. Tabs row below with the single `Overview` pill.
- Header stat values come from the real `users` array and the Stripe snapshot already loaded in `page.tsx`. `MRR` = sum of active subscriptions normalised to monthly (semester plans ÷ 4).
- Tapping a header stat pushes `PeopleScreen` (Step 7).
- **Checkpoint 3:** header renders with real numbers; Overview tab is the only tab; body is empty. Show me.

### Step 5 — Data for Overview
- Create `lib/overview.ts` with pure functions (no React) that take `users` + `revenueSnapshot` and return:
  - `months: {label, revenue, signups, trials, paying, partial}[]` — every month since the first signup; `partial: true` on the current month.
  - `weeks: …same shape…` — last 12 weeks (Sunday start), `partial: true` on the current week.
  - `totals: {revenue, payments, mrr, payingNow, payingEver, signups, trials, trialingNow, churned}` all-time.
  - Exclude `excludedFromMetrics` users everywhere.
- Unit-test with a tiny fixture (Vitest or plain node assert). Do not touch the UI in this step.
- **Checkpoint 4:** show me the test output and one logged `months` array.

### Step 6 — Overview tab
- Port `mock/Overview.jsx.txt` → `components/overview/OverviewTab.tsx` plus `Hero.tsx`, `Mini.tsx`, `MiniToggle.tsx`, `UsageBar.tsx`. Port `InkBars` from `mock/Charts.jsx.txt` → `components/charts/InkBars.tsx`.
- Behaviour to preserve exactly:
  - Mini nav `SegmentedControl`: Revenue · Growth · Usage. Switching crossfades via `Fade`.
  - **Revenue view:** `Hero` all-time revenue (green) with MRR on the right; card "Revenue by month/week" with `InkBars` (single series, `--chart-revenue`), Weeks/Months `MiniToggle` in the card header; tapping a bar selects it and the card title changes to "`Sep · $1,200 so far`"; three `Mini` tiles: ARR · Avg / payer · Best month.
  - **Growth view:** `Hero` all-time signups with signup→paid % on the right; card with grouped `InkBars` (signups gray-400, trials sky-500, paid green-600) + `ChartLegend`; three `Mini`: Paying now · Trialing · Trial → paid.
  - **Usage view:** `Hero` "Feature events · 30 days"; card with top-6 features as rows (16px Lucide icon from `lucide-react`: video, mail, search, message-square, map, user, phone, users · label 104px · track bar · "61 users") and a "Full breakdown ›" row; then `SectionHeading` "On Inkbound · all time" with six `Mini` tiles (Coach convos, Highlight vids, Emails opened, Campaigns, Schools saved, Calls booked). **Usage data is NOT wired in this handoff.** Render from a hard-coded copy of `usage` and `platform` in `mock/data.js`, with a small gray `Sample data` pill next to the section heading. Tapping a row and "Full breakdown" do nothing (`// TODO(handoff-3)`).
  - Every view must fit an iPhone 15 viewport (393×852) with **zero vertical scroll**. If it overflows, reduce card padding or chart height; do not remove elements.
- Numbers use `font-variant-numeric: tabular-nums` and `CountUp`.
- **Checkpoint 5:** all three views, screenshots at 393px wide. Show me.

### Step 7 — People screen
- `components/people/PeopleScreen.tsx` from `mock/Overview.jsx.txt` `PeopleScreen`: `SubHeader` with "‹ Back", a `Card` with header "`Paying · 23`", `UserRow` rows with `showActions={false}`, `usePager` 7 per page with the "1–7 of 23 ‹ ›" footer. Sorted newest signup first.
- Push/pop via `ScreenStack` (slide from right 320ms `--ease-out`, under-screen shifts −30% and dims to 50%, hidden after settle).
- Tapping a row: no-op with `// TODO(handoff-2): open ProfileScreen`.
- **Checkpoint 6:** tap Paying in the header → list → back. Show me.

## Rules for Cursor

- One step at a time. Do not start the next step before I approve the checkpoint.
- Do not "improve" the design. If the mock does something you think is wrong, leave it and add a comment.
- Do not add libraries. No Framer Motion, no charting libs beyond what exists, no state managers. `useState` + context is enough.
- Do not refactor existing files outside the ones named above.
- Match values exactly: radius 16 on cards, 12 on inner cards and controls, 9999 on pills; 1px `--border-default`; no shadows except the segmented thumb (`--shadow-sm`).
- No emoji. The only icons are the 8 Lucide glyphs in the Usage view.
- Sentence case everywhere. Separators are " · ".

## Definition of done for this handoff

- Header with real Users / Paying / MRR / Trialing.
- One tab: Overview, with Revenue / Growth / Usage views, all fit a phone screen.
- Bars tappable; Weeks/Months toggle; count-up numbers; crossfade between views.
- People list pushes and pops with the slide animation.
- Nothing else exists in the nav.
