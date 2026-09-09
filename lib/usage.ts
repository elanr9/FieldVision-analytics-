import { createClient } from '@supabase/supabase-js';
import { addDays, dayKey, startOfDay } from './dates';

export type FeatureId = 'highlights' | 'campaign' | 'schools' | 'inbox' | 'roadmap' | 'profile' | 'calls' | 'parent';

/**
 * A product_events row counts for a feature when its `name` matches and, for the generic
 * `feature_use` event, `properties.feature` matches too.
 */
interface EventMatch {
  name: string;
  feature?: string;
}

/**
 * Real event names per feature, taken from the distinct `name` / `properties.feature` values
 * in product_events. Features with an empty list have no event yet and render "—".
 */
export const FEATURE_EVENTS: Record<FeatureId, EventMatch[]> = {
  highlights: [{ name: 'highlight_open' }, { name: 'feature_use', feature: 'video_editor' }],
  campaign: [{ name: 'outreach_compose_open' }, { name: 'outreach_email_send' }, { name: 'feature_use', feature: 'campaigns' }],
  schools: [{ name: 'school_view' }],
  inbox: [{ name: 'feature_use', feature: 'messaging' }],
  roadmap: [], // TODO: emit roadmap_open
  profile: [], // TODO: emit profile_edit
  calls: [], // TODO: emit call_booked
  parent: [], // TODO: emit parent_view
};

export interface FeatureDef {
  id: FeatureId;
  label: string;
  desc: string;
}

/** Display order, verbatim from the mock's FEATURES. */
export const FEATURES: FeatureDef[] = [
  { id: 'highlights', label: 'Highlight maker', desc: 'Opened the video editor' },
  { id: 'campaign', label: 'Coach emails', desc: 'Campaign composer' },
  { id: 'schools', label: 'School search', desc: 'Browsed or saved programs' },
  { id: 'inbox', label: 'Coach replies', desc: 'Read a reply' },
  { id: 'roadmap', label: 'Roadmap', desc: 'Weekly plan screen' },
  { id: 'profile', label: 'Athlete profile', desc: 'Edited profile or stats' },
  { id: 'calls', label: 'Book a call', desc: 'Calendly with Elan' },
  { id: 'parent', label: 'Parent view', desc: 'Parent account screens' },
];

export interface Feature extends FeatureDef {
  /** Distinct users with at least one event in the window */
  users30: number;
  /** Events in the window */
  events30: number;
  /** events30 / users30, one decimal */
  perUser: number;
  /** Daily event counts, oldest first, one entry per day in the window */
  days: number[];
  /** (last half − first half) / first half × 100, rounded; 0 when the first half is 0 */
  delta: number;
  /** True when the feature has no event mapped yet */
  missing: boolean;
}

export interface UsageEventRow {
  user_id: string | null;
  name: string;
  properties: Record<string, unknown> | null;
  created_at: string;
}

function matches(row: UsageEventRow, m: EventMatch): boolean {
  if (row.name !== m.name) return false;
  if (m.feature === undefined) return true;
  return row.properties?.feature === m.feature;
}

function featureFor(row: UsageEventRow): FeatureId | null {
  for (const f of FEATURES) {
    if (FEATURE_EVENTS[f.id].some(m => matches(row, m))) return f.id;
  }
  return null;
}

/** Aggregates raw event rows into one Feature per FEATURES entry. Pure, for tests. */
export function computeUsage(rows: UsageEventRow[], days = 30, now = new Date()): Feature[] {
  const start = startOfDay(addDays(now, -(days - 1)));
  const dayIndex = new Map<string, number>();
  for (let i = 0; i < days; i++) dayIndex.set(dayKey(addDays(start, i)), i);

  const perFeature = new Map<FeatureId, { users: Set<string>; days: number[] }>();
  for (const f of FEATURES) perFeature.set(f.id, { users: new Set(), days: new Array<number>(days).fill(0) });

  for (const row of rows) {
    const id = featureFor(row);
    if (!id) continue;
    const idx = dayIndex.get(dayKey(new Date(row.created_at)));
    if (idx === undefined) continue;
    const acc = perFeature.get(id)!;
    acc.days[idx] += 1;
    if (row.user_id) acc.users.add(row.user_id);
  }

  const half = Math.floor(days / 2);
  return FEATURES.map(f => {
    const acc = perFeature.get(f.id)!;
    const events30 = acc.days.reduce((a, b) => a + b, 0);
    const users30 = acc.users.size;
    const first = acc.days.slice(0, half).reduce((a, b) => a + b, 0);
    const last = acc.days.slice(half).reduce((a, b) => a + b, 0);
    return {
      ...f,
      users30,
      events30,
      perUser: users30 ? Math.round(events30 / users30 * 10) / 10 : 0,
      days: acc.days,
      delta: first ? Math.round((last - first) / first * 100) : 0,
      missing: FEATURE_EVENTS[f.id].length === 0,
    };
  });
}

const PAGE_SIZE = 1000;

/** Feature usage over the trailing window from product_events. Read only. */
export async function loadUsage(days = 30): Promise<Feature[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const now = new Date();
  const since = startOfDay(addDays(now, -(days - 1))).toISOString();
  const names = [...new Set(Object.values(FEATURE_EVENTS).flat().map(m => m.name))];

  const rows: UsageEventRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('product_events')
      .select('user_id, name, properties, created_at')
      .in('name', names)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as UsageEventRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return computeUsage(rows, days, now);
}
