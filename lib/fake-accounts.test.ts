import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error TS5097: node needs the .ts extension to resolve this module, tsconfig does not allow it
import { FAKE_REASONS, isLikelyFake, laterDuplicateEmailIds, normalizeEmail, type FakeCandidate } from './fake-accounts.ts';

// Tuesday Sep 8, 2026.
const NOW = new Date('2026-09-08T12:00:00');

function candidate(overrides: Partial<FakeCandidate>): FakeCandidate {
  return {
    name: 'Maya Okafor',
    signupDate: '2026-08-17T10:00:00',
    onboarding: 'completed',
    eventCount: 12,
    laterDuplicateEmail: false,
    ...overrides,
  };
}

test('a real account with a full name and activity is not fake', () => {
  assert.deepEqual(isLikelyFake(candidate({}), NOW), { fake: false });
});

test('rule 1: test-looking name, from the list or containing the word test', () => {
  assert.equal(isLikelyFake(candidate({ name: '  Asdf ' }), NOW).reason, FAKE_REASONS.testName);
  assert.equal(isLikelyFake(candidate({ name: 'John Doe' }), NOW).reason, FAKE_REASONS.testName);
  assert.equal(isLikelyFake(candidate({ name: 'Elan Test Account' }), NOW).reason, FAKE_REASONS.testName);
  assert.equal(isLikelyFake(candidate({ name: 'Testa Rossa' }), NOW).fake, false);
});

test('rule 2: single-word name with zero events and unfinished onboarding', () => {
  const single = candidate({ name: 'Maya', eventCount: 0, onboarding: 'in_progress' });
  assert.equal(isLikelyFake(single, NOW).reason, FAKE_REASONS.noLastName);
  assert.equal(isLikelyFake(candidate({ name: 'Maya', eventCount: 0, onboarding: 'completed' }), NOW).fake, false);
  assert.equal(isLikelyFake(candidate({ name: 'Maya', eventCount: 1, onboarding: 'none', signupDate: '2026-09-07T10:00:00' }), NOW).fake, false);
});

test('rule 3: later signup with a duplicate email', () => {
  assert.equal(isLikelyFake(candidate({ laterDuplicateEmail: true }), NOW).reason, FAKE_REASONS.duplicateEmail);
});

test('rule 4: never opened the app, only once the account is a week old', () => {
  const stale = candidate({ eventCount: 0, onboarding: 'none', signupDate: '2026-09-01T12:00:00' });
  assert.equal(isLikelyFake(stale, NOW).reason, FAKE_REASONS.neverOpened);
  const fresh = candidate({ eventCount: 0, onboarding: 'none', signupDate: '2026-09-03T12:00:00' });
  assert.equal(isLikelyFake(fresh, NOW).fake, false);
});

test('first match wins in rule order', () => {
  const all = candidate({ name: 'test', eventCount: 0, onboarding: 'none', laterDuplicateEmail: true, signupDate: '2026-01-01T00:00:00' });
  assert.equal(isLikelyFake(all, NOW).reason, FAKE_REASONS.testName);
  const noName = candidate({ name: 'Maya', eventCount: 0, onboarding: 'none', laterDuplicateEmail: true, signupDate: '2026-01-01T00:00:00' });
  assert.equal(isLikelyFake(noName, NOW).reason, FAKE_REASONS.noLastName);
  const dup = candidate({ eventCount: 0, onboarding: 'none', laterDuplicateEmail: true, signupDate: '2026-01-01T00:00:00' });
  assert.equal(isLikelyFake(dup, NOW).reason, FAKE_REASONS.duplicateEmail);
});

test('normalizeEmail lowercases and strips gmail dots and +tags only', () => {
  assert.equal(normalizeEmail(' Maya.Okafor+ink@Gmail.com '), 'mayaokafor@gmail.com');
  assert.equal(normalizeEmail('Maya.Okafor+ink@icloud.com'), 'maya.okafor+ink@icloud.com');
});

test('laterDuplicateEmailIds flags only the later signups and ignores empty emails', () => {
  const ids = laterDuplicateEmailIds([
    { id: 'first', email: 'maya.okafor@gmail.com', signupDate: '2026-08-01T10:00:00' },
    { id: 'second', email: 'MayaOkafor@gmail.com', signupDate: '2026-08-05T10:00:00' },
    { id: 'third', email: 'maya.okafor+2@gmail.com', signupDate: '2026-08-09T10:00:00' },
    { id: 'blank-a', email: '', signupDate: '2026-08-01T10:00:00' },
    { id: 'blank-b', email: '', signupDate: '2026-08-02T10:00:00' },
  ]);
  assert.deepEqual([...ids].sort(), ['second', 'third']);
});
