import { createClient } from '@supabase/supabase-js';
import type { UserRecord } from './types';

/** Row from checkin_log. */
export interface CheckinLogRow {
  user_id: string;
  sent_at: string;
  variation: number;
}

/** The six weekly check-in texts. {first} is the user's first name. */
export const CHECKIN_TEXTS: readonly string[] = [
  "Hey {first}, hope all is going well! Elan here, wanted to check in and see how everything's been going with Inkbound. Let me know if you have any questions or problems!",
  "Hey {first}, Elan here. Just checking in on how Inkbound is going for you. Any questions or issues, let me know!",
  "Hey {first}! Elan from Inkbound. I wanted to see how everything's going. Anything you need, just say the word.",
  "Hey {first}, hope you're doing well. Elan here checking in on Inkbound. Let me know if anything's come up.",
  "Hey {first}, Elan again. How's Inkbound treating you? Happy to help with anything.",
  "Hey {first}! Quick check in from Elan. How's everything going with Inkbound? Hit me back if you're stuck on anything.",
];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Same hash as the mock so different users start on different variations. */
export function hashId(id: string): number {
  let h = 7;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function firstName(user: Pick<UserRecord, 'name'>): string {
  return user.name.trim().split(/\s+/)[0] || user.name;
}

function userLog(userId: string, log: CheckinLogRow[]): CheckinLogRow[] {
  return log.filter(r => r.user_id === userId);
}

export function timesSent(userId: string, log: CheckinLogRow[]): number {
  return userLog(userId, log).length;
}

/** ISO timestamp of the most recent check-in, or null when never sent. */
export function lastSentAt(userId: string, log: CheckinLogRow[]): string | null {
  let latest: string | null = null;
  for (const r of userLog(userId, log)) {
    if (latest === null || new Date(r.sent_at).getTime() > new Date(latest).getTime()) latest = r.sent_at;
  }
  return latest;
}

/** Paying or trialing, phone on file, real account, and last check-in 7+ days ago or never. Churned and trial_ended never appear. */
export function checkinsDue(users: UserRecord[], log: CheckinLogRow[], now: Date = new Date()): UserRecord[] {
  return users.filter(u => {
    if (u.status !== 'paying' && u.status !== 'trialing') return false;
    if (!u.phone || u.excludedFromMetrics || u.fakeReason) return false;
    const last = lastSentAt(u.id, log);
    return last === null || now.getTime() - new Date(last).getTime() >= WEEK_MS;
  });
}

/** Zero-based index into CHECKIN_TEXTS. Rotates with each send so a user never gets the same text twice in a row. */
export function checkinVariation(user: Pick<UserRecord, 'id'>, log: CheckinLogRow[]): number {
  return (hashId(user.id) + timesSent(user.id, log)) % CHECKIN_TEXTS.length;
}

export function checkinText(user: Pick<UserRecord, 'id' | 'name'>, log: CheckinLogRow[]): string {
  return CHECKIN_TEXTS[checkinVariation(user, log)].replace('{first}', firstName(user));
}

export async function loadCheckinLog(): Promise<CheckinLogRow[]> {
  const { data, error } = await adminClient()
    .from('checkin_log')
    .select('user_id, sent_at, variation')
    .order('sent_at', { ascending: false });
  if (error) throw new Error(`checkin_log load failed: ${error.message}`);
  return (data ?? []) as CheckinLogRow[];
}

/** Records that the founder opened Messages with this variation. */
export async function markSent(userId: string, variation: number): Promise<void> {
  const { error } = await adminClient().from('checkin_log').insert({ user_id: userId, variation });
  if (error) throw new Error(`checkin_log insert failed: ${error.message}`);
}
