import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { UserRecord, UserStatus } from './types';
import type { RevenueSnapshot } from './stripe-revenue';
import type { Bucket } from './overview';
// @ts-expect-error TS5097: node needs the .ts extension to resolve this module, tsconfig does not allow it
import { buildMonths, buildWeeks, buildTotals, buildOverview } from './overview.ts';

// Tuesday. Current week starts Sunday Sep 6, current month is Sep.
const NOW = new Date('2026-09-08T12:00:00');

function user(
  id: string,
  status: UserStatus,
  signupDate: string,
  trialStartedAt: string | null,
  paidAt: string | null,
  excludedFromMetrics = false,
): UserRecord {
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
    signupDate,
    trialStartedAt,
    trialEndsAt: null,
    paidAt,
    paymentType: null,
    status,
    interval: 'unknown',
    isParent: false,
    excludedFromMetrics,
    onboarding: 'completed',
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

const users: UserRecord[] = [
  user('u1', 'paying', '2026-06-14T10:00:00', '2026-06-14T10:00:00', '2026-06-17T10:00:00'),
  user('u2', 'trialing', '2026-08-30T10:00:00', '2026-08-31T10:00:00', null),
  user('u3', 'churned', '2026-07-03T10:00:00', '2026-07-03T10:00:00', '2026-07-06T10:00:00'),
  user('u4', 'signed_up', '2026-09-07T10:00:00', null, null),
  user('demo', 'paying', '2026-04-01T10:00:00', '2026-04-01T10:00:00', '2026-04-02T10:00:00', true),
];

const revenue: RevenueSnapshot = {
  configured: true,
  mrrCents: 15000,
  activeSubscriptionCount: 1,
  events: [
    { paidAt: '2026-06-17T10:00:00', cents: 12000, planType: 'semester', userId: 'u1' },
    { paidAt: '2026-07-06T10:00:00', cents: 3000, planType: 'monthly', userId: 'u3' },
    { paidAt: '2026-08-20T10:00:00', cents: 3000, planType: null, userId: null },
    { paidAt: '2026-09-01T10:00:00', cents: 99900, planType: 'semester', userId: 'demo' },
    { paidAt: '2026-09-07T10:00:00', cents: 12000, planType: 'semester', userId: 'u1' },
  ],
};

function labelsOf(buckets: Bucket[]): string[] {
  return buckets.map(b => b.label);
}

test('months run from the earliest included signup through the current month', () => {
  const months = buildMonths(users, revenue, NOW);
  console.log(JSON.stringify(months, null, 2));

  assert.equal(months.length, 4);
  assert.deepEqual(labelsOf(months), ['Jun', 'Jul', 'Aug', 'Sep']);
  assert.deepEqual(months.map(m => m.partial), [false, false, false, true]);
  assert.deepEqual(months, [
    { label: 'Jun', revenue: 12000, signups: 1, trials: 1, paying: 1, partial: false },
    { label: 'Jul', revenue: 3000, signups: 1, trials: 1, paying: 1, partial: false },
    { label: 'Aug', revenue: 3000, signups: 1, trials: 1, paying: 0, partial: false },
    { label: 'Sep', revenue: 12000, signups: 1, trials: 0, paying: 0, partial: true },
  ]);
});

test('weeks are the last 12 Sunday-start weeks, oldest first', () => {
  const weeks = buildWeeks(users, revenue, NOW);

  assert.equal(weeks.length, 12);
  assert.deepEqual(labelsOf(weeks), [
    'Jun 21', 'Jun 28', 'Jul 5', 'Jul 12', 'Jul 19', 'Jul 26',
    'Aug 2', 'Aug 9', 'Aug 16', 'Aug 23', 'Aug 30', 'Sep 6',
  ]);
  assert.deepEqual(weeks.map(w => w.partial), [
    false, false, false, false, false, false, false, false, false, false, false, true,
  ]);
  assert.deepEqual(weeks[1], { label: 'Jun 28', revenue: 0, signups: 1, trials: 1, paying: 0, partial: false });
  assert.deepEqual(weeks[2], { label: 'Jul 5', revenue: 3000, signups: 0, trials: 0, paying: 1, partial: false });
  assert.deepEqual(weeks[10], { label: 'Aug 30', revenue: 0, signups: 1, trials: 1, paying: 0, partial: false });
  assert.deepEqual(weeks[11], { label: 'Sep 6', revenue: 12000, signups: 1, trials: 0, paying: 0, partial: true });
});

test('excluded users and their revenue are ignored', () => {
  const months = buildMonths(users, revenue, NOW);
  const totals = buildTotals(users, revenue);

  assert.equal(months[0].label, 'Jun', 'the excluded April signup does not extend the month range');
  assert.equal(months.find(m => m.label === 'Sep')?.revenue, 12000, 'the excluded 99900 event is dropped');
  assert.equal(totals.revenue, 30000);
  assert.equal(totals.signups, 4);
});

test('totals are all-time', () => {
  const totals = buildTotals(users, revenue);

  assert.deepEqual(totals, {
    revenue: 30000,
    payments: 4,
    mrr: 15000,
    payingNow: 1,
    payingEver: 2,
    signups: 4,
    trials: 3,
    trialingNow: 1,
    churned: 1,
  });
});

test('buildOverview bundles months, weeks and totals', () => {
  const overview = buildOverview(users, revenue, NOW);

  assert.deepEqual(overview.months, buildMonths(users, revenue, NOW));
  assert.deepEqual(overview.weeks, buildWeeks(users, revenue, NOW));
  assert.deepEqual(overview.totals, buildTotals(users, revenue));
});
