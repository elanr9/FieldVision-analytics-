# Inkbound Analytics — Handoff 4 of N: Onboarding tab (funnel + paywall)

**Read this whole file before writing any code. Handoffs 1–3 must be merged. Build ONLY what is in scope. Stop at each checkpoint.**

## Scope (this handoff only)

Add the **Onboarding** tab (third position: Overview · Activity · Onboarding) with four views on a mini nav: **Summary · Graph · Steps · Paywall**. Every view fits one phone screen. Every count that represents people can be tapped to open the People list (handoff 1); every step can be tapped for its detail.

Out of scope: Users tab, Calendar, feature-usage detail, any AI insight text (`lib/onboarding-insights.ts` and `app/api/onboarding-insights` stay on disk, never called). Leave `// TODO(handoff-5)` where needed.

## Reference files (the truth for visuals)

> Files in `mock/` carry a `.txt` suffix so they don't compile inside the design-system project. Strip `.txt` when reading. Interactive mock: `ui_kits/analytics/index.html` in the design-system project → Onboarding tab.

- `mock/Onboarding.jsx.txt` — `OnboardingTab`, `Rate`, inner `Row`, inner `Step`. **Copy structure and inline style values verbatim.**
- `mock/Charts.jsx.txt` — `InkFunnelChart` (the only new chart).
- `mock/data.js.txt` — search `const S =` (step order in 6 chapters), `const Q =` (step labels), `const CH =` (chapter labels), `const paywall =` (paywall data shape).
- Already ported: `Hero`, `Mini`, `MiniToggle`, `SegmentedControl`, `SectionHeading`, `Card`, `Fade`, `CountUp`, `PeopleScreen`.

## Existing codebase facts (do not re-architect)

- `lib/onboarding-steps.ts` is the source of truth for the 57 survey steps, their chapters (`basic`, `checkin`, `academic`, `athletic`, `goals`) and labels. **Import it; do not copy the list.** Step labels: use `def.question ?? def.lead ?? stepId`, matching `loadStepConversions`.
- `lib/onboarding-analytics.ts` already reads `product_events` (`onboarding_step_viewed` / `onboarding_step_completed` with `properties.step_id`). Extend it; keep its Supabase client pattern.
- The five **paywall steps** are not survey steps. Append them after `goals` as chapter `paywall`: `account_created`, `try_free`, `paywall`, `checkout`, `subscribed`. Their sources: `user_profiles.created_at` (account_created), `product_events` `paywall_viewed` / `try_free_tapped` / `checkout_started` (if these event names differ in the athlete app, use the real names and note them), `user_subscriptions` (subscribed). If an event does not exist yet, show the step with `—` and a `// TODO(handoff-5): emit <event>` comment. **Do not fabricate numbers.**
- `components/OnboardingAnalytics.tsx` (old) stays on disk, unimported.

## Definitions (use these words in code and UI)

- **started** = users with a `onboarding_step_viewed` for `survey_intro` in range (fallback: intake row exists).
- **reached(step)** = distinct users with `onboarding_step_viewed` for that step in range.
- **pct(step)** = reached / started × 100, one decimal.
- **dropped(step)** = reached(previous step) − reached(step). **dropPct** = dropped / reached(previous) × 100. Steps are ordered exactly as `lib/onboarding-steps.ts` then the 5 paywall steps.
- **chapter.enter** = reached(first step of chapter) + dropped(first step). **chapter.exit** = reached(last step). "% got through" = exit / enter.
- Range for the funnel is **last 30 days** (fixed). The **Signups** tiles on the Steps view use the 7d / 30d / All toggle.
- Exclude internal (`excludedFromMetrics`), fake-flagged, and parent accounts from all counts.

## Step-by-step (one commit per step)

### Step 1 — Funnel data (no UI)
- `lib/funnel.ts`: `loadFunnel(days = 30)` → `{ steps: FunnelStep[], chapters: Chapter[], started }` where `FunnelStep = {id, label, chapter, chapterLabel, reached, pct, dropped, dropPct}` and `Chapter = {key, label, steps, enter, exit}`. Chapter labels: Your background · Where you're at · Your academics · Your game · Your goals · Paywall. Short labels for chips: Background · Where · Academics · Game · Goals · Paywall.
- `loadPaywall(days = 30)` → `{ seen, trialDirect, closed, wheel: {entered, spun, offer90, trial, paid}, stalled10m, plans: [{key,label,trials,paid}], save: {shown, accepted} }`. Event names to look for (use the real ones from the athlete app; list them at the top of the file): paywall viewed, try-free tapped on first paywall, paywall closed, wheel viewed, wheel spun, 90%-off offer viewed, trial started from offer, paid after offer, paywall idle ≥ 10 min, cancel-save offer shown / accepted. Any missing event → `null`, rendered as `—`.
- Tests with a small `product_events` fixture: reached/dropped/dropPct per step; chapter enter/exit; paywall shares.
- **Checkpoint 1:** test output + logged `steps[0..5]` and `chapters`.

### Step 2 — InkFunnelChart
- `components/charts/InkFunnelChart.tsx` from `mock/Charts.jsx.txt`. 360-unit viewBox scaling to the card, height 132 (chapter mode) / 150 (step mode). Bars: solid ink-700 = reached (green-600 for the paywall chapter, ink-900 when selected), 45° hatch cap (ink-200, 1.4px lines) = left at this step; the tapped bar's column tinted ink-50. Gridlines at 0/25/50/75/100% with 10px gray-500 labels. Percent labels above bars when there are ≤ 8 bars (11px/700, else 9px). X labels only when ≤ 8 bars. Bars grow from the baseline with a per-bar stagger (25ms for ≤ 20 bars, 6ms otherwise).
- Props: `steps: {id,label,pct,prevPct?,chapter}[]`, `selected`, `onSelect(id)`, `showLabels`, `height`.
- **Checkpoint 2:** render it with the six chapter bars and with one chapter's steps.

### Step 3 — Summary view
- `Hero` "Started survey → paid" `{last.pct}%` (green), caption "{subscribed} of {started} people who started · last 30 days".
- `Card` (padding 16 / 2 top-bottom) with three `Rate` rows separated by hairlines:
  1. "1 · Finish the survey": a = started, b = reached(account_created)
  2. "2 · Start the free trial": a = reached(account_created), b = reached(try_free), `warn`
  3. "3 · Trial → paid": a = reached(try_free), b = reached(subscribed), `warn`
  `Rate` = label 13px/600, sub "{b} of {a} people · {a−b} lost" 11px, 6px track bar (amber-500 when `warn` and < 50%, else ink-700), right-hand percent 20px/700 (amber-800 when warn and < 50%).
- `SectionHeading` "Where most people leave" + three tappable 12px-radius cards for the top-3 steps by dropPct: label 12px/600 ellipsis, "{dropPct}%" 20px/700 amber-800, "leave here · {dropped} of {arrivals}" 10px gray-400. Tap → Graph view zoomed to that step.
- **Checkpoint 3:** screenshot at 393×852; no scroll.

### Step 4 — Graph view
- Two levels. **Chapters** (default): card header "{started} started · by chapter" left, "{last.pct}% paid" green right; `InkFunnelChart` with one bar per chapter (pct = exit / started; prevPct = previous chapter's exit / started; paywall bar green); caption "% of the {started} still in at the end of each chapter · hatched = left". Below, `Card padding="none"` with one `Row` per chapter: title, sub "{enter} came in · {exit} finished · {n} steps", right "{pct}%" 15px/700 + "−{lost} left" 10px amber-800, chevron. Tap bar or row → zoom.
- **Zoomed chapter**: header left "‹ All chapters" (ink-600) and right "{chapter} · {pct}% got through"; `InkFunnelChart` of that chapter's steps (first bar gets `prevPct` from the step before the chapter); caption "Each bar is one step · % of the {started} who started". Below, if no step selected: `Card padding="none"` "Where people leave this chapter" with the chapter's top-3 steps by dropped as `Row`s. If a step is selected: detail `Card` — "Step {i} of {n} · `{id}`" (id in mono), label 17px/700, three `Mini`: **Got here** {reached} "{pct}% of starters" · **Left here** −{dropped} "{dropPct}% of arrivals" · **Went on** {next.reached/reached}% "to next step"; then two bordered prev/next step buttons (‹ label / label ›) that can cross chapter boundaries.
- Tapping a selected bar again deselects it.
- **Checkpoint 4:** screenshots of chapter level, zoomed chapter, selected step.

### Step 5 — Steps view
- Top: header row `SectionHeading` "Signups · last 30d" + `MiniToggle` 7d / 30d / All; three `Mini`: **Started** {n} "{never} never started" · **Completed** {n} "{pct}% of started" · **Stuck** {n} "in progress". Source: `UserRecord.onboarding` for users who signed up in range.
- `Card padding="none"` accordion, one row per chapter: title 14px/600 + "· {n} steps" gray-400, 6px track bar of exit/enter (green for paywall), right "{pct}%" 16px/700 + "{enter} → {exit}" 10px, chevron rotating 90° when open. Open reveals the chapter's steps: label 13px/500 + `id` 10px mono, right "{pct}%" and "−{dropped}" (amber-800 when > 10). Tap a step → Graph view zoomed with it selected.
- Only one chapter open at a time so the view never scrolls; if an open chapter has more than 8 steps, page them 8 per page with `usePager`.
- **Checkpoint 5:** screenshot with one chapter open.

### Step 6 — Paywall view
- `Hero` "Saw the paywall → paid" `{paid/seen}%` (green), caption "{paid} of {seen} who hit the paywall · last 30 days", right slot "{stalled10m}" 18px/700 amber-800 + "stalled 10 min+".
- `Card padding="none"` tree of `Step` rows (grid `1fr 44px 44px`, padding 7×14, indent 14px per level, 6px dot on indented rows: green for conversion rows, ink-300 otherwise). Count 14px/700 (green-800 on conversion rows); the % column is **share of the row above it**:
  - Saw the paywall {seen} (note: "% column = share of the row above it")
  - ↳ Started a trial right away {trialDirect} / seen (green)
  - ↳ Closed the paywall {closed} / seen (amber %)
  - ↳↳ Landed on the wheel {entered} / closed
  - ↳↳ Spun it {spun} / entered
  - ↳↳ Saw the 90% off screen {offer90} / spun
  - ↳↳ Started a trial from the offer {trial} / offer90 (green)
  - ↳↳ Paid after the offer {paid} / trial (green)
- `SectionHeading` "Trial → paid by plan" + three `Mini` (one per plan): "{paid/trials}%", sub "{paid} of {trials} trials"; the best plan gets `accent`.
- Two `Mini`: **Wheel → paid** "{paid/entered}%" "{paid} paid of {entered} who saw the wheel" · **Cancel save offer** "{accepted/shown}%" "{accepted} of {shown} took the free month".
- Any `null` metric renders "—" and its % blank.
- **Checkpoint 6:** screenshot; no scroll.

### Step 7 — Wire the tab
- Add `{ key: 'onboarding', label: 'Onboarding' }` third in `AppHeader`. Mount `OnboardingTab` in the shell. Tab content crossfades.
- Summary/Steps/Graph share one `selectedStep` + `zoomChapter` state so "Where most people leave" and the Steps accordion both land on the Graph view with the right step highlighted.
- **Checkpoint 7:** Summary → tap a drop card → Graph zoomed with step selected → prev/next → Steps → expand → tap step → Graph. Nothing scrolls.

## Rules for Cursor
- One step at a time; wait at each checkpoint.
- Import step definitions from `lib/onboarding-steps.ts`; never hard-code the list.
- Never fabricate a number. Missing events render "—".
- No new libraries. No AI text.
- Only touch: `lib/funnel.ts`, `lib/onboarding-analytics.ts` (additive), `components/charts/InkFunnelChart.tsx`, `components/onboarding/*`, the tab list in `AppHeader`, tests.

## Definition of done
- Onboarding tab with Summary · Graph · Steps · Paywall, all from real `product_events`, all fitting one screen.
- Three headline conversion rates; top-3 drop steps; chapter graph with zoom and step detail; step accordion; paywall tree with wheel funnel and plan split.
