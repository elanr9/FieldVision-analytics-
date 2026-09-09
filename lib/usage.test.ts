import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error TS5097: node needs the .ts extension to resolve this module, tsconfig does not allow it
import { computeUsage, FEATURES, type UsageEventRow } from './usage.ts';

// Tuesday noon. Window is Aug 10 → Sep 8 (30 days); first half Aug 10–24, last half Aug 25–Sep 8.
const NOW = new Date('2026-09-08T12:00:00');

function ev(daysAgo: number, user: string, name: string, feature?: string): UsageEventRow {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  return { user_id: user, name, properties: feature ? { feature } : {}, created_at: d.toISOString() };
}

const rows: UsageEventRow[] = [
  // highlights: 3 events, 2 users, all in the last half
  ev(1, 'u1', 'highlight_open'),
  ev(1, 'u1', 'feature_use', 'video_editor'),
  ev(3, 'u2', 'highlight_open'),
  // campaign: 4 events, 2 users, 1 in first half and 3 in last half → delta +200%
  ev(20, 'u1', 'outreach_compose_open'),
  ev(2, 'u1', 'outreach_email_send'),
  ev(2, 'u3', 'feature_use', 'campaigns'),
  ev(0, 'u3', 'feature_use', 'campaigns'),
  // inbox: 2 events in the first half, 1 in the last → delta -50%
  ev(28, 'u2', 'feature_use', 'messaging'),
  ev(16, 'u2', 'feature_use', 'messaging'),
  ev(5, 'u2', 'feature_use', 'messaging'),
  // outside the window and unknown events are ignored
  ev(31, 'u9', 'highlight_open'),
  ev(1, 'u9', 'page_view'),
  ev(1, 'u9', 'feature_use', 'library'),
];

const usage = computeUsage(rows, 30, NOW);
const byId = Object.fromEntries(usage.map(f => [f.id, f]));

test('returns every feature in FEATURES order', () => {
  assert.deepEqual(usage.map(f => f.id), FEATURES.map(f => f.id));
});

test('users30 counts distinct users, events30 counts events', () => {
  assert.equal(byId.highlights.users30, 2);
  assert.equal(byId.highlights.events30, 3);
  assert.equal(byId.campaign.users30, 2);
  assert.equal(byId.campaign.events30, 4);
});

test('perUser is events30 / users30 to one decimal', () => {
  assert.equal(byId.highlights.perUser, 1.5);
  assert.equal(byId.campaign.perUser, 2);
});

test('days has 30 entries oldest first and sums to events30', () => {
  assert.equal(byId.inbox.days.length, 30);
  assert.equal(byId.inbox.days[1], 1); // 28 days ago
  assert.equal(byId.inbox.days[29], 0); // today
  assert.equal(byId.inbox.days.reduce((a, b) => a + b, 0), byId.inbox.events30);
});

test('delta compares the last 15 days with the first 15', () => {
  assert.equal(byId.campaign.delta, 200);
  assert.equal(byId.inbox.delta, -50);
  assert.equal(byId.highlights.delta, 0); // first half is 0
});

test('a feature with no mapped event is zeros and missing', () => {
  const f = byId.roadmap;
  assert.equal(f.missing, true);
  assert.equal(f.users30, 0);
  assert.equal(f.events30, 0);
  assert.equal(f.perUser, 0);
  assert.equal(f.delta, 0);
  assert.deepEqual(f.days, new Array(30).fill(0));
  assert.equal(byId.highlights.missing, false);
});

test('a mapped feature with no events in the window is zeros but not missing', () => {
  assert.equal(byId.schools.missing, false);
  assert.equal(byId.schools.events30, 0);
});
