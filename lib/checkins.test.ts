import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { UserRecord, UserStatus } from './types';
// @ts-expect-error TS5097: node needs the .ts extension to resolve this module, tsconfig does not allow it
import { CHECKIN_TEXTS, checkinsDue, checkinText, checkinVariation, type CheckinLogRow } from './checkins.ts';

const NOW = new Date('2026-09-08T12:00:00Z');

function user(id: string, name: string, status: UserStatus, phone: string | null, excludedFromMetrics = false): UserRecord {
  return {
    id,
    name,
    email: `${id}@example.com`,
    phone,
    team: null,
    position: null,
    gradYear: null,
    parentName: null,
    parentEmail: null,
    signupDate: '2026-06-14T10:00:00Z',
    trialStartedAt: null,
    trialEndsAt: null,
    paidAt: null,
    paymentType: null,
    status,
    interval: 'monthly',
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

function sent(userId: string, daysAgo: number, variation = 0): CheckinLogRow {
  return { user_id: userId, sent_at: new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString(), variation };
}

const maya = user('u1', 'Maya Chen', 'paying', '+15551234567');
const diego = user('u2', 'Diego Ramos', 'trialing', '+15550000002');
const churned = user('u3', 'Ethan Cole', 'churned', '+15550000003');
const trialEnded = user('u4', 'Jalen Ford', 'trial_ended', '+15550000004');
const noPhone = user('u5', 'Sofia Park', 'paying', null);
const demo = user('u6', 'Demo Account', 'paying', '+15550000006', true);
const users = [maya, diego, churned, trialEnded, noPhone, demo];

test('six consecutive sends yield six distinct variations', () => {
  const log: CheckinLogRow[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < 6; i++) {
    const v = checkinVariation(maya, log);
    seen.add(v);
    log.push(sent(maya.id, 0, v));
  }
  assert.equal(seen.size, 6);
  assert.equal(checkinVariation(maya, log), checkinVariation(maya, []));
});

test('text is the verbatim variation with the first name filled', () => {
  const text = checkinText(maya, []);
  assert.equal(text, CHECKIN_TEXTS[checkinVariation(maya, [])].replace('{first}', 'Maya'));
  assert.equal(text.includes('{first}'), false);
});

test('different users start on different variations', () => {
  const starts = new Set(['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8'].map(id => checkinVariation({ id }, [])));
  assert.ok(starts.size > 1);
});

test('due list is paying or trialing, phone present, real, and not texted in 7 days', () => {
  assert.deepEqual(checkinsDue(users, [], NOW).map(u => u.id), ['u1', 'u2']);
  assert.deepEqual(checkinsDue(users, [sent('u1', 2)], NOW).map(u => u.id), ['u2']);
  assert.deepEqual(checkinsDue(users, [sent('u1', 7)], NOW).map(u => u.id), ['u1', 'u2']);
  assert.deepEqual(checkinsDue(users, [sent('u1', 30), sent('u1', 1)], NOW).map(u => u.id), ['u2']);
});

test('churned and trial_ended users are never due', () => {
  const log = [sent('u3', 400), sent('u4', 400)];
  const due = checkinsDue([churned, trialEnded], log, NOW);
  assert.deepEqual(due, []);
  assert.deepEqual(checkinsDue([churned, trialEnded], [], NOW), []);
});
