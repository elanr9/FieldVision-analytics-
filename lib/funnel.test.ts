import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { UserRecord } from './types';
import type { StepView } from './onboarding-analytics';
import type { FunnelStep } from './funnel';
// @ts-expect-error TS5097: node needs the .ts extension to resolve this module, tsconfig does not allow it
import { ONBOARDING_STEPS } from './onboarding-steps.ts';
// @ts-expect-error TS5097: node needs the .ts extension to resolve this module, tsconfig does not allow it
import { buildFunnel, buildPaywall, PAYWALL_EVENTS } from './funnel.ts';
// @ts-expect-error TS5097: node needs the .ts extension to resolve this module, tsconfig does not allow it
import { derivePaywallKeys } from './onboarding-analytics.ts';

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

const stepIds: string[] = ONBOARDING_STEPS.map((s: { id: string }) => s.id);

/** Views for every survey step from survey_intro up to and including `lastStepId`. */
function walk(userId: string, lastStepId: string): StepView[] {
  const end = stepIds.indexOf(lastStepId);
  return stepIds.slice(0, end + 1).map(stepId => ({ userId, stepId }));
}

const users: UserRecord[] = [
  user('u1', { trialStartedAt: IN_RANGE, paidAt: IN_RANGE, paymentType: 'inkbound_semester' }),
  user('u2', { trialStartedAt: IN_RANGE, paymentType: 'inkbound_monthly' }),
  user('u3', { signupDate: BEFORE_RANGE }),
  user('u4', { signupDate: BEFORE_RANGE }),
  user('u5', { signupDate: BEFORE_RANGE }),
  // Paid in range without a trial in range: counts nowhere in the plan split.
  user('u6', { signupDate: BEFORE_RANGE, paidAt: IN_RANGE, paymentType: 'inkbound_monthly' }),
  user('admin', { excludedFromMetrics: true, paidAt: IN_RANGE, trialStartedAt: IN_RANGE, paymentType: 'inkbound_semester' }),
  user('mom', { isParent: true }),
];

const views: StepView[] = [
  ...walk('u1', 'parent_invite_email'),
  ...walk('u2', 'parent_invite_email'),
  ...walk('u3', 'hometown'),
  ...walk('u4', 'name'),
  ...walk('u5', 'survey_intro'),
  ...walk('admin', 'parent_invite_email'),
  ...walk('mom', 'parent_invite_email'),
];

const eventUsers = new Map<string, Set<string>>([
  [PAYWALL_EVENTS.tryFreeViewed, new Set(['u1', 'u2', 'admin'])],
  [PAYWALL_EVENTS.tryFreeTapped, new Set(['u1', 'u2', 'admin'])],
]);

const funnel = buildFunnel({ defs: ONBOARDING_STEPS, views, users, eventUsers, range });
const by = (id: string): FunnelStep => {
  const step = funnel.steps.find(s => s.id === id);
  assert.ok(step, `missing step ${id}`);
  return step;
};

test('started counts real survey_intro viewers only', () => {
  assert.equal(funnel.started, 5);
  assert.equal(funnel.steps.length, ONBOARDING_STEPS.length + 5);
  assert.deepEqual(by('survey_intro'), {
    id: 'survey_intro',
    label: 'Survey intro',
    chapter: 'basic',
    chapterLabel: 'Your background',
    reached: 5,
    pct: 100,
    dropped: 0,
    dropPct: 0,
  });
});

test('reached, dropped and dropPct per survey step', () => {
  assert.deepEqual([by('name').reached, by('name').pct, by('name').dropped, by('name').dropPct], [4, 80, 1, 20]);
  assert.deepEqual([by('account_type').reached, by('account_type').dropped, by('account_type').dropPct], [3, 1, 25]);
  assert.deepEqual([by('saving').reached, by('saving').dropped, by('saving').dropPct], [2, 1, 33.3]);
  assert.equal(by('parent_invite_email').reached, 2);
});

test('paywall steps: missing events are null, subscribed drops from the last measured step', () => {
  assert.equal(by('account_created').reached, 2);
  assert.equal(by('account_created').dropped, 0);
  assert.deepEqual([by('try_free').reached, by('try_free').pct], [2, 40]);
  assert.deepEqual(by('paywall'), { id: 'paywall', label: 'Paywall', chapter: 'paywall', chapterLabel: 'Paywall', reached: null, pct: null, dropped: null, dropPct: null });
  assert.equal(by('checkout').reached, null);
  assert.deepEqual([by('subscribed').reached, by('subscribed').dropped, by('subscribed').dropPct], [1, 1, 50]);
});

test('chapter enter and exit', () => {
  const chapter = (key: string) => funnel.chapters.find(c => c.key === key);
  assert.deepEqual(funnel.chapters.map(c => c.key), ['basic', 'checkin', 'academic', 'athletic', 'goals', 'paywall']);
  assert.deepEqual([chapter('basic')?.enter, chapter('basic')?.exit, chapter('basic')?.steps.length], [5, 3, 12]);
  assert.deepEqual([chapter('checkin')?.enter, chapter('checkin')?.exit], [3, 2]);
  assert.deepEqual([chapter('paywall')?.enter, chapter('paywall')?.exit, chapter('paywall')?.steps.length], [2, 1, 5]);
  assert.equal(chapter('paywall')?.short, 'Paywall');
});

test('started falls back to signups with an intake row when no survey_intro views exist', () => {
  const noViews = buildFunnel({ defs: ONBOARDING_STEPS, views: [], users, eventUsers, range });
  assert.equal(noViews.started, 2);
  assert.equal(noViews.steps[0].reached, 2);
  assert.equal(noViews.steps[1].reached, 0);
});

test('paywall shares: nulls for missing events, plan split follows the trial cohort', () => {
  const paywall = buildPaywall({ users, eventUsers, range });
  assert.equal(paywall.seen, null);
  assert.equal(paywall.trialDirect, 2);
  assert.equal(paywall.wheel.entered, null);
  assert.equal(paywall.stalled10m, null);
  assert.deepEqual(paywall.save, { shown: null, accepted: null });
  assert.deepEqual(paywall.plans, [
    { key: 'inkbound_semester', label: '$120 semester', trials: 1, paid: 1 },
    { key: 'inkbound_offer', label: '$60 semester', trials: 0, paid: 0 },
    { key: 'inkbound_monthly', label: '$40 monthly', trials: 1, paid: 0 },
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
