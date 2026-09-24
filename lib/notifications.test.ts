import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error TS5097: node needs the .ts extension to resolve this module, tsconfig does not allow it
import { buildNotificationCopy, NOTIF_DOT, NOTIFICATION_TYPES, pronounFromSport } from './notifications.ts';

test('paywall', () => {
  assert.deepEqual(buildNotificationCopy('paywall', { first: 'Noor', n: 8 }), { title: 'Noor is in the paywall', sub: 'Finished onboarding 8 days ago' });
});

test('wheel', () => {
  assert.deepEqual(buildNotificationCopy('wheel', { first: 'Zoe' }), { title: 'Zoe is on the 90% off screen', sub: null });
});

test('stalled', () => {
  assert.deepEqual(buildNotificationCopy('stalled', { first: 'Jalen' }), { title: 'Jalen stopped at paywall', sub: '10 min without action' });
});

test('trial uses the real length from Stripe', () => {
  assert.deepEqual(buildNotificationCopy('trial', { first: 'Lucas', plan: '$60 quarterly', days: 3 }), { title: 'Lucas started a 3 day free trial', sub: '$60 quarterly plan' });
  assert.equal(buildNotificationCopy('trial', { first: 'Kashiden', plan: '$240 yearly', days: 7 }).title, 'Kashiden started a 7 day free trial');
  assert.equal(buildNotificationCopy('trial', { first: 'Lucas' }).title, 'Lucas started a free trial');
});

test('paid', () => {
  assert.deepEqual(buildNotificationCopy('paid', { first: 'Sofia', amountCents: 6000, plan: '$60 semester' }), { title: 'Sofia paid $60', sub: '$60 semester plan' });
  assert.equal(buildNotificationCopy('paid', { first: 'Sofia', amountCents: 5999 }).title, 'Sofia paid $59.99');
});

test('cancel uses his/her/their', () => {
  assert.deepEqual(buildNotificationCopy('cancel', { first: 'Ethan', pronoun: 'his', plan: '$30 monthly' }), { title: 'Ethan cancelled his subscription', sub: '$30 monthly' });
  assert.equal(buildNotificationCopy('cancel', { first: 'Maya', pronoun: 'her' }).title, 'Maya cancelled her subscription');
  assert.equal(buildNotificationCopy('cancel', { first: 'Sam' }).title, 'Sam cancelled their subscription');
});

test('payment_failed reads as involuntary churn, not a cancel', () => {
  assert.deepEqual(buildNotificationCopy('payment_failed', { first: 'Kashiden', plan: '$240 yearly' }), { title: "Kashiden's payment failed, subscription ended", sub: '$240 yearly' });
});

test('save', () => {
  assert.deepEqual(buildNotificationCopy('save', { first: 'Caleb' }), { title: 'Caleb tried to cancel, accepted free month', sub: null });
});

test('reply', () => {
  assert.deepEqual(buildNotificationCopy('reply', { first: 'Maya', school: 'Rice University', division: 'D1' }), { title: 'A D1 replied to Maya', sub: 'Rice University' });
  assert.deepEqual(buildNotificationCopy('reply', { first: 'Maya', school: 'Rice University', division: null }), { title: 'A school replied to Maya', sub: 'Rice University' });
});

test('campaign', () => {
  assert.deepEqual(buildNotificationCopy('campaign', { first: 'Caleb', pronoun: 'his', n: 14, m: 6 }), { title: 'Caleb just sent his campaign', sub: '14 coaches · 6 schools' });
});

test('message names the single school', () => {
  assert.deepEqual(buildNotificationCopy('message', { first: 'Ricardo', school: 'Dominican University New York' }), { title: 'Ricardo messaged Dominican University New York', sub: null });
  assert.equal(buildNotificationCopy('message', { first: 'Ricardo' }).title, 'Ricardo messaged a school');
});

test('video', () => {
  assert.deepEqual(buildNotificationCopy('video', { first: 'Diego', videoTitle: 'Diego Ramos | Highlight Video' }), { title: 'Diego just made a highlight video', sub: 'Diego Ramos | Highlight Video' });
});

test('call', () => {
  assert.deepEqual(buildNotificationCopy('call', { first: 'Maya', slot: 'Thu 4:30pm' }), { title: 'Maya booked a call with Elan', sub: 'Thu 4:30pm' });
});

// These rows are written straight into the table by Postgres, so the copy here has to
// match analytics_notify_upcoming_call() exactly or the feed shows two different strings.
test('call_soon', () => {
  assert.deepEqual(buildNotificationCopy('call_soon', { first: 'Bastiano', slot: 'Wed 9:00pm' }), { title: 'Call with Bastiano in 10 minutes', sub: 'Wed 9:00pm' });
});

test('every type has a dot token', () => {
  for (const t of NOTIFICATION_TYPES) assert.match(NOTIF_DOT[t], /^var\(--[a-z]+-\d{3}\)$/);
  assert.equal(NOTIF_DOT.paywall, 'var(--violet-500)');
});

test('pronoun from intake sport', () => {
  assert.equal(pronounFromSport('Mens Soccer'), 'his');
  assert.equal(pronounFromSport('Womens Soccer'), 'her');
  assert.equal(pronounFromSport('soccer'), 'their');
  assert.equal(pronounFromSport(null), 'their');
});
