import { createClient } from '@supabase/supabase-js';
import { isLikelyFake, laterDuplicateEmailIds } from './fake-accounts';
import { PAYWALL_SCREENS } from './funnel';
import { loadUsers } from './queries';
import type { UserRecord } from './types';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const PAGE_SIZE = 1000;

/** Every non-excluded account, decorated for the Users tab. */
export interface EveryoneRecord extends UserRecord {
  junk: boolean;
  junkReason: string | null;
  /** For parents: the athlete whose parent invite matches this email */
  athleteId: string | null;
  /** Parent has at least one product event */
  parentActive: boolean;
  /** Signed up, finished onboarding, saw the paywall, never subscribed */
  stoppedAtPaywall: boolean;
  /** Hours until the trial ends, trialing only */
  trialEndsIn: number | null;
  /** Days since the trial ended, trial_ended only */
  trialEndedAgo: number | null;
  /** Days since the subscription was cancelled, churned only */
  cancelledAgo: number | null;
}

/** What product_events say about one account. */
export interface AccountActivity {
  eventCount: number;
  sawPaywall: boolean;
}

const NO_ACTIVITY: AccountActivity = { eventCount: 0, sawPaywall: false };

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

interface EventRow {
  user_id: string | null;
  name: string;
  screen: string | null;
}

interface CancelledRow {
  user_id: string;
  updated_at: string | null;
}

function daysBetween(fromIso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(fromIso).getTime()) / DAY_MS));
}

function hoursUntil(iso: string, now: Date): number {
  return Math.max(1, Math.ceil((new Date(iso).getTime() - now.getTime()) / HOUR_MS));
}

/** Athlete id per lowercase parent email, first invite wins, same rule as the profile screen. */
function athleteIdsByParentEmail(users: UserRecord[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const u of users) {
    if (u.isParent || !u.parentEmail) continue;
    const key = u.parentEmail.toLowerCase();
    if (!map.has(key)) map.set(key, u.id);
  }
  return map;
}

/**
 * Pure decoration step: drops excluded accounts, runs the fake rule, links parents to athletes,
 * and derives the right-hand captions' numbers.
 */
export function buildEveryone(
  users: UserRecord[],
  activity: Map<string, AccountActivity>,
  cancelledAt: Map<string, string>,
  now: Date = new Date(),
): EveryoneRecord[] {
  const everyone = users.filter(u => !u.excludedFromMetrics);
  const duplicateIds = laterDuplicateEmailIds(everyone);
  const athleteByParentEmail = athleteIdsByParentEmail(everyone);

  return everyone.map(u => {
    const act = activity.get(u.id) ?? NO_ACTIVITY;
    const verdict = isLikelyFake(
      {
        name: u.name,
        signupDate: u.signupDate,
        onboarding: u.onboarding,
        eventCount: act.eventCount,
        laterDuplicateEmail: duplicateIds.has(u.id),
      },
      now,
    );
    const cancelled = cancelledAt.get(u.id);
    return {
      ...u,
      junk: verdict.fake,
      junkReason: verdict.reason ?? null,
      athleteId: u.isParent ? athleteByParentEmail.get(u.email.toLowerCase()) ?? null : null,
      parentActive: u.isParent && act.eventCount > 0,
      stoppedAtPaywall: u.status === 'signed_up' && u.onboarding === 'completed' && act.sawPaywall,
      trialEndsIn: u.status === 'trialing' && u.trialEndsAt ? hoursUntil(u.trialEndsAt, now) : null,
      trialEndedAgo: u.status === 'trial_ended' && u.trialEndsAt ? daysBetween(u.trialEndsAt, now) : null,
      cancelledAgo: u.status === 'churned' && cancelled ? daysBetween(cancelled, now) : null,
    };
  });
}

/** Event count and paywall sighting per user, read in pages so nothing is silently truncated. */
async function loadActivity(supabase: ReturnType<typeof adminClient>): Promise<Map<string, AccountActivity>> {
  const activity = new Map<string, AccountActivity>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('product_events')
      .select('user_id, name, screen:properties->>screen')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as EventRow[];
    for (const row of rows) {
      if (!row.user_id) continue;
      const current = activity.get(row.user_id) ?? { ...NO_ACTIVITY };
      current.eventCount += 1;
      if (row.name === 'onboarding_screen_view' && row.screen === PAYWALL_SCREENS.paywall) current.sawPaywall = true;
      activity.set(row.user_id, current);
    }
    if (rows.length < PAGE_SIZE) return activity;
  }
}

/** When each cancelled subscription row last changed, the closest thing to a cancellation date. */
async function loadCancelledAt(supabase: ReturnType<typeof adminClient>): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('user_id, updated_at')
    .eq('payment_type', 'canceled');
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of (data ?? []) as CancelledRow[]) {
    if (row.updated_at) map.set(row.user_id, row.updated_at);
  }
  return map;
}

/**
 * Everyone for the Users tab. Pass the already loaded users to avoid a second profiles query.
 * Read only.
 */
export async function loadEveryone(users?: UserRecord[]): Promise<EveryoneRecord[]> {
  const supabase = adminClient();
  const [all, activity, cancelledAt] = await Promise.all([
    users ?? loadUsers(),
    loadActivity(supabase),
    loadCancelledAt(supabase),
  ]);
  return buildEveryone(all, activity, cancelledAt);
}
