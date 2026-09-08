import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PlanInterval, UserRecord } from './types';
import type { StepView } from './onboarding-analytics';
import type { FunnelStep } from './funnel';
// @ts-expect-error TS5097: node needs the .ts extension to resolve this module, tsconfig does not allow it
import { ONBOARDING_STEPS } from './onboarding-steps.ts';
// @ts-expect-error TS5097: node needs the .ts extension to resolve this module, tsconfig does not allow it
import { buildFunnel, buildPaywall, PAYWALL_EVENTS } from './funnel.ts';

const NOW = new Date('2026-09-08T12:00:00');
const range = { from: new Date('2026-08-09T12:00:00'), to: NOW };
const IN_RANGE = '2026-08-20T10:00:00';
const BEFORE_RANGE = '2026-07-01T10:00:00';

interface UserOpts {
  signupDate?: string;
  trialStartedAt?: string | null;
  paidAt?: string | null;
  interval?: PlanInterval;
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
    paymentType: null,
    status: 'signed_up',
    interval: opts.interval ?? 'unknown',
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
  user('u1', { trialStartedAt: IN_RANGE, paidAt: IN_RANGE, interval: 'annual' }),
  user('u2', { trialStartedAt: IN_RANGE, interval: 'monthly' }),
  user('u3', { signupDate: BEFORE_RANGE }),
  user('u4', { signupDate: BEFORE_RANGE }),
  user('u5', { signupDate: BEFORE_RANGE }),
  user('admin', { excludedFromMetrics: true, paidAt: IN_RANGE, trialStartedAt: IN_RANGE, interval: 'annual' }),
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

const eventUsers = new Map<string, Set<string>>([[PAYWALL_EVENTS.tryFreeTapped, new Set(['u1', 'u2', 'admin'])]]);

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

test('paywall shares: nulls for missing events, plan split from included users', () => {
  const paywall = buildPaywall({ users, eventUsers, range });
  assert.equal(paywall.seen, null);
  assert.equal(paywall.trialDirect, 2);
  assert.equal(paywall.wheel.entered, null);
  assert.equal(paywall.stalled10m, null);
  assert.deepEqual(paywall.save, { shown: null, accepted: null });
  assert.deepEqual(paywall.plans, [
    { key: 'monthly', label: 'Monthly', trials: 1, paid: 0 },
    { key: 'annual', label: 'Annual', trials: 1, paid: 1 },
    { key: 'lifetime', label: 'Lifetime', trials: 0, paid: 0 },
  ]);
});
