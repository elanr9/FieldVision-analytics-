import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { UserRecord } from './types';
// @ts-expect-error TS5097: node needs the .ts extension to resolve this module, tsconfig does not allow it
import { buildEveryone, type AccountActivity } from './users.ts';

// Tuesday Sep 8, 2026.
const NOW = new Date('2026-09-08T12:00:00');

function user(overrides: Partial<UserRecord>): UserRecord {
  return {
    id: 'u1',
    name: 'Maya Okafor',
    email: 'maya.okafor@gmail.com',
    phone: null,
    team: null,
    position: null,
    gradYear: null,
    parentName: null,
    parentEmail: null,
    signupDate: '2026-08-17T10:00:00',
    trialStartedAt: null,
    trialEndsAt: null,
    paidAt: null,
    paymentType: null,
    status: 'signed_up',
    interval: 'unknown',
    isParent: false,
    excludedFromMetrics: false,
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
    ...overrides,
  };
}

const active: AccountActivity = { eventCount: 5, sawPaywall: false };

test('excluded accounts are dropped before the fake rule runs', () => {
  const rows = buildEveryone([user({ id: 'founder', name: 'test', excludedFromMetrics: true }), user({ id: 'u1' })], new Map([['u1', active]]), new Map(), NOW);
  assert.deepEqual(rows.map(r => r.id), ['u1']);
  assert.equal(rows[0].junk, false);
  assert.equal(rows[0].junkReason, null);
});

test('junk accounts carry the rule reason', () => {
  const rows = buildEveryone([user({ id: 'j', name: 'asdf' })], new Map(), new Map(), NOW);
  assert.equal(rows[0].junk, true);
  assert.equal(rows[0].junkReason, 'Test-looking name');
});

test('parents link to the athlete whose invite matches their email and know if they opened the app', () => {
  const athlete = user({ id: 'a', status: 'paying', parentEmail: 'Dana.Okafor@gmail.com' });
  const parent = user({ id: 'p', name: 'Dana Okafor', email: 'dana.okafor@gmail.com', isParent: true });
  const orphan = user({ id: 'o', name: 'Sam Lee', email: 'sam.lee@gmail.com', isParent: true });
  const rows = buildEveryone([athlete, parent, orphan], new Map([['a', active], ['p', { eventCount: 1, sawPaywall: false }]]), new Map(), NOW);
  const byId = new Map(rows.map(r => [r.id, r]));
  assert.equal(byId.get('p')?.athleteId, 'a');
  assert.equal(byId.get('p')?.parentActive, true);
  assert.equal(byId.get('o')?.athleteId, null);
  assert.equal(byId.get('o')?.parentActive, false);
  assert.equal(byId.get('a')?.athleteId, null);
});

test('stoppedAtPaywall needs signed_up, completed onboarding and a paywall view', () => {
  const saw: AccountActivity = { eventCount: 3, sawPaywall: true };
  const users = [
    user({ id: 'yes' }),
    user({ id: 'stuck', onboarding: 'in_progress' }),
    user({ id: 'paid', status: 'paying' }),
    user({ id: 'blind' }),
  ];
  const rows = buildEveryone(users, new Map([['yes', saw], ['stuck', saw], ['paid', saw], ['blind', active]]), new Map(), NOW);
  assert.deepEqual(rows.map(r => [r.id, r.stoppedAtPaywall]), [['yes', true], ['stuck', false], ['paid', false], ['blind', false]]);
});

test('trial and cancellation timings only for the matching status', () => {
  const trialing = user({ id: 't', status: 'trialing', trialEndsAt: '2026-09-09T13:30:00' });
  const ended = user({ id: 'e', status: 'trial_ended', trialEndsAt: '2026-09-05T10:00:00' });
  const churned = user({ id: 'c', status: 'churned', paidAt: '2026-08-01T10:00:00' });
  const noDate = user({ id: 'n', status: 'churned', paidAt: '2026-08-01T10:00:00' });
  const rows = buildEveryone(
    [trialing, ended, churned, noDate],
    new Map([['t', active], ['e', active], ['c', active], ['n', active]]),
    new Map([['c', '2026-09-06T09:00:00']]),
    NOW,
  );
  const byId = new Map(rows.map(r => [r.id, r]));
  assert.equal(byId.get('t')?.trialEndsIn, 26);
  assert.equal(byId.get('t')?.trialEndedAgo, null);
  assert.equal(byId.get('e')?.trialEndedAgo, 3);
  assert.equal(byId.get('e')?.trialEndsIn, null);
  assert.equal(byId.get('c')?.cancelledAgo, 2);
  assert.equal(byId.get('n')?.cancelledAgo, null);
});
