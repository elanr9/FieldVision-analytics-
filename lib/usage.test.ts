import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFeatureUsage, featureForEvent, type ProductEventRow } from './usage';

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
