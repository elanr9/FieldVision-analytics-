import { NextResponse, type NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sendPushToAll } from '@/lib/apns';
import { buildNotificationCopy, recordEvent } from '@/lib/notifications';
import { loadUsers } from '@/lib/queries';
import type { UserRecord } from '@/lib/types';

const INACTIVE_MS = 5 * 24 * 60 * 60 * 1000;

function admin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  return createClient(url, key, { auth: { persistSession: false } });
}

function isRealPayer(u: UserRecord): boolean {
  return u.status === 'paying' && !u.excludedFromMetrics && !u.isParent && !u.fakeReason;
}

async function lastEventAt(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('product_events')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { created_at: string } | null)?.created_at ?? null;
}

/** One alert per stretch of inactivity: skip when already alerted since the athlete was last active. */
async function alertedSince(supabase: SupabaseClient, userId: string, sinceIso: string): Promise<boolean> {
  const { data } = await supabase
    .from('analytics_notifications')
    .select('id')
    .eq('type', 'inactive')
    .eq('user_id', userId)
    .gte('created_at', sinceIso)
    .limit(1);
  return Boolean(data && data.length > 0);
}

/**
 * Daily pg_cron job. Alerts the founder about each real paying athlete whose last
 * Inkbound app event was 5 or more days ago. Authenticated by the shared notify secret.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.NOTIFY_SECRET;
  if (!secret || request.headers.get('x-notify-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = admin();
  const payers = (await loadUsers()).filter(isRealPayer);
  const now = Date.now();
  const alerted: string[] = [];

  for (const user of payers) {
    const lastActive = (await lastEventAt(supabase, user.id)) ?? user.lastSignInAt;
    if (!lastActive || now - new Date(lastActive).getTime() < INACTIVE_MS) continue;
    if (await alertedSince(supabase, user.id, lastActive)) continue;

    const vars = { full: user.name, first: user.name.trim().split(/\s+/)[0] };
    const copy = buildNotificationCopy('inactive', vars);
    try {
      await recordEvent('inactive', user.id, vars);
      await sendPushToAll(copy.title, copy.sub ?? '', { eventType: 'inactive', userId: user.id, focus: 'checkin' });
      alerted.push(user.id);
    } catch (err) {
      console.error('Inactive alert failed', user.id, err);
    }
  }

  return NextResponse.json({ ok: true, checked: payers.length, alerted: alerted.length });
}
