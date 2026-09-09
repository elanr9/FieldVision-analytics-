import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { addDays, dayKey, startOfDay } from './dates';
import type { UserRecord } from './types';

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface UsageFeature {
  id: string;
  label: string;
  /** Lucide glyph path data on a 24-unit viewBox */
  icon: string;
  events30: number;
  users30: number;
}

export interface PlatformTotals {
  conversations: number;
  replies: number;
  videos: number;
  videosPublished: number;
  emailsSent: number;
  emailsOpened: number;
  campaigns: number;
  schoolsSaved: number;
  calls: number;
}

/** One feature with its 30-day series, for the Feature usage screen. */
export interface Feature extends UsageFeature {
  desc: string;
  /** events30 / users30, one decimal */
  perUser: number;
  /** Daily event counts, oldest first, one entry per day in the window */
  days: number[];
  /** (last half − first half) / first half × 100, rounded; 0 when the first half is 0 */
  delta: number;
  /** True when the feature has no event mapped yet */
  missing: boolean;
}

export interface UsageSnapshot {
  /** Sorted by events, most used first */
  features: UsageFeature[];
  /** Every feature in FEATURE_DEFS order with its daily series */
  detail: Feature[];
  /** Distinct athletes with any tracked event in the window */
  activeUsers30: number;
  platform: PlatformTotals;
}

interface FeatureDef {
  id: string;
  label: string;
  desc: string;
  icon: string;
  /** product_events.name values that belong to this feature */
  events: string[];
  /** properties.feature values from feature_use events */
  featureKeys: string[];
  /** properties.path prefixes from page_view events */
  pathPrefixes: string[];
}

/** The eight features the Usage view can show, matched against FieldVision's product_events. */
export const FEATURE_DEFS: FeatureDef[] = [
  {
    id: 'highlights',
    desc: 'Opened the video editor',
    label: 'Highlight maker',
    icon: 'M2 8.5A2.5 2.5 0 0 1 4.5 6h9A2.5 2.5 0 0 1 16 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 2 15.5zM16 10l5-3v10l-5-3',
    events: ['highlight_open'],
    featureKeys: ['video_editor', 'library'],
    pathPrefixes: ['/videos', '/projects'],
  },
  {
    id: 'campaign',
    desc: 'Campaign composer',
    label: 'Coach emails',
    icon: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 7l9 6 9-6',
    events: ['outreach_compose_open', 'outreach_email_send'],
    featureKeys: ['campaigns'],
    pathPrefixes: ['/emails', '/campaigns'],
  },
  {
    id: 'schools',
    desc: 'Browsed or saved programs',
    label: 'School search',
    icon: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5',
    events: ['school_view'],
    featureKeys: [],
    pathPrefixes: ['/schools'],
  },
  {
    id: 'inbox',
    desc: 'Read a reply',
    label: 'Coach replies',
    icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    events: [],
    featureKeys: ['messaging'],
    pathPrefixes: ['/inbox'],
  },
  {
    id: 'dashboard',
    desc: 'Home dashboard',
    label: 'Dashboard',
    icon: 'M9 4v16M15 4v16M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z',
    events: [],
    featureKeys: [],
    pathPrefixes: ['/dashboard'],
  },
  {
    id: 'profile',
    desc: 'Edited profile or settings',
    label: 'Profile & settings',
    icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    events: [],
    featureKeys: ['settings'],
    pathPrefixes: ['/profile', '/settings'],
  },
  {
    id: 'calls',
    desc: 'Calendly with Elan',
    label: 'Book a call',
    icon: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2z',
    events: [],
    featureKeys: [],
    pathPrefixes: ['/ambassadors'],
  },
  {
    id: 'parent',
    desc: 'Parent account screens',
    label: 'Parent view',
    icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    events: [],
    featureKeys: ['parent'],
    pathPrefixes: ['/parent'],
  },
];

export interface ProductEventRow {
  user_id: string | null;
  name: string;
  properties: { feature?: string; path?: string } | null;
}

/** Which feature an event belongs to, or null when it is not one we chart. */
export function featureForEvent(e: ProductEventRow): FeatureDef | null {
  const featureKey = e.name === 'feature_use' ? e.properties?.feature : undefined;
  const path = e.name === 'page_view' ? e.properties?.path : undefined;
  for (const def of FEATURE_DEFS) {
    if (def.events.includes(e.name)) return def;
    if (featureKey && def.featureKeys.includes(featureKey)) return def;
    if (path && def.pathPrefixes.some(prefix => path === prefix || path.startsWith(prefix + '/'))) return def;
  }
  return null;
}

/** Tallies events and distinct users per feature. Events from excluded users are dropped. */
export function buildFeatureUsage(events: ProductEventRow[], excludedUserIds: Set<string>): { features: UsageFeature[]; activeUsers30: number } {
  const byId = new Map<string, { events: number; users: Set<string> }>();
  const active = new Set<string>();
  for (const e of events) {
    if (e.user_id && excludedUserIds.has(e.user_id)) continue;
    const def = featureForEvent(e);
    if (!def) continue;
    const tally = byId.get(def.id) ?? { events: 0, users: new Set<string>() };
    tally.events += 1;
    if (e.user_id) {
      tally.users.add(e.user_id);
      active.add(e.user_id);
    }
    byId.set(def.id, tally);
  }
  const features = FEATURE_DEFS.map(def => {
    const tally = byId.get(def.id);
    return { id: def.id, label: def.label, icon: def.icon, events30: tally?.events ?? 0, users30: tally?.users.size ?? 0 };
  })
    .filter(f => f.events30 > 0)
    .sort((a, b) => b.events30 - a.events30);
  return { features, activeUsers30: active.size };
}

export interface UsageEventRow extends ProductEventRow {
  created_at: string;
}

/** Builds one Feature per FEATURE_DEFS entry with a daily series over the trailing window. Pure, for tests. */
export function computeUsage(rows: UsageEventRow[], excludedUserIds: Set<string>, days = 30, now = new Date()): Feature[] {
  const start = startOfDay(addDays(now, -(days - 1)));
  const dayIndex = new Map<string, number>();
  for (let i = 0; i < days; i++) dayIndex.set(dayKey(addDays(start, i)), i);

  const perFeature = new Map<string, { users: Set<string>; days: number[] }>();
  for (const def of FEATURE_DEFS) perFeature.set(def.id, { users: new Set(), days: new Array<number>(days).fill(0) });

  for (const row of rows) {
    if (row.user_id && excludedUserIds.has(row.user_id)) continue;
    const def = featureForEvent(row);
    if (!def) continue;
    const idx = dayIndex.get(dayKey(new Date(row.created_at)));
    if (idx === undefined) continue;
    const acc = perFeature.get(def.id)!;
    acc.days[idx] += 1;
    if (row.user_id) acc.users.add(row.user_id);
  }

  const half = Math.floor(days / 2);
  return FEATURE_DEFS.map(def => {
    const acc = perFeature.get(def.id)!;
    const events30 = acc.days.reduce((a, b) => a + b, 0);
    const users30 = acc.users.size;
    const first = acc.days.slice(0, half).reduce((a, b) => a + b, 0);
    const last = acc.days.slice(half).reduce((a, b) => a + b, 0);
    return {
      id: def.id,
      label: def.label,
      desc: def.desc,
      icon: def.icon,
      users30,
      events30,
      perUser: users30 ? Math.round(events30 / users30 * 10) / 10 : 0,
      days: acc.days,
      delta: first ? Math.round((last - first) / first * 100) : 0,
      missing: def.events.length === 0 && def.featureKeys.length === 0 && def.pathPrefixes.length === 0,
    };
  });
}

const PAGE = 1000;

async function fetchRecentEvents(supabase: SupabaseClient, since: Date): Promise<UsageEventRow[]> {
  const rows: UsageEventRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('product_events')
      .select('user_id, name, properties, created_at')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as UsageEventRow[];
    rows.push(...batch);
    if (batch.length < PAGE) return rows;
  }
}

function countQuery(supabase: SupabaseClient, table: string, userColumn: string) {
  return supabase.from(table).select(userColumn, { count: 'exact', head: true });
}
type CountQuery = ReturnType<typeof countQuery>;

function excludedFilter(excluded: Set<string>): string | null {
  return excluded.size ? `(${Array.from(excluded).join(',')})` : null;
}

interface CountOptions {
  /** Column holding the owning user's id; defaults to user_id */
  userColumn?: string;
  refine?: (q: CountQuery) => CountQuery;
}

async function countRows(supabase: SupabaseClient, table: string, excluded: Set<string>, { userColumn = 'user_id', refine = q => q }: CountOptions = {}): Promise<number> {
  const filter = excludedFilter(excluded);
  const base = countQuery(supabase, table, userColumn);
  const { count, error } = await refine(filter ? base.not(userColumn, 'in', filter) : base);
  if (error) throw error;
  return count ?? 0;
}

interface RepliedRow {
  user_id: string;
  coach_email: string | null;
}

async function fetchRepliedEmails(supabase: SupabaseClient, excluded: Set<string>): Promise<RepliedRow[]> {
  const filter = excludedFilter(excluded);
  const base = supabase.from('user_sent_emails').select('user_id, coach_email').eq('status', 'sent').not('replied_at', 'is', null);
  const { data, error } = await (filter ? base.not('user_id', 'in', filter) : base);
  if (error) throw error;
  return (data ?? []) as RepliedRow[];
}

/** Real 30-day feature usage and all-time platform totals for the Overview Usage view. */
export async function loadUsage(users: UserRecord[], now: Date = new Date()): Promise<UsageSnapshot> {
  const supabase = adminClient();
  const excluded = new Set(users.filter(u => u.excludedFromMetrics).map(u => u.id));
  const since = startOfDay(addDays(now, -29));

  const [events, replied, videos, videosPublished, emailsSent, emailsOpened, campaigns, schoolsSaved, calls] = await Promise.all([
    fetchRecentEvents(supabase, since),
    fetchRepliedEmails(supabase, excluded),
    countRows(supabase, 'projects', excluded),
    countRows(supabase, 'projects', excluded, { refine: q => q.eq('status', 'downloadable') }),
    countRows(supabase, 'user_sent_emails', excluded, { refine: q => q.eq('status', 'sent') }),
    countRows(supabase, 'user_sent_emails', excluded, { refine: q => q.eq('status', 'sent').not('opened_at', 'is', null) }),
    countRows(supabase, 'outreach_lists', excluded, { refine: q => q.in('status', ['sent', 'completed', 'follow_up_1_sent']) }),
    countRows(supabase, 'user_school_tracking', excluded),
    countRows(supabase, 'ambassador_bookings', excluded, { userColumn: 'student_user_id' }),
  ]);

  const conversations = new Set(replied.map(r => `${r.user_id}|${r.coach_email ?? ''}`)).size;

  const { features, activeUsers30 } = buildFeatureUsage(events, excluded);

  return {
    features,
    detail: computeUsage(events, excluded, 30, now),
    activeUsers30,
    platform: {
      conversations,
      replies: replied.length,
      videos,
      videosPublished,
      emailsSent,
      emailsOpened,
      campaigns,
      schoolsSaved,
      calls,
    },
  };
}
