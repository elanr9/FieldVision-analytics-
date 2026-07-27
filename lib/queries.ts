import { createClient } from '@supabase/supabase-js';
import { classifyUser } from './classify';
import type { ProfileRow, SubscriptionRow, UserRecord } from './types';

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Loads every user with their classified status. Read only.
 * Emails come from auth.users first, then profile fallbacks.
 */
export async function loadUsers(): Promise<UserRecord[]> {
  const supabase = adminClient();

  const [profilesRes, subsRes, authRes] = await Promise.all([
    supabase
      .from('user_profiles')
      .select(
        'user_id, full_name, email, notification_email, created_at, trial_started_at, account_type, is_demo, is_ambassador, is_admin',
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('user_subscriptions')
      .select('user_id, plan, payment_type, stripe_subscription_id, amount_cents, paid_at'),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (profilesRes.error) throw profilesRes.error;
  if (subsRes.error) throw subsRes.error;

  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const subs = (subsRes.data ?? []) as SubscriptionRow[];
  const subByUser = new Map(subs.map(s => [s.user_id, s]));

  const authEmailByUser = new Map<string, string>();
  if (!authRes.error) {
    for (const u of authRes.data.users) {
      if (u.email) authEmailByUser.set(u.id, u.email);
    }
  }

  const now = new Date();

  return profiles.map(profile => {
    const sub = subByUser.get(profile.user_id);
    const c = classifyUser(profile, sub, now);
    return {
      id: profile.user_id,
      name: profile.full_name ?? 'Unknown',
      email:
        authEmailByUser.get(profile.user_id) ??
        profile.email ??
        profile.notification_email ??
        '',
      signupDate: profile.created_at,
      trialStartedAt: profile.trial_started_at,
      paidAt: c.status === 'paying' || c.status === 'churned' ? sub?.paid_at ?? null : null,
      status: c.status,
      interval: c.interval,
      isParent: profile.account_type === 'parent',
      excludedFromMetrics: c.excludedFromMetrics,
    };
  });
}
