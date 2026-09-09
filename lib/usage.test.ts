import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFeatureUsage, computeUsage, FEATURE_DEFS, featureForEvent, type ProductEventRow, type UsageEventRow } from './usage';

const ev = (name: string, user_id: string, properties: ProductEventRow['properties'] = null): ProductEventRow => ({ name, user_id, properties });

test('events map to the feature they belong to', () => {
  assert.equal(featureForEvent(ev('feature_use', 'a', { feature: 'campaigns' }))?.id, 'campaign');
  assert.equal(featureForEvent(ev('outreach_email_send', 'a'))?.id, 'campaign');
  assert.equal(featureForEvent(ev('page_view', 'a', { path: '/projects/abc/label' }))?.id, 'highlights');
  assert.equal(featureForEvent(ev('page_view', 'a', { path: '/schools/rice' }))?.id, 'schools');
  assert.equal(featureForEvent(ev('page_view', 'a', { path: '/schoolsX' })), null, 'prefix must end at a path boundary');
  assert.equal(featureForEvent(ev('onboarding_step_viewed', 'a')), null);
});

test('tallies events and distinct users, dropping excluded users', () => {
  const events = [
    ev('feature_use', 'a', { feature: 'campaigns' }),
    ev('feature_use', 'a', { feature: 'campaigns' }),
    ev('feature_use', 'b', { feature: 'campaigns' }),
    ev('highlight_open', 'b'),
    ev('page_view', 'internal', { path: '/dashboard' }),
    ev('page_view', 'c', { path: '/dashboard' }),
  ];
  const { features, activeUsers30 } = buildFeatureUsage(events, new Set(['internal']));
  assert.deepEqual(features.map(f => [f.id, f.events30, f.users30]), [
    ['campaign', 3, 2],
    ['highlights', 1, 1],
    ['dashboard', 1, 1],
  ]);
  assert.equal(activeUsers30, 3);
});

// Feature usage screen detail (days, delta, perUser).
const NOW = new Date('2026-09-08T12:00:00');

function evAt(daysAgo: number, user: string, name: string, feature?: string): UsageEventRow {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  return { user_id: user, name, properties: feature ? { feature } : {}, created_at: d.toISOString() };
}

const rows: UsageEventRow[] = [
  // highlights: 3 events, 2 users, all in the last half
  evAt(1, 'u1', 'highlight_open'),
  evAt(1, 'u1', 'feature_use', 'video_editor'),
  evAt(3, 'u2', 'highlight_open'),
  // campaign: 4 events, 2 users, 1 in first half and 3 in last half → delta +200%
  evAt(20, 'u1', 'outreach_compose_open'),
  evAt(2, 'u1', 'outreach_email_send'),
  evAt(2, 'u3', 'feature_use', 'campaigns'),
  evAt(0, 'u3', 'feature_use', 'campaigns'),
  // inbox: 2 events in the first half, 1 in the last → delta -50%
  evAt(28, 'u2', 'feature_use', 'messaging'),
  evAt(16, 'u2', 'feature_use', 'messaging'),
  evAt(5, 'u2', 'feature_use', 'messaging'),
  // outside the window and unknown events are ignored
  evAt(31, 'u9', 'highlight_open'),
  evAt(1, 'u9', 'page_view'),
  evAt(1, 'u9', 'onboarding_step_viewed'),
  // excluded users are dropped
  evAt(1, 'internal', 'highlight_open'),
];

const usage = computeUsage(rows, new Set(['internal']), 30, NOW);
const byId = Object.fromEntries(usage.map(f => [f.id, f]));

test('returns every feature in FEATURE_DEFS order', () => {
  assert.deepEqual(usage.map(f => f.id), FEATURE_DEFS.map(f => f.id));
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

test('every feature has an event mapped, so none is missing', () => {
  assert.equal(usage.some(f => f.missing), false);
});

test('a mapped feature with no events in the window is zeros but not missing', () => {
  assert.equal(byId.schools.missing, false);
  assert.equal(byId.schools.events30, 0);
});
