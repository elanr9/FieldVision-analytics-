import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { UserRecord } from './types';
import { derivePaywallKeys, type ScreenEvent } from './onboarding-analytics';
import { FLOW_SCREEN_DEFS, type FlowScreenDef } from './onboarding-flow.generated';
import { flowScreens } from './onboarding-flow';
import { buildFunnel, buildPaywall, buildPlans, PAYWALL_EVENTS, SUBSCRIBED_STEP_ID, TRIAL_STEP_ID, type FunnelStep } from './funnel';

const NOW = new Date('2026-09-08T12:00:00');
const range = { from: new Date('2026-08-09T12:00:00'), to: NOW };
const IN_RANGE = '2026-08-20T10:00:00';
const BEFORE_RANGE = '2026-07-01T10:00:00';

interface UserOpts {
  signupDate?: string;
  trialStartedAt?: string | null;
  paidAt?: string | null;
  paymentType?: string | null;
  excludedFromMetrics?: boolean;
  isParent?: boolean;
  onboarding?: UserRecord['onboarding'];
}

function user(id: string, opts: UserOpts = {}): UserRecord {
  return {
    id,
    name: id,
    email: `${id}@example.com`,
    phone: null,
    team: null,
    position: null,
    gradYear: null,
    parentName: null,
    parentEmail: null,
    signupDate: opts.signupDate ?? IN_RANGE,
    trialStartedAt: opts.trialStartedAt ?? null,
    trialEndsAt: null,
    paidAt: opts.paidAt ?? null,
    paymentType: opts.paymentType ?? null,
    status: 'signed_up',
    interval: 'unknown',
    isParent: opts.isParent ?? false,
    excludedFromMetrics: opts.excludedFromMetrics ?? false,
    onboarding: opts.onboarding ?? 'in_progress',
    onboardingActive: false,
    onboardingStepIndex: null,
    onboardingStepId: null,
    onboardingStepLabel: null,
    onboardingChapter: null,
    onboardingChapterLabel: null,
    onboardingStepKind: null,
    onboardingTotalSteps: null,
    pipeline: null,
  };
}

const DEFS: FlowScreenDef[] = FLOW_SCREEN_DEFS;
const screenIndex = (id: string) => DEFS.findIndex(d => d.id === id);

function views(userId: string, ...screens: string[]): ScreenEvent[] {
  return screens.map(screen => ({ userId, screen, kind: 'view' as const }));
}

/** Screens from `fromId` up to and including `toId`, in flow order. */
function walk(userId: string, fromId: string, toId: string): ScreenEvent[] {
  return views(userId, ...DEFS.slice(screenIndex(fromId), screenIndex(toId) + 1).map(d => d.id));
}

const users: UserRecord[] = [
  user('u1', { trialStartedAt: IN_RANGE, paidAt: IN_RANGE, paymentType: 'inkbound_semester' }),
  user('u2', { trialStartedAt: IN_RANGE, paymentType: 'inkbound_monthly' }),
  user('u3'),
  // Account in range but no events: an app build that does not track yet. Counts as started, drops at the first screen.
  user('u4'),
  user('u5', { signupDate: BEFORE_RANGE }),
  // Paid in range without a trial in range: counts nowhere in the plan split.
  user('u6', { signupDate: BEFORE_RANGE, paidAt: IN_RANGE, paymentType: 'inkbound_monthly' }),
  user('admin', { excludedFromMetrics: true, paidAt: IN_RANGE, trialStartedAt: IN_RANGE, paymentType: 'inkbound_semester' }),
  user('mom', { isParent: true }),
];

// Today the apps only write events once signed in, so nothing before the account screen's answer is recorded.
const events: ScreenEvent[] = [
  { userId: 'u1', screen: 's31_verify_phone', kind: 'answer' },
  ...walk('u1', 's32_find_home', 's37_paywall'),
  ...views('u1', 's33c_new_thing'),
  { userId: 'u2', screen: 's31_verify_phone', kind: 'answer' },
  ...views('u2', 's32_find_home', 's33_goals', 's34_building_plan', 's35_plan_ready'),
  { userId: 'u3', screen: 's31_verify_phone', kind: 'answer' },
  ...views('u3', 's32_find_home'),
  ...walk('u5', 's32_find_home', 's38_one_time_offer'),
  ...walk('admin', 's32_find_home', 's38_one_time_offer'),
  ...walk('mom', 's32_find_home', 's38_one_time_offer'),
];

const eventUsers = new Map<string, Set<string>>([
  [PAYWALL_EVENTS.tryFreeViewed, new Set(['u1', 'u2', 'admin'])],
  [PAYWALL_EVENTS.tryFreeTapped, new Set(['u1', 'u2', 'admin'])],
]);

const funnel = buildFunnel({ events, users, range });
const by = (id: string): FunnelStep => {
  const step = funnel.steps.find(s => s.id === id);
  assert.ok(step, `missing step ${id}`);
  return step;
};
const drop = (id: string) => [by(id).reached, by(id).pct, by(id).dropped, by(id).dropPct];

test('started falls back to accounts created in range while screens before sign-in are untracked', () => {
  assert.equal(funnel.startedSource, 'accounts_created');
  assert.equal(funnel.started, 4);
  assert.equal(funnel.untrackedSteps, screenIndex('s31_verify_phone'));
  assert.deepEqual(by('s01_welcome'), {
    id: 's01_welcome',
    label: 'Welcome',
    chapter: 'welcome',
    chapterLabel: 'Welcome and feelings',
    conditional: false,
    known: true,
    reached: null,
    pct: null,
    dropped: null,
    dropPct: null,
  });
  assert.equal(by('s30_about_you').reached, null);
});

test('reached, dropped and dropPct per tracked screen, counting a view or an answer', () => {
  assert.deepEqual(drop('s31_verify_phone'), [3, 75, 1, 25]);
  assert.deepEqual(drop('s32_find_home'), [3, 75, 0, 0]);
  assert.deepEqual(drop('s33_goals'), [2, 50, 1, 33.3]);
  assert.deepEqual(drop('s34_building_plan'), [2, 50, 0, 0]);
  assert.deepEqual(drop('s36_try_free'), [1, 25, 1, 50]);
  assert.deepEqual(drop('s37_paywall'), [1, 25, 0, 0]);
  assert.deepEqual(drop('s37d_parent_invite_sent'), [0, 0, null, null]);
});

test('conditional screens show reach but never a drop, and do not feed the next drop', () => {
  assert.deepEqual(drop('s33b_invite_parent'), [1, 25, null, null]);
  assert.equal(by('s33b_invite_parent').conditional, true);
  assert.deepEqual(drop('s34_building_plan'), [2, 50, 0, 0]);
});

test('screens the mirror does not know yet are slotted in by id and flagged', () => {
  const unknown = by('s33c_new_thing');
  assert.deepEqual([unknown.known, unknown.conditional, unknown.chapter, unknown.label, unknown.reached], [false, true, 'plan', 'New thing', 1]);
  const at = (id: string) => funnel.steps.findIndex(s => s.id === id);
  assert.ok(at('s33b_invite_parent') < at('s33c_new_thing') && at('s33c_new_thing') < at('s34_building_plan'));
  assert.deepEqual(funnel.unknownScreens, ['s33c_new_thing']);
});

test('trial and paid close the funnel from account data', () => {
  assert.deepEqual(drop(TRIAL_STEP_ID), [2, 50, 0, 0]);
  assert.deepEqual(drop(SUBSCRIBED_STEP_ID), [1, 25, 1, 50]);
  assert.equal(funnel.steps[funnel.steps.length - 1].id, SUBSCRIBED_STEP_ID);
  assert.equal(funnel.steps.length, DEFS.length + 3);
});

test('chapter enter and exit follow the flow sections', () => {
  const chapter = (key: string) => funnel.chapters.find(c => c.key === key);
  assert.deepEqual(funnel.chapters.map(c => c.key), ['welcome', 'progress', 'academics', 'game', 'personal', 'plan', 'paywall']);
  assert.deepEqual([chapter('welcome')?.enter, chapter('welcome')?.exit], [null, null]);
  assert.deepEqual([chapter('personal')?.enter, chapter('personal')?.exit], [4, 3]);
  assert.deepEqual([chapter('plan')?.enter, chapter('plan')?.exit, chapter('plan')?.steps.length], [3, 2, 6]);
  assert.deepEqual([chapter('paywall')?.enter, chapter('paywall')?.exit, chapter('paywall')?.short], [2, 1, 'Paywall']);
});

test('once the apps record the welcome screen, started switches to its viewers and nothing is untracked', () => {
  const tracked = buildFunnel({ events: [...views('u1', 's01_welcome', 's02_role'), ...views('u2', 's01_welcome'), ...views('u3', 's01_welcome'), ...views('mom', 's01_welcome')], users, range });
  assert.equal(tracked.startedSource, 'welcome_screen');
  assert.equal(tracked.started, 3);
  assert.equal(tracked.untrackedSteps, 0);
  assert.deepEqual([tracked.steps[0].reached, tracked.steps[0].pct], [3, 100]);
  assert.deepEqual([tracked.steps[1].reached, tracked.steps[1].dropped, tracked.steps[1].dropPct], [1, 2, 66.7]);
  assert.equal(tracked.steps[2].reached, 0);
});

test('flowScreens merges observed ids into the mirror by numeric prefix and ignores non-flow names', () => {
  const merged = flowScreens(['s12b_follow_up', 'home', 's99_future']);
  const ids = merged.map(s => s.id);
  assert.ok(ids.indexOf('s12_emailed') < ids.indexOf('s12b_follow_up') && ids.indexOf('s12b_follow_up') < ids.indexOf('s13_replied'));
  assert.equal(merged.find(s => s.id === 's12b_follow_up')?.section, 2);
  assert.equal(merged.find(s => s.id === 's99_future')?.section, 7);
  assert.equal(merged.find(s => s.id === 's99_future')?.label, 'Future');
  assert.ok(!ids.includes('home'));
});

test('generated flow mirror matches the athlete apps when their checkouts are present', async t => {
  const { collectScreens, render } = await import('../scripts/sync-onboarding-flow.mjs');
  const collected = collectScreens();
  if (collected.sources.length === 0) {
    t.skip('inkbound-web / inkbound-mobile not checked out next to this repo');
    return;
  }
  const current = await readFile(new URL('./onboarding-flow.generated.ts', import.meta.url), 'utf8');
  assert.equal(current, render(collected), 'run: node scripts/sync-onboarding-flow.mjs');
});

test('paywall shares: nulls for missing events, plan split follows the trial cohort', () => {
  const paywall = buildPaywall({ users, eventUsers, range });
  assert.equal(paywall.seen, null);
  assert.equal(paywall.trialDirect, 2);
  assert.equal(paywall.wheel.entered, null);
  assert.equal(paywall.stalled10m, null);
  assert.deepEqual(paywall.save, { shown: null, accepted: null });
  assert.deepEqual(paywall.plans, [
    { key: 'inkbound_monthly', label: '$40 monthly', trials: 1, paid: 0 },
    { key: 'inkbound_semester', label: '$120 semester', trials: 1, paid: 1 },
    { key: 'inkbound_offer', label: '$60 semester', trials: 0, paid: 0 },
  ]);
});

test('plan tiles follow the trial cohort: unknown payment types surface, most trials first, Inkbound plans fill the rest', () => {
  const legacy = [
    user('a', { trialStartedAt: IN_RANGE, paymentType: 'inkbound_weekly' }),
    user('b', { trialStartedAt: IN_RANGE, paymentType: 'inkbound_weekly', paidAt: IN_RANGE }),
    user('c', { trialStartedAt: IN_RANGE, paymentType: 'inkbound_monthly' }),
    // Statuses stored in payment_type are not plans.
    user('d', { trialStartedAt: IN_RANGE, paymentType: 'canceled', paidAt: IN_RANGE }),
    user('e', { trialStartedAt: IN_RANGE, paymentType: 'inkbound_parent_pending' }),
  ];
  assert.deepEqual(buildPlans(legacy, range), [
    { key: 'inkbound_weekly', label: 'Weekly', trials: 2, paid: 1 },
    { key: 'inkbound_monthly', label: '$40 monthly', trials: 1, paid: 0 },
    { key: 'inkbound_semester', label: '$120 semester', trials: 0, paid: 0 },
  ]);
});

test('derivePaywallKeys maps flow screen views and answers to funnel signals', () => {
  const view = (screen: string) => ({ name: 'onboarding_screen_view', user_id: 'u1', properties: { screen } });
  const answer = (screen: string, extra: Record<string, unknown> = {}) => ({ name: 'onboarding_answer', user_id: 'u1', properties: { screen, ...extra } });
  assert.deepEqual(derivePaywallKeys(view('s36_try_free')), [PAYWALL_EVENTS.tryFreeViewed]);
  assert.deepEqual(derivePaywallKeys(view('s37_paywall')), [PAYWALL_EVENTS.paywallViewed]);
  assert.deepEqual(derivePaywallKeys(view('s37c_spin_wheel')), [PAYWALL_EVENTS.wheelViewed, PAYWALL_EVENTS.paywallClosed]);
  assert.deepEqual(derivePaywallKeys(view('s38_one_time_offer')), [PAYWALL_EVENTS.offer90Viewed]);
  assert.deepEqual(derivePaywallKeys(answer('s37_paywall', { plan: 'semester' })), [PAYWALL_EVENTS.tryFreeTapped, PAYWALL_EVENTS.checkoutStarted]);
  assert.deepEqual(derivePaywallKeys(answer('s37_paywall')), []);
  assert.deepEqual(derivePaywallKeys(answer('s37c_spin_wheel', { spin: 1 })), [PAYWALL_EVENTS.wheelSpun]);
  assert.deepEqual(derivePaywallKeys(answer('s38_one_time_offer', { plan: 'offer' })), [PAYWALL_EVENTS.offerTrialStarted, PAYWALL_EVENTS.checkoutStarted]);
  assert.deepEqual(derivePaywallKeys({ name: 'retention_offer_accepted', user_id: 'u1', properties: {} }), [PAYWALL_EVENTS.saveOfferAccepted]);
  assert.deepEqual(derivePaywallKeys(view('s01_welcome')), []);
});
