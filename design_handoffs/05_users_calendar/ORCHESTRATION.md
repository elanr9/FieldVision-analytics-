# Orchestration — build this handoff in one shot with parallel subagents

You are the orchestrator. Do not build anything yourself. Read README.md fully, then spawn three subagents at once (Cursor background agents / worktrees), each on its own branch from `main`, each given the shared preamble plus its own block below. Wait for all three, merge in order A → B → C, run the final checks, report once.

There are no checkpoints and no approval waits anywhere in this handoff. Where the README says "Checkpoint", read it as "capture a screenshot for the final report and continue". Nobody asks the user questions; make the call and note it in the report.

## Shared preamble (give to every subagent verbatim)

```
You are one of three agents building handoff 5 in parallel on this repo from `main` (handoffs 1–4 merged). Work only on your branch. Run to completion without stopping — no checkpoints, no approval waits, no questions. Make the call and note it in your report.

Your handoff folder is design_handoffs/05_users_calendar/. Read README.md fully first, then build only your section. Reference sources in mock/ carry a .txt suffix; strip it when reading. Copy structure and inline style values verbatim from the mock.

Rules:
- Do not add libraries. Reuse everything already ported: components/ui/*, components/motion/*, components/charts/*, components/overview/*, components/shell/*, PeopleScreen, ProfileScreen, usePager, SubHeader, FIcon.
- Zero vertical scroll at 393×852 on every screen and filter state. Verify with scrollHeight <= innerHeight; include the numbers in your report.
- One commit per README step you own. Never fabricate a number; missing events render "—". No AI text.
- Touch only your ownership list plus the exact one-line edits named. Other agents own everything else.
- Finish with: tsc --noEmit clean, your tests passing, 393×852 screenshots of each screen/state, and a "Things you should know" list.
```

## Agent A — Users tab (branch `h5-users`)

```
You own: lib/fake-accounts.ts, lib/users.ts, their tests, components/users/**.
Only other edit: add `{ key: 'users', label: 'Users' }` fourth in the tabs array and the `tab === 'users'` mount branch in the shell.
Build README Step 1 (fake-account rule + lib/users.ts only — NOT lib/usage.ts) and Step 2, plus the Step 5 requirement that bucket, sub-filter, page and search text survive profile → back.
Screenshots: Customers · Paying, Leads · Stuck, Parents · All, Likely fake, a search with matches.
```

## Agent B — Calendar tab (branch `h5-calendar`)

```
You own: components/calendar/**.
Only other edit: add `{ key: 'calendar', label: 'Calendar' }` fifth in the tabs array (after Users — another agent is adding that entry; if absent, add yours after Onboarding; the orchestrator reorders on merge) and the `tab === 'calendar'` mount branch. If five tabs do not fit at 393px, make the tab row scroll horizontally keeping the active tab in view via scrollLeft (never scrollIntoView); do not shrink labels.
Data: derive `real` (no parents, no junk, no excludedFromMetrics) from the loader handoff 1's People screen already uses; do not create lib/users.ts — another agent owns it. Treat isParent/junk as false if the record lacks them and note it.
Build README Step 3.
Screenshots: current month no selection, a selected day with 2+ signups, a selected day with none, a 6-row month with a 3-row panel.
```

## Agent C — Feature usage screen (branch `h5-usage`)

```
You own: lib/usage.ts, its tests, components/usage/**.
Only other edit: replace the two `// TODO(handoff-5)` no-ops in the Overview Usage view with `push({ key: 'usage', node: <UsageScreen focus={f.id} /> })` and `push({ key: 'usage', node: <UsageScreen /> })`. Do not touch the tabs array or the tab mount.
Build README Step 1 (lib/usage.ts only) and Step 4.
Screenshots: Ranked (Events), Trend for one feature, Share; confirm back returns to Overview → Usage with state intact.
```

## Orchestrator: after all three finish

1. Merge `h5-users` → `main`.
2. Merge `h5-calendar` → `main`. Resolve the tabs array so the order is Overview · Activity · Onboarding · Users · Calendar.
3. Merge `h5-usage` → `main`.
4. `tsc --noEmit`, run every test, and a zero-scroll pass (scrollHeight <= innerHeight at 393×852) on all five tabs plus the Usage screen and one profile.
5. Report once: commits per agent, all screenshots, scroll numbers, typecheck/test output, and the merged "Things you should know" lists. Flag anything a subagent decided on its own.
