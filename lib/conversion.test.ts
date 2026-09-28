import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ProfileRow, SubscriptionRow } from './types';
// @ts-expect-error TS5097: node needs the .ts extension to resolve this module, tsconfig does not allow it
import { classifyUser } from './classify.ts';
// @ts-expect-error TS5097: node needs the .ts extension to resolve this module, tsconfig does not allow it
import { explainLoss } from './conversion/reasons.ts';
// @ts-expect-error TS5097: node needs the .ts extension to resolve this module, tsconfig does not allow it
import { buildCases, buildConversionReport } from './conversion/report.ts';
import type { Engagement, UserLifecycle } from './conversion/lifecycle';

const NOW = new Date('2026-09-27T12:00:00Z');

function profile(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    user_id: 'u1',
    full_name: 'Maya Lopez',
    email: 'maya@example.com',
    notification_email: null,
    phone_number: null,
    current_team: null,
    graduation_year: null,
    positions: null,
    created_at: '2026-08-01T10:00:00Z',
    trial_started_at: '2026-08-01T10:00:00Z',
    account_type: 'athlete',
    is_demo: false,
    is_ambassador: false,
    is_admin: false,
    ...overrides,
  };
}

function sub(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    user_id: 'u1',
    plan: 'free',
    payment_type: 'canceled',
    stripe_subscription_id: 'sub_1',
    amount_cents: 0,
    paid_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-05T10:00:00Z',
    ...overrides,
  };
}

test('a canceled subscription that was never charged is a lost trial, not churn', () => {
  assert.equal(classifyUser(profile(), sub(), NOW).status, 'trial_ended');
  assert.equal(classifyUser(profile(), sub({ amount_cents: 2999 }), NOW).status, 'churned');
});

test('review accounts are comped and excluded like demo accounts', () => {
  const c = classifyUser(profile({ is_review_account: true }), sub({ plan: 'full', amount_cents: 2999 }), NOW);
  assert.equal(c.status, 'comped');
  assert.equal(c.excludedFromMetrics, true);
});

function engagement(overrides: Partial<Engagement> = {}): Engagement {
  return {
    emailsSent: 0,
    repliesReceived: 0,
    campaignsCreated: 0,
    videosCreated: 0,
    videosPublished: 0,
    activeDays: 0,
    firstActiveAt: null,
    lastActiveAt: null,
    daysSilentBeforeEnd: null,
    lifetimeActions: 0,
    lifetime: { emailsSent: overrides.emailsSent ?? 0, repliesReceived: overrides.repliesReceived ?? 0, campaignsCreated: 0, videosCreated: 0, videosPublished: 0 },
    ...overrides,
  };
}

function lifecycle(overrides: Partial<UserLifecycle> = {}): UserLifecycle {
  return {
    userId: 'u1',
    name: 'Maya Lopez',
    email: 'maya@example.com',
    signupAt: '2026-08-01T10:00:00Z',
    lastSignInAt: null,
    onboarding: 'completed',
    onboardingStepLabel: null,
    onboardingChapterLabel: null,
    trialStartAt: '2026-08-01T10:00:00Z',
    trialEndAt: '2026-08-08T10:00:00Z',
    canceledAt: '2026-08-05T10:00:00Z',
    firstChargeAt: null,
    daysToCancel: 4,
    planTried: 'yearly_240_trial',
    planLabel: '$240 yearly',
    planAssumed: false,
    planMonthlyCents: 2000,
    planOneTimeCents: 0,
    outcome: 'canceled_in_trial',
    stripe: null,
    engagement: engagement(),
    warnings: [],
    ...overrides,
  };
}

test('explainLoss picks the most specific reason in priority order', () => {
  assert.equal(explainLoss(lifecycle({ outcome: 'converted' })), null);
  assert.equal(explainLoss(lifecycle({ outcome: 'still_trialing' })), null);
  assert.equal(explainLoss(lifecycle({ outcome: 'payment_failed' }))?.reason, 'payment_failed');
  assert.equal(explainLoss(lifecycle({ outcome: 'refunded' }))?.reason, 'refunded');
  assert.equal(explainLoss(lifecycle({ daysToCancel: 0.3 }))?.reason, 'cancel_day_one');
  assert.equal(explainLoss(lifecycle())?.reason, 'never_activated');
  assert.equal(explainLoss(lifecycle({ outcome: 'trial_expired', canceledAt: null, daysToCancel: null }))?.reason, 'expired_silently');
  assert.equal(explainLoss(lifecycle({ engagement: engagement({ emailsSent: 400, activeDays: 5, daysSilentBeforeEnd: 0 }) }))?.reason, 'sent_no_replies');
  assert.equal(explainLoss(lifecycle({ engagement: engagement({ emailsSent: 400, repliesReceived: 6, activeDays: 5, daysSilentBeforeEnd: 0 }) }))?.reason, 'power_user_left');
  assert.equal(explainLoss(lifecycle({ outcome: 'paid_churned', engagement: engagement({ emailsSent: 3 }) }))?.reason, 'paid_then_left');
  assert.equal(explainLoss(lifecycle({ engagement: engagement({ emailsSent: 12, activeDays: 3, daysSilentBeforeEnd: 0 }) }))?.reason, 'sent_no_replies');
  assert.equal(explainLoss(lifecycle({ engagement: engagement({ campaignsCreated: 1, videosCreated: 1, daysSilentBeforeEnd: 4 }) }))?.reason, 'went_silent');
  assert.equal(explainLoss(lifecycle({ outcome: 'stopped_at_paywall', trialStartAt: null, canceledAt: null, daysToCancel: null }))?.reason, 'stopped_at_paywall');
  assert.equal(explainLoss(lifecycle({ outcome: 'abandoned_onboarding', onboarding: 'in_progress', trialStartAt: null }))?.reason, 'abandoned_onboarding');
  assert.equal(explainLoss(lifecycle({ outcome: 'never_opened', onboarding: 'none', trialStartAt: null }))?.reason, 'never_opened');
});

test('a day one cancel that already used the product is not a day one dodge', () => {
  const verdict = explainLoss(lifecycle({ daysToCancel: 0.5, engagement: engagement({ emailsSent: 5, daysSilentBeforeEnd: 0 }) }));
  assert.equal(verdict?.reason, 'sent_no_replies');
});

test('report aggregates leaks, reasons, plans, and fixes from the cases', () => {
  const cases = buildCases([
    lifecycle({ userId: 'a', outcome: 'converted', canceledAt: null, daysToCancel: null, engagement: engagement({ emailsSent: 40, activeDays: 6 }) }),
    lifecycle({ userId: 'b' }),
    lifecycle({ userId: 'c', daysToCancel: 0.2 }),
    lifecycle({ userId: 'd', outcome: 'never_opened', onboarding: 'none', trialStartAt: null, canceledAt: null, daysToCancel: null, planTried: null, planLabel: null, planMonthlyCents: 0 }),
  ]);
  const report = buildConversionReport({ cases, stripe: { configured: true, error: null }, generatedAt: NOW.toISOString() });

  assert.equal(report.headline.candidates, 4);
  assert.equal(report.headline.trials, 3);
  assert.equal(report.headline.converted, 1);
  assert.equal(report.headline.trialToPaidPct, 33.3);
  assert.equal(report.headline.lostMonthlyCents, 4000);
  assert.deepEqual(
    report.leaks.map(s => [s.key, s.count]),
    [
      ['signed_up', 4],
      ['finished_onboarding', 3],
      ['started_trial', 3],
      ['used_trial', 1],
      ['converted', 1],
    ],
  );
  assert.deepEqual(
    report.reasons.map(r => [r.reason, r.count]),
    [
      ['cancel_day_one', 1],
      ['never_activated', 1],
      ['never_opened', 1],
    ],
  );
  assert.deepEqual(report.plans, [{ plan: 'yearly_240_trial', label: '$240 yearly', trials: 3, converted: 1, canceled: 2, ratePct: 33, userIds: ['a', 'b', 'c'] }]);
  assert.equal(report.cohorts[0].userIds.length, 4);
  assert.deepEqual(report.timeToCancel.map(b => b.count), [1, 0, 0, 0, 1, 0, 0, 0, 0]);
  assert.equal(report.headline.lostTrials, 2);
  assert.equal(report.fixes[0].reason, 'cancel_day_one');
  assert.equal(report.comparison.converters.emailsTotal, 40);
  assert.equal(report.comparison.converters.emailedInTrialPct, 100);
  assert.equal(report.comparison.lost.people, 2);
  assert.equal(report.comparison.lost.activatedPct, 0);
});

test('the range filter anchors on trial start, or signup when there was no trial', () => {
  const cases = buildCases([
    lifecycle({ userId: 'old', trialStartAt: '2026-05-01T10:00:00Z' }),
    lifecycle({ userId: 'new', trialStartAt: '2026-09-20T10:00:00Z' }),
  ]);
  const report = buildConversionReport({ cases, stripe: { configured: false, error: null }, generatedAt: NOW.toISOString() }, { from: new Date('2026-09-01T00:00:00Z'), to: NOW });
  assert.equal(report.headline.candidates, 1);
  assert.equal(report.warnings[0].text.startsWith('STRIPE_SECRET_KEY'), true);
});
