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

test('trial', () => {
  assert.deepEqual(buildNotificationCopy('trial', { first: 'Lucas', plan: '$60 semester' }), { title: 'Lucas started a 3 day free trial', sub: '$60 semester plan' });
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

test('video', () => {
  assert.deepEqual(buildNotificationCopy('video', { first: 'Diego', videoTitle: 'Diego Ramos | Highlight Video' }), { title: 'Diego just made a highlight video', sub: 'Diego Ramos | Highlight Video' });
});

test('call', () => {
  assert.deepEqual(buildNotificationCopy('call', { first: 'Maya', slot: 'Thu 4:30pm' }), { title: 'Maya booked a call with Elan', sub: 'Thu 4:30pm' });
});

test('call_soon', () => {
  assert.deepEqual(buildNotificationCopy('call_soon', { first: 'Maya', slot: 'Thu 4:30pm' }), { title: 'Call with Maya in 10 minutes', sub: 'Thu 4:30pm' });
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
