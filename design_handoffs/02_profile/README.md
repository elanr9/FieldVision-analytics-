# Inkbound Analytics — Handoff 2 of N: User profile + coach conversation

**Read this whole file before writing any code. Handoff 1 (shell + Overview + People list) must be merged and approved first. Build ONLY what is in scope. Stop at each checkpoint.**

## Scope (this handoff only)

1. **ProfileScreen** — pushed when a person is tapped anywhere (People list rows from handoff 1). Athlete layout and a separate **parent** layout.
2. **ConversationScreen** — pushed from a coach reply row on the profile. Read-only thread view.
3. Wire the two `// TODO(handoff-2)` no-ops from handoff 1 (`PeopleScreen` row tap, and `open(user)` in the nav context) to push `ProfileScreen`.

Out of scope, do not build: Activity tab, check-in texts / bottom sheet (the "Text" button on the profile is a plain `sms:` link for now), Onboarding tab, Users tab, Calendar, feature-usage detail, any AI summary ("The rundown" / "AI read" were deleted on purpose; never add them back). If something looks missing, leave `// TODO(handoff-3)` and move on.

## Reference files (the truth for visuals)

> Source files in `mock/` carry a `.txt` suffix so they don't compile inside the design-system project. Strip `.txt` when reading. The interactive mock runs in the design-system project at `ui_kits/analytics/index.html`: tap any name → profile; Replies · N → tap a row → conversation.

- `mock/Profile.jsx.txt` — `ProfileScreen` (athlete + parent branches), `ConversationScreen`, `Fact`. **Copy structure and inline style values verbatim.**
- `mock/data.js.txt` — search `function background` (the five onboarding chapters and their rows) and `function thread` (message shape). Also `users[]` for the per-user fields the screen reads: `plan, planLabel, trialEndsIn, nextCharge, cancelledAgo, trialEndedAgo, lastCheckin, stats{emails,replies,views,calls}, videos[], replies[], isParent, athleteId, parentActive, junk, junkReason`.
- `mock/Header.jsx.txt` — `SubHeader` (already built in handoff 1; reuse it).
- `mock/Overview.jsx.txt` — `Mini`, `MiniToggle` (already built in handoff 1; reuse).
- `mock/keyframes.css` — already in `globals.css` from handoff 1.
- Design-system primitives used: `StatusBadge`, `Tag`, `ContactActions`, `SectionHeading`, `StatBlock`, `Card`, `Skeleton`, `SegmentedControl`. All were ported in handoff 1 except `Tag`, `ContactActions`, `StatBlock`, `Skeleton` — their sources are in `components/` (`.txt` suffix).

## Existing codebase facts (do not re-architect)

- `lib/user-dossier.ts` already loads per-user background, videos, emails and coach replies from Supabase (`DossierBackground`, `DossierVideo`, `DossierEmail`…). **Reuse it.** Do not write new Supabase queries for data it already returns.
- `components/UserDetail.tsx`, `UserDossier.tsx`, `EmailTemplates.tsx` are the OLD profile. Leave them on disk, unimported. The new screen replaces them in the UI.
- `lib/ai-summary.ts` and `app/api/dossier/*` AI routes: do not call them. Leave on disk.
- `UserRecord` (`lib/types.ts`) has `trialEndsAt`, `paidAt`, `interval`, `isParent`, `parentName`, `parentEmail`, `onboarding*`. Map to the screen fields as described in Step 2.

## Step-by-step (one commit per step)

### Step 1 — Remaining primitives
- Port `Tag`, `ContactActions`, `StatBlock`, `Skeleton` into `components/ui/` from `components/**/*.jsx.txt`, unchanged styling.
- `ContactActions`: order is always **Text · Call · Email**; Text is `variant="money"` (green), the other two `secondary`; `size="lg"` = three equal-width buttons. Hrefs `sms:`, `tel:`, `mailto:`. If neither phone nor email: render the gray text "No contact info".
- **Checkpoint 1:** show the four primitives on a scratch page, then delete the page.

### Step 2 — Profile data adapter (no UI)
- `lib/profile.ts`: `buildProfile(user: UserRecord, dossier: Dossier)` returning a plain object:
  - `planLabel` from `interval` + amount (`"$120 semester"`, `"$60 semester"`, `"$30 monthly"`).
  - `planFact: [line1, line2]` exactly per status:
    - trialing → `["$120 semester · trial", "Trial ends Sep 10 · in 14h"]`
    - paying → `["$120 semester", "Next charge Dec 14"]`
    - churned → `["$30 monthly · cancelled", "Cancelled 3d ago"]`
    - trial_ended → `["$60 semester · trial", "Trial ended 6d ago"]`
    - signed_up + onboarding in_progress → `["No plan", "In onboarding · <stepId>"]`
    - signed_up otherwise → `["No plan", "Stopped at paywall" | "Never started onboarding"]`
  - `facts`: `"Solar SC · CM · '27"` (team · position · 2-digit grad), omit missing parts.
  - `checkinEligible`: paying or trialing AND phone present. `lastCheckin`: "never" | "today" | "3d ago" (source: `checkin_log` table if it exists; otherwise hard-code "never" with `// TODO(handoff-3)`).
  - `stats`: emails sent, coach replies, highlight views (sum of `coachViews`), calls booked.
  - `videos[]`: `{title, createdAt, status, uniqueCoaches, coachViews}`.
  - `replies[]`: only emails with `replied === true`: `{school, coach, repliedAt, snippet}`.
  - `background`: five chapters in this order with these keys/labels: `basic` "Your background", `checkin` "Where you're at", `academic` "Your academics", `athletic` "Your game", `goals` "Your goals". Each is `rows: [label, value][]`. Row labels and order come from `mock/data.js.txt` `background()`; values come from `DossierBackground` + intake answers. Missing value → `"—"`. **Do not invent answers.**
- Relative dates: "today", "yesterday", "3d ago". Absolute: "Sep 10" (`en-US`, short month).
- Unit test with one paying, one trialing, one parent fixture.
- **Checkpoint 2:** show test output.

### Step 3 — ProfileScreen (athlete)
- `components/profile/ProfileScreen.tsx`. Top to bottom, exactly as the mock:
  1. `SubHeader` title = name.
  2. Name `26px/700`, letter-spacing −0.015em. Under it `email · phone` 14px gray-500.
  3. Chip row: `StatusBadge`; if the user is a parent, an ink-50 pill "Parent of {athlete} ›" (tap → open athlete); "Internal" soft Tag if `excludedFromMetrics`; "Likely fake · {reason}" soft Tag if flagged.
  4. Facts `Card` (padding 16, 2-col grid, gap 12): **Plan** / **Billing** (paying) or **Status** (others) / **Team · position · grad** / **Last check-in** (only if eligible). `Fact` = 10px uppercase label + 14px/600 value.
  5. `ContactActions size="lg"`.
  6. Four `StatBlock`s in a 4-col grid: Emails · Replies · HL views · Calls, numbers via `CountUp`.
  7. `SegmentedControl`: **Background · Videos · N · Replies · N**. Content below crossfades with `Fade`.
     - **Background:** `MiniToggle` with `Background · Where · Academics · Game · Goals`; under it one `Card` (padding 16/12, 2-col grid, gap 10×16) of label/value pairs for the selected chapter. Labels 10px uppercase gray-400, values 13px/500, single line with ellipsis.
     - **Videos:** `Card padding="none"`, one row per video: title 14px/600 (ellipsis), meta "Sep 1 · 7d ago · 9 coaches · 118 views" 12px gray-500, right pill "Published" (green-100/green-800) or gray. Empty: "No highlight videos yet." in gray-400.
     - **Replies:** `Card padding="none"`, one **button** row per reply: "Rice University · Coach Alvarez" 14px/600, right "1d ago ›" 11px gray-400, snippet 13px gray-700 single line. Tap → push `ConversationScreen`. Empty: "No coach replies yet."
  - Show `Skeleton`s for Videos/Replies while the dossier loads (700ms in the mock; real = until fetch resolves).
  - **No vertical scroll** at 393×852 for Background and for Videos/Replies with ≤3 items. If a user has more than 3 videos or replies, page them with `usePager` (3 per page). Never let the screen scroll.
- **Checkpoint 3:** screenshots of a paying athlete with replies and a trialing athlete with none.

### Step 4 — ProfileScreen (parent)
- Same file, early return when `user.isParent`:
  1. `SubHeader`, name, `email · phone`.
  2. Chips: soft Tag "Parent" + pill "Opened the app" (green) or "Never opened the app" (gray). Source: does the parent have an auth session / last_sign_in_at.
  3. Facts card (2-col): **Joined** {date} · **Invited by** "{athlete first name} · onboarding".
  4. `ContactActions size="lg"`.
  5. `SectionHeading` "Their athlete" → interactive `Card` (name 16px/700, "team · pos · grad" 12px gray-500, `StatusBadge` + plan label, chevron ›). Tap → push the athlete's profile. If no link: "No athlete linked."
  6. Three `Mini`: Emails "to coaches" · Replies "from coaches" · Videos "made" — the athlete's numbers.
- Linking: `parent_invites.player_user_id` ↔ parent email. Parents have no Background/Videos/Replies section.
- **Checkpoint 4:** screenshot of a parent profile and the tap-through to the athlete.

### Step 5 — ConversationScreen
- `components/profile/ConversationScreen.tsx`, pushed with `{user, reply}`.
  1. `SubHeader` title = school.
  2. "Subject" 10px uppercase label, subject 14px/600, "{athlete} ↔ {coach} · {school}" 12px gray-500.
  3. Thread, 10px gap, each message fades in with a 60ms stagger. Athlete bubbles: right-aligned, ink-700 bg, white text, radius `16 16 4 16`. Coach bubbles: left, white, 1px border, radius `16 16 16 4`. Max width 86%, padding 10×14, 14px/1.5, `white-space: pre-line`. Under each: "{sender} · Sep 4 · 4d ago" 10px gray-400.
  - Data: the sent email (`DossierEmail` subject/body) followed by the reply(ies) from the coach-replies table, oldest first. If the body isn't stored, show the subject only and note `// TODO(handoff-3): store outreach body`.
  - Read-only. No composer.
  - If a thread exceeds the viewport, page it with `usePager` (4 messages per page). No scrolling.
- **Checkpoint 5:** screenshot of one thread.

### Step 6 — Wire navigation
- `open(user)` in the nav context pushes `ProfileScreen`; People list rows call it. Remove the handoff-1 TODOs.
- Push key `profile-{id}`; parent → athlete push key `profile-{athleteId}`; conversation key `convo-{emailId}`.
- **Checkpoint 6:** header stat → people list → profile → reply → conversation → Back ×3 returns to Overview with no bleed-through and no scroll anywhere.

## Rules for Cursor
- One step at a time; wait for approval at each checkpoint.
- Do not redesign. Match the mock's values (radius 16 cards, 12 inner, 9999 pills; 1px `--border-default`; no shadows).
- No new libraries. No AI calls. No emoji. Sentence case; " · " separators.
- Do not touch files outside `components/ui`, `components/profile`, `lib/profile.ts`, the nav context, and tests.

## Definition of done
- Tap any person → athlete or parent profile, correct facts, contact buttons, four stats, Background/Videos/Replies mini nav, no scrolling.
- Tap a reply → thread view → Back.
- Parent → "Their athlete" card → athlete profile.
