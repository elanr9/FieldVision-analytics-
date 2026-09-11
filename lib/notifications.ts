import { createClient } from '@supabase/supabase-js';

/**
 * Product events shown in the Activity feed. Each row in analytics_notifications
 * carries the exact catalogue title/sub so the feed never has to rebuild copy.
 *
 * Every type is recorded by app/api/notify/route.ts, fed by the database
 * triggers in supabase/migrations/20260908230000_analytics_notify_triggers.sql:
 *   trial     user_subscriptions becomes plan=full with no charge
 *   paid      user_subscriptions plan=full with amount_cents > 0
 *   cancel    user_subscriptions plan=full -> free/canceled
 *   call      founder_calls insert
 *   call_soon pg_cron analytics_check_upcoming_calls(), 10 min before a booked call
 *   paywall   product_events onboarding_screen_view s37_paywall
 *   wheel     product_events onboarding_screen_view s37c_spin_wheel or s38_one_time_offer
 *   stalled   pg_cron analytics_check_paywall_stalls(), paywall view with 10 min of nothing after it
 *   save      product_events retention_offer_accepted (retention-offer edge function)
 *   reply     email_replies insert with kind=reply
 *   campaign  outreach_lists sent_at set
 *   video     projects status -> downloadable
 */
export type NotificationType =
  | 'paywall'
  | 'wheel'
  | 'stalled'
  | 'trial'
  | 'paid'
  | 'cancel'
  | 'save'
  | 'reply'
  | 'campaign'
  | 'video'
  | 'call'
  | 'call_soon';

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  'paywall', 'wheel', 'stalled', 'trial', 'paid', 'cancel', 'save', 'reply', 'campaign', 'video', 'call', 'call_soon',
];

/**
 * Template values. Keys used per type:
 *   first (all)            first name; recordEvent fills it from user_profiles when missing
 *   pronoun (cancel, campaign)  his | her | their; recordEvent fills it from the intake when missing
 *   n (paywall)            days since onboarding finished
 *   plan (trial, paid, cancel)  plan label, e.g. "$60 semester"
 *   amountCents (paid)     charge amount in cents
 *   school, coach (reply)
 *   n, m (campaign)        coaches and schools counts
 *   videoTitle (video)
 *   slot (call, call_soon) e.g. "Thu 4:30pm"
 */
export type NotificationVars = Record<string, string | number | null | undefined>;

export type Pronoun = 'his' | 'her' | 'their';

export const NOTIF_DOT: Record<NotificationType, string> = {
  paywall: 'var(--violet-500)',
  wheel: 'var(--violet-500)',
  stalled: 'var(--amber-500)',
  trial: 'var(--sky-500)',
  paid: 'var(--green-600)',
  cancel: 'var(--red-500)',
  save: 'var(--green-500)',
  reply: 'var(--ink-500)',
  campaign: 'var(--ink-500)',
  video: 'var(--ink-500)',
  call: 'var(--ink-700)',
  call_soon: 'var(--green-600)',
};

export interface NotificationRow {
  id: string;
  created_at: string;
  type: string;
  user_id: string;
  title: string;
  sub: string | null;
}

/** Feed row joined with the user's name. */
export interface NotificationRecord {
  id: string;
  createdAt: string;
  type: NotificationType;
  userId: string;
  userName: string | null;
  title: string;
  sub: string | null;
}

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function text(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function formatDollars(cents: string | number | null | undefined): string | null {
  if (cents === null || cents === undefined || cents === '') return null;
  const n = typeof cents === 'number' ? cents : Number(cents);
  if (!Number.isFinite(n)) return null;
  const dollars = n / 100;
  return '$' + (Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2));
}

function withSuffix(value: string | null, suffix: string): string | null {
  return value === null ? null : value + suffix;
}

/** Builds the exact catalogue title and sub for a feed row. Pure. */
export function buildNotificationCopy(type: NotificationType, vars: NotificationVars): { title: string; sub: string | null } {
  const first = text(vars.first) ?? 'Someone';
  const pronoun = text(vars.pronoun) ?? 'their';
  const plan = text(vars.plan);
  switch (type) {
    case 'paywall': {
      const n = text(vars.n);
      return { title: `${first} is in the paywall`, sub: n === null ? null : `Finished onboarding ${n} days ago` };
    }
    case 'wheel':
      return { title: `${first} is on the 90% off screen`, sub: null };
    case 'stalled':
      return { title: `${first} stopped at paywall`, sub: '10 min without action' };
    case 'trial':
      return { title: `${first} started a 3 day free trial`, sub: withSuffix(plan, ' plan') };
    case 'paid':
      return { title: `${first} paid ${formatDollars(vars.amountCents) ?? ''}`.trimEnd(), sub: withSuffix(plan, ' plan') };
    case 'cancel':
      return { title: `${first} cancelled ${pronoun} subscription`, sub: plan };
    case 'save':
      return { title: `${first} tried to cancel, accepted free month`, sub: null };
    case 'reply':
      return { title: `A ${text(vars.division) ?? 'school'} replied to ${first}`, sub: text(vars.school) };
    case 'campaign': {
      const n = text(vars.n);
      const m = text(vars.m);
      return { title: `${first} just sent ${pronoun} campaign`, sub: n !== null && m !== null ? `${n} coaches · ${m} schools` : null };
    }
    case 'video':
      return { title: `${first} just made a highlight video`, sub: text(vars.videoTitle) };
    case 'call':
      return { title: `${first} booked a call with Elan`, sub: text(vars.slot) };
    case 'call_soon':
      return { title: `Call with ${first} in 10 minutes`, sub: text(vars.slot) };
  }
}

/** Maps the intake's sport answer ("Mens Soccer" | "Womens Soccer") to a pronoun. */
export function pronounFromSport(sport: string | null | undefined): Pronoun {
  const s = (sport ?? '').toLowerCase();
  if (s.startsWith('men')) return 'his';
  if (s.startsWith('women')) return 'her';
  return 'their';
}

function firstName(fullName: string | null | undefined): string | null {
  const first = (fullName ?? '').trim().split(/\s+/)[0];
  return first.length ? first : null;
}

/** Looks up the user's first name and pronoun so callers only pass event-specific vars. */
async function userVars(userId: string): Promise<{ first: string | null; pronoun: Pronoun }> {
  const supabase = adminClient();
  const [profile, intake] = await Promise.all([
    supabase.from('user_profiles').select('full_name').eq('user_id', userId).maybeSingle(),
    supabase.from('user_onboarding_intake').select('sport').eq('user_id', userId).maybeSingle(),
  ]);
  const fullName = (profile.data as { full_name: string | null } | null)?.full_name ?? null;
  const sport = (intake.data as { sport: string | null } | null)?.sport ?? null;
  return { first: firstName(fullName), pronoun: pronounFromSport(sport) };
}

/** Inserts one feed row with catalogue copy. Fills first name and pronoun from the database when not passed. */
export async function recordEvent(type: NotificationType, userId: string, vars: NotificationVars): Promise<void> {
  const needsLookup = text(vars.first) === null || text(vars.pronoun) === null;
  const looked = needsLookup ? await userVars(userId) : null;
  const copy = buildNotificationCopy(type, {
    ...vars,
    first: text(vars.first) ?? looked?.first,
    pronoun: text(vars.pronoun) ?? looked?.pronoun,
  });
  const { error } = await adminClient()
    .from('analytics_notifications')
    .insert({ type, user_id: userId, title: copy.title, sub: copy.sub });
  if (error) throw new Error(`analytics_notifications insert failed: ${error.message}`);
}

function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

/** Feed rows from the last `days` days, newest first, with the user's full name. */
export async function loadNotifications(days = 14): Promise<NotificationRecord[]> {
  const supabase = adminClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('analytics_notifications')
    .select('id, created_at, type, user_id, title, sub')
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`analytics_notifications load failed: ${error.message}`);
  const rows = (data ?? []) as NotificationRow[];

  const userIds = Array.from(new Set(rows.map(r => r.user_id)));
  const names = new Map<string, string | null>();
  if (userIds.length) {
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, full_name')
      .in('user_id', userIds);
    if (profileError) throw new Error(`user_profiles load failed: ${profileError.message}`);
    for (const p of (profiles ?? []) as { user_id: string; full_name: string | null }[]) names.set(p.user_id, p.full_name);
  }

  return rows
    .filter(r => isNotificationType(r.type))
    .map(r => ({
      id: r.id,
      createdAt: r.created_at,
      type: r.type as NotificationType,
      userId: r.user_id,
      userName: names.get(r.user_id) ?? null,
      title: r.title,
      sub: r.sub,
    }));
}
